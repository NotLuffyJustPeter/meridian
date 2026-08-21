import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TripsModule } from '../trips/trips.module';
import { ItineraryController } from './itinerary.controller';
import { ItineraryService } from './itinerary.service';

@Module({
  imports: [AuthModule, TripsModule, RealtimeModule],
  controllers: [ItineraryController],
  providers: [ItineraryService],
  exports: [ItineraryService],
})
export class ItineraryModule {}
