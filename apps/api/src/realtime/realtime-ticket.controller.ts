import { Controller, Post, UseGuards } from '@nestjs/common';

import type { AccessTokenPayload } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RealtimeTicketService } from './realtime-ticket.service';

@Controller('realtime')
@UseGuards(AccessTokenGuard)
export class RealtimeTicketController {
  constructor(private readonly realtimeTicketService: RealtimeTicketService) {}

  @Post('ticket')
  createTicket(
    @CurrentUser()
    user: AccessTokenPayload,
  ) {
    return this.realtimeTicketService.createTicket(user);
  }
}
