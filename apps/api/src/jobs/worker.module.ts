import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { EmailService } from '../auth/email.service';
import { DatabaseModule } from '../database/database.module';
import { validateEnvironment } from '../security/environment.validation';
import { PasswordResetMailWorker } from './mail/password-reset-mail.worker';
import { QueuePayloadCryptoService } from './queue-payload-crypto.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),

    LoggerModule.forRoot({
      pinoHttp: {
        name: 'meridian-worker',
      },
    }),

    DatabaseModule,
  ],

  providers: [EmailService, QueuePayloadCryptoService, PasswordResetMailWorker],
})
export class WorkerModule {}
