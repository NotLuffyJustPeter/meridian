import { Controller, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/guards/access-token.guard';

@Controller('trips')
@UseGuards(AccessTokenGuard)
export class TripsController {}
