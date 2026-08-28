import { Module } from '@nestjs/common';

import { PasswordResetQueueService } from './password-reset-queue.service';
import { QueuePayloadCryptoService } from './queue-payload-crypto.service';

@Module({
  providers: [QueuePayloadCryptoService, PasswordResetQueueService],

  exports: [PasswordResetQueueService],
})
export class JobsModule {}
