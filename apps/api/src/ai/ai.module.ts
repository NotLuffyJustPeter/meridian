import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TripsModule } from '../trips/trips.module';
import { WeatherModule } from '../weather/weather.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { JourneyContextService } from './context/journey-context.service';
import { AI_PROVIDER } from './providers/ai.provider';
import { GeminiAiProvider } from './providers/gemini-ai.provider';

@Module({
  imports: [AuthModule, TripsModule, WeatherModule],
  controllers: [AiController],
  providers: [
    AiService,
    JourneyContextService,
    {
      provide: AI_PROVIDER,
      useClass: GeminiAiProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
