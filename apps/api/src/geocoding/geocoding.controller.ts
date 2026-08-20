import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { SearchGeocodingDto } from './dto/search-geocoding.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
@UseGuards(AccessTokenGuard)
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  search(
    @Query()
    query: SearchGeocodingDto,
  ) {
    return this.geocodingService.search(query.q);
  }
}
