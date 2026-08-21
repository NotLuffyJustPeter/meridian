import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CollaboratorsController } from './collaborators.controller';
import { CollaboratorsService } from './collaborators.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [TripsController, CollaboratorsController],
  providers: [TripsService, CollaboratorsService],
  exports: [TripsService, CollaboratorsService],
})
export class TripsModule {}
