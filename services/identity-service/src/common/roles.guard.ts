import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Rol tabanlı yetkilendirme guard'ı (Case §3.3 yetki matrisi).
 * Yetkisiz erişim denemesi 403 döner VE audit log'a yazılır (Case §3.4).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles || roles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && roles.includes(user.role)) {
      return true;
    }

    // Yetkisiz erişim → audit log (§3.4)
    try {
      const xff = request.headers?.['x-forwarded-for'];
      const ip = typeof xff === 'string' ? xff.split(',')[0].trim() : request.ip;
      await this.prisma.auditLog.create({
        data: {
          userId: user?.id ?? null,
          action: 'UNAUTHORIZED_ACCESS',
          result: 'FAILURE',
          ipAddress: ip ?? null,
          resourceId: `${request.method} ${request.originalUrl || request.url}`,
          detail: { requiredRoles: roles, userRole: user?.role ?? 'anonymous' },
        },
      });
    } catch (e) {
      console.error('[AUDIT] 403 yazılamadı:', (e as Error).message);
    }

    throw new ForbiddenException('Bu işlem için yetkiniz bulunmuyor.');
  }
}
