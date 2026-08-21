import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { AiService } from './ai.service';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';

@Controller('trips/:tripId/ai')
@UseGuards(AccessTokenGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('recommendations')
  @HttpCode(HttpStatus.OK)
  generateRecommendations(
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
    dto: GenerateRecommendationsDto,
  ) {
    return this.aiService.generateRecommendations(user.sub, tripId, dto);
  }
}
