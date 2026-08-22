import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, minutes, seconds } from '@nestjs/throttler';

import { MeridianThrottlerGuard } from './meridian-throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: minutes(1),
          limit: 300,
          blockDuration: seconds(15),
        },
      ],
      skipIf: () => process.env.NODE_ENV === 'test',
      errorMessage: 'Too many requests. Please try again shortly.',
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: MeridianThrottlerGuard,
    },
  ],
})
export class SecurityModule {}
