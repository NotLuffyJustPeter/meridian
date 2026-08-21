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

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('trips/:tripId/expenses')
@UseGuards(AccessTokenGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

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
    dto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user.sub, tripId, dto);
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
    return this.expensesService.findAllOwned(user.sub, tripId);
  }

  @Get(':expenseId')
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
      'expenseId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    expenseId: string,
  ) {
    return this.expensesService.findOne(user.sub, tripId, expenseId);
  }

  @Patch(':expenseId')
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
      'expenseId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    expenseId: string,

    @Body()
    dto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user.sub, tripId, expenseId, dto);
  }

  @Delete(':expenseId')
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
      'expenseId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    expenseId: string,
  ): Promise<void> {
    await this.expensesService.remove(user.sub, tripId, expenseId);
  }
}
