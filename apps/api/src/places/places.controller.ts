import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { PlacesService } from './places.service';

@Controller('trips/:tripId/places')
@UseGuards(AccessTokenGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post()
  create(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Body()
    dto: CreatePlaceDto,
  ) {
    return this.placesService.create(user.sub, tripId, dto);
  }

  @Get()
  findAll(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,
  ) {
    return this.placesService.findAllOwned(user.sub, tripId);
  }

  @Get(':placeId')
  findOne(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Param(
      'placeId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    placeId: string,
  ) {
    return this.placesService.findOwnedPlaceOrThrow(user.sub, tripId, placeId);
  }

  @Patch(':placeId')
  update(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Param(
      'placeId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    placeId: string,

    @Body()
    dto: UpdatePlaceDto,
  ) {
    return this.placesService.update(user.sub, tripId, placeId, dto);
  }

  @Delete(':placeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser()
    user: AccessTokenPayload,

    @Param(
      'tripId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tripId: string,

    @Param(
      'placeId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    placeId: string,
  ): Promise<void> {
    await this.placesService.remove(user.sub, tripId, placeId);
  }
}
