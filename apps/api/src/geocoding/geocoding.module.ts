import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { GEOCODING_PROVIDER } from './geocoding.types';
import { CachedGeocodingProvider } from './providers/cached-geocoding.provider';
import { NominatimGeocodingProvider } from './providers/nominatim-geocoding.provider';

@Module({
  imports: [AuthModule, CacheModule],

  controllers: [GeocodingController],

  providers: [
    GeocodingService,

    NominatimGeocodingProvider,

    CachedGeocodingProvider,

    {
      provide: GEOCODING_PROVIDER,

      useExisting: CachedGeocodingProvider,
    },
  ],

  exports: [GeocodingService],
})
export class GeocodingModule {}
