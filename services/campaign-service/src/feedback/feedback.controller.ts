import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service.js';
import { CreateFeedbackDto } from './dto/create-feedback.dto.js';
import { CreateAbTestDto } from './dto/create-ab-test.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UserPayload } from '../auth/current-user.decorator.js';
import { RoleEnum } from '../auth/roles.enum.js';

@Controller('api/v1')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  createFeedback(@Body() dto: CreateFeedbackDto, @CurrentUser() user: UserPayload) {
    return this.feedbackService.createFeedback(dto, user.userId);
  }

  @Post('ab-tests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.CAMPAIGN_EXPERT, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
  createAbTest(@Body() dto: CreateAbTestDto, @CurrentUser() user: UserPayload) {
    return this.feedbackService.createAbTest(dto, user.userId);
  }
}
