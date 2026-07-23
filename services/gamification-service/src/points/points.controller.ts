import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PointsService } from './points.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('api/v1/gamification')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('experts/:expertId/points')
  @UseGuards(JwtAuthGuard)
  getExpertPoints(@Param('expertId') expertId: string) {
    return this.pointsService.getExpertPoints(expertId);
  }
}
