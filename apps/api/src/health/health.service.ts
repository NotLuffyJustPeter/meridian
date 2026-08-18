import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      data: {
        status: 'ok',
        service: 'meridian-api',
        database: 'connected',
      },
      meta: null,
      message: 'Meridian API is healthy',
    };
  }
}
