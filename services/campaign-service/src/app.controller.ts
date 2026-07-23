import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Controller('api/v1')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async getHealth() {
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    return {
      service: 'campaign-service',
      status: dbOk ? 'UP' : 'DEGRADED',
      database: dbOk ? 'CONNECTED' : 'DISCONNECTED',
      timestamp: new Date().toISOString(),
    };
  }
}
