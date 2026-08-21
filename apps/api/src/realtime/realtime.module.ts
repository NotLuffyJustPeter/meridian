import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TripsModule } from '../trips/trips.module';
import { RealtimePublisherService } from './realtime-publisher.service';
import { RealtimeTicketController } from './realtime-ticket.controller';
import { RealtimeTicketService } from './realtime-ticket.service';
import { TripGateway } from './trip.gateway';

@Module({
  imports: [AuthModule, TripsModule],
  controllers: [RealtimeTicketController],
  providers: [RealtimeTicketService, RealtimePublisherService, TripGateway],
  exports: [RealtimePublisherService],
})
export class RealtimeModule {}
