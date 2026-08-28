import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, propagation, ROOT_CONTEXT, SpanStatusCode, trace } from '@opentelemetry/api';
import { Job, Worker } from 'bullmq';

import { EmailService } from '../../auth/email.service';
import { PrismaService } from '../../database/prisma.service';
import { MAIL_QUEUE_NAME, PASSWORD_RESET_JOB_NAME } from '../jobs.constants';
import { createQueueRedisOptions } from '../jobs.connection';
import type { EncryptedJobPayload, PasswordResetJobPayload } from '../jobs.types';
import { QueuePayloadCryptoService } from '../queue-payload-crypto.service';

const workerTracer = trace.getTracer('meridian-jobs-worker');

@Injectable()
export class PasswordResetMailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PasswordResetMailWorker.name);

  private worker: Worker<EncryptedJobPayload> | null = null;

  constructor(
    private readonly configService: ConfigService,

    private readonly crypto: QueuePayloadCryptoService,

    private readonly emailService: EmailService,

    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.configService.get<string>('QUEUE_ENABLED')?.trim() === 'true';

    if (!enabled) {
      this.logger.log('BullMQ worker disabled');

      return;
    }

    const redisUrl = this.configService.get<string>('QUEUE_REDIS_URL')?.trim();

    if (!redisUrl) {
      throw new Error('QUEUE_REDIS_URL is required when QUEUE_ENABLED=true');
    }

    this.worker = new Worker<EncryptedJobPayload>(
      MAIL_QUEUE_NAME,

      async (job) => this.process(job),

      {
        connection: createQueueRedisOptions(redisUrl, 'worker'),

        concurrency: 4,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`BullMQ job completed jobId=${job.id ?? 'unknown'}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        {
          jobId: job?.id ?? 'unknown',
          jobName: job?.name ?? 'unknown',
          attemptsMade: job?.attemptsMade ?? 0,
          error: error.message,
        },
        'BullMQ job failed',
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(
        {
          error: error.message,
        },
        'BullMQ worker connection error',
      );
    });

    await this.worker.waitUntilReady();

    this.logger.log(`BullMQ worker ready queue=${MAIL_QUEUE_NAME}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<EncryptedJobPayload>): Promise<void> {
    if (job.name !== PASSWORD_RESET_JOB_NAME) {
      throw new Error('Unsupported mail job');
    }

    const payload = this.crypto.decrypt<PasswordResetJobPayload>(job.data);

    const parentContext = propagation.extract(ROOT_CONTEXT, payload.traceContext);

    await context.with(
      parentContext,

      async () =>
        workerTracer.startActiveSpan(
          'queue.process password-reset',

          async (span) => {
            const maxAttempts = job.opts.attempts ?? 1;

            const attempt = job.attemptsMade + 1;

            span.setAttribute('messaging.system', 'bullmq');

            span.setAttribute('messaging.destination.name', MAIL_QUEUE_NAME);

            span.setAttribute('messaging.operation.name', 'process');

            span.setAttribute('messaging.message.id', job.id ?? 'unknown');

            span.setAttribute('meridian.queue.attempt', attempt);

            try {
              const token = await this.prisma.passwordResetToken.findUnique({
                where: {
                  id: payload.resetTokenId,
                },

                select: {
                  usedAt: true,

                  expiresAt: true,
                },
              });

              if (!token || token.usedAt !== null || token.expiresAt <= new Date()) {
                span.setAttribute('meridian.queue.skipped', true);

                span.setStatus({
                  code: SpanStatusCode.OK,
                });

                return;
              }

              await this.emailService.sendPasswordResetEmail({
                to: payload.to,

                name: payload.name,

                resetUrl: payload.resetUrl,
              });

              span.setStatus({
                code: SpanStatusCode.OK,
              });
            } catch (error) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
              });

              span.recordException(new Error('Password reset delivery attempt failed'));

              if (attempt >= maxAttempts) {
                await this.prisma.passwordResetToken.updateMany({
                  where: {
                    id: payload.resetTokenId,

                    usedAt: null,
                  },

                  data: {
                    usedAt: new Date(),
                  },
                });

                span.setAttribute('meridian.queue.token_invalidated', true);
              }

              throw error;
            } finally {
              span.end();
            }
          },
        ),
    );
  }
}
