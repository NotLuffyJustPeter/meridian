import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { BudgetService } from './budget.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { UpsertCategoryLimitDto } from './dto/upsert-category-limit.dto';

@Controller('trips/:tripId/budget')
@UseGuards(AccessTokenGuard)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  getBudget(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
  ) {
    return this.budgetService.getBudget(user.sub, tripId);
  }

  @Put()
  upsertBudget(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
    @Body() dto: UpsertBudgetDto,
  ) {
    return this.budgetService.upsertBudget(user.sub, tripId, dto);
  }

  @Get('overview')
  getOverview(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
  ) {
    return this.budgetService.getOverview(user.sub, tripId);
  }

  @Get('categories')
  listCategoryLimits(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
  ) {
    return this.budgetService.listCategoryLimits(user.sub, tripId);
  }

  @Put('categories/:category')
  upsertCategoryLimit(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
    @Param('category') category: string,
    @Body() dto: UpsertCategoryLimitDto,
  ) {
    return this.budgetService.upsertCategoryLimit(user.sub, tripId, category, dto);
  }

  @Delete('categories/:category')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCategoryLimit(
    @CurrentUser() user: AccessTokenPayload,
    @Param('tripId', new ParseUUIDPipe({ version: '4' })) tripId: string,
    @Param('category') category: string,
  ): Promise<void> {
    await this.budgetService.removeCategoryLimit(user.sub, tripId, category);
  }
}
