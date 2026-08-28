import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import { Queue, type Job } from 'bullmq';

import {
  MAIL_QUEUE_NAME,
  PASSWORD_RESET_BACKOFF_MS,
  PASSWORD_RESET_JOB_ATTEMPTS,
  PASSWORD_RESET_JOB_NAME,
} from './jobs.constants';
import { createQueueRedisOptions } from './jobs.connection';
import type { EncryptedJobPayload, PasswordResetJobPayload } from './jobs.types';
import { QueuePayloadCryptoService } from './queue-payload-crypto.service';

const queueTracer = trace.getTracer('meridian-jobs');

type PasswordResetQueue = Queue<EncryptedJobPayload, void, typeof PASSWORD_RESET_JOB_NAME>;

type PasswordResetJob = Job<EncryptedJobPayload, void, typeof PASSWORD_RESET_JOB_NAME>;

export interface EnqueuePasswordResetInput {
  resetTokenId: string;
  to: string;
  name: string;
  resetUrl: string;
}

@Injectable()
export class PasswordResetQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PasswordResetQueueService.name);

  private readonly queue: PasswordResetQueue | null;

  constructor(
    private readonly configService: ConfigService,

    private readonly crypto: QueuePayloadCryptoService,
  ) {
    const enabled = this.configService.get<string>('QUEUE_ENABLED')?.trim() === 'true';

    if (!enabled) {
      this.queue = null;

      return;
    }

    const redisUrl = this.configService.get<string>('QUEUE_REDIS_URL')?.trim();

    if (!redisUrl) {
      throw new Error('QUEUE_REDIS_URL is required when QUEUE_ENABLED=true');
    }

    this.queue = new Queue<EncryptedJobPayload, void, typeof PASSWORD_RESET_JOB_NAME>(
      MAIL_QUEUE_NAME,
      {
        connection: createQueueRedisOptions(redisUrl, 'producer'),
      },
    );
  }

  isEnabled(): boolean {
    return this.queue !== null;
  }

  async enqueuePasswordReset(input: EnqueuePasswordResetInput): Promise<string> {
    if (!this.queue) {
      throw new Error('Password reset queue is disabled');
    }

    const carrier: Record<string, string> = {};

    propagation.inject(context.active(), carrier);

    const payload: PasswordResetJobPayload = {
      ...input,

      traceContext: carrier,
    };

    const encrypted = this.crypto.encrypt(payload);

    const jobId = `password-reset-${input.resetTokenId}`;

    return queueTracer.startActiveSpan(
      'queue.publish password-reset',

      async (span) => {
        span.setAttribute('messaging.system', 'bullmq');

        span.setAttribute('messaging.destination.name', MAIL_QUEUE_NAME);

        span.setAttribute('messaging.operation.name', 'publish');

        span.setAttribute('messaging.message.id', jobId);

        try {
          const job: PasswordResetJob = await this.queue!.add(PASSWORD_RESET_JOB_NAME, encrypted, {
            jobId,

            attempts: PASSWORD_RESET_JOB_ATTEMPTS,

            backoff: {
              type: 'exponential',

              delay: PASSWORD_RESET_BACKOFF_MS,
            },

            removeOnComplete: {
              age: 60 * 60,

              count: 1_000,
            },

            removeOnFail: {
              age: 24 * 60 * 60,

              count: 1_000,
            },
          });

          span.setStatus({
            code: SpanStatusCode.OK,
          });

          return job.id ?? jobId;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
          });

          span.recordException(error instanceof Error ? error : new Error('BullMQ publish failed'));

          this.logger.warn('Password reset job could not be queued');

          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }
}
