import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BadgesService } from './badges.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('api/v1/gamification')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get('experts/:expertId/badges')
  @UseGuards(JwtAuthGuard)
  getExpertBadges(@Param('expertId') expertId: string) {
    return this.badgesService.getExpertBadges(expertId);
  }
}
