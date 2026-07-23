import { Controller, Get, Query } from '@nestjs/common';
import { LeaderboardService, LeaderboardPeriod } from './leaderboard.service.js';

@Controller('api/v1/gamification')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('leaderboard')
  getLeaderboard(@Query('period') period?: LeaderboardPeriod) {
    return this.leaderboardService.getLeaderboard(period || LeaderboardPeriod.ALL_TIME);
  }
}
