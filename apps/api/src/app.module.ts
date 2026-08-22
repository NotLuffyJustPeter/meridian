import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BudgetModule } from './budget/budget.module';
import { DatabaseModule } from './database/database.module';
import { ExpensesModule } from './expenses/expenses.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthModule } from './health/health.module';
import { ItineraryModule } from './itinerary/itinerary.module';
import { PlacesModule } from './places/places.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';
import { SecurityModule } from './security/security.module';
import { validateEnvironment } from './security/environment.validation';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),

    SecurityModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    TripsModule,
    RealtimeModule,
    ItineraryModule,
    PlacesModule,
    GeocodingModule,
    BudgetModule,
    ExpensesModule,
    WeatherModule,
    AiModule,
  ],
})
export class AppModule {}
