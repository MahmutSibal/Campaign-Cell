import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CasesService } from './cases.service.js';
import { AssignExpertDto } from './dto/assign-expert.dto.js';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto.js';
import { OverrideSegmentDto } from './dto/override-segment.dto.js';
import { QueryCaseDto } from './dto/query-case.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { UserPayload } from '../auth/current-user.decorator.js';
import { RoleEnum } from '../auth/roles.enum.js';

@Controller('api/v1/cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  findAll(@Query() query: QueryCaseDto) {
    return this.casesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.casesService.findOne(id);
  }

  // Case §3.3: Manuel atama yalnızca Süpervizör (Yönetici) / Admin
  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
  assignExpert(
    @Param('id') id: string,
    @Body() dto: AssignExpertDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.casesService.assignExpert(id, dto, user.userId);
  }

  // Rol kontrolü geçiş bazlı yapılır (servis katmanı, Case §4.2)
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.CAMPAIGN_EXPERT, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.casesService.updateStatus(id, dto, user.userId, user.role);
  }

  @Patch(':id/segment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.CAMPAIGN_EXPERT, RoleEnum.SUPERVISOR, RoleEnum.ADMIN)
  overrideSegment(
    @Param('id') id: string,
    @Body() dto: OverrideSegmentDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.casesService.overrideSegment(id, dto, user.userId);
  }
}
