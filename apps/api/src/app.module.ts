import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { BudgetModule } from './budget/budget.module';
import { DatabaseModule } from './database/database.module';
import { ExpensesModule } from './expenses/expenses.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthModule } from './health/health.module';
import { ItineraryModule } from './itinerary/itinerary.module';
import { PlacesModule } from './places/places.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),

    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    TripsModule,
    ItineraryModule,
    PlacesModule,
    GeocodingModule,
    BudgetModule,
    ExpensesModule,
  ],
})
export class AppModule {}
