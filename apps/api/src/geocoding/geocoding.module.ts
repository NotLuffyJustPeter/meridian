import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { GEOCODING_PROVIDER } from './geocoding.types';
import { NominatimGeocodingProvider } from './providers/nominatim-geocoding.provider';

@Module({
  imports: [AuthModule],

  controllers: [GeocodingController],

  providers: [
    GeocodingService,

    {
      provide: GEOCODING_PROVIDER,

      useClass: NominatimGeocodingProvider,
    },
  ],

  exports: [GeocodingService],
})
export class GeocodingModule {}
