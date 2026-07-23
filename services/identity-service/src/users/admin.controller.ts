import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { RoleEnum } from '@prisma/client';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /admin/users — Tüm kullanıcıları listele (Admin only)
   */
  @Get('users')
  @Roles('ADMIN')
  async listUsers(@Query('role') role?: string) {
    return this.usersService.findAll(role as RoleEnum);
  }

  /**
   * POST /admin/users — Uzman / Süpervizör hesabı oluştur (Admin only)
   */
  @Post('users')
  @Roles('ADMIN')
  async createStaff(
    @Body() body: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      role: 'CAMPAIGN_EXPERT' | 'SUPERVISOR' | 'ADMIN';
      expertiseTags?: string[];
      region?: string;
    },
    @Request() req: any,
  ) {
    const result = await this.usersService.createStaffAccount({
      ...body,
      role: body.role as RoleEnum,
    });
    return {
      success: true,
      message: `${body.role} hesabı başarıyla oluşturuldu.`,
      data: result,
    };
  }

  /**
   * PATCH /admin/users/:id/role — Kullanıcı rolünü değiştir (Admin only)
   */
  @Patch('users/:id/role')
  @Roles('ADMIN')
  async changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: 'CAMPAIGN_EXPERT' | 'SUPERVISOR' | 'ADMIN' | 'SUBSCRIBER' },
  ) {
    const result = await this.usersService.updateRole(id, body.role as RoleEnum);
    return { success: true, message: 'Rol başarıyla güncellendi.', data: result };
  }

  /**
   * PATCH /admin/users/:id/unlock — Kilitli hesabı aç (Admin only)
   */
  @Patch('users/:id/unlock')
  @Roles('ADMIN')
  async unlockUser(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.unlockAccount(id);
    return { success: true, message: 'Hesap kilidi kaldırıldı.', data: result };
  }

  /**
   * GET /admin/audit-logs — Audit log görüntüle (Admin + Supervisor)
   */
  @Get('audit-logs')
  @Roles('ADMIN', 'SUPERVISOR')
  async getAuditLogs(@Query('limit') limit?: string) {
    const logs = await this.usersService.getAuditLogs(limit ? parseInt(limit) : 100);
    return { success: true, data: logs, total: logs.length };
  }

  /**
   * GET /admin/stats — Sistem istatistikleri (Admin + Supervisor)
   */
  @Get('stats')
  @Roles('ADMIN', 'SUPERVISOR')
  async getStats() {
    const [allUsers, experts, supervisors, admins, subscribers] = await Promise.all([
      this.usersService.findAll(),
      this.usersService.findAll('CAMPAIGN_EXPERT' as RoleEnum),
      this.usersService.findAll('SUPERVISOR' as RoleEnum),
      this.usersService.findAll('ADMIN' as RoleEnum),
      this.usersService.findAll('SUBSCRIBER' as RoleEnum),
    ]);

    return {
      success: true,
      data: {
        totalUsers: allUsers.length,
        experts: experts.length,
        supervisors: supervisors.length,
        admins: admins.length,
        subscribers: subscribers.length,
        lockedAccounts: allUsers.filter((u: any) => u.isLocked).length,
      },
    };
  }
}
