import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';
import { RoleEnum } from './roles.enum.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleEnum[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Kullanıcı rolü bulunamadı');
    }

    const hasRole = requiredRoles.includes(user.role as RoleEnum);
    if (!hasRole) {
      throw new ForbiddenException(`Bu işlemi yapma yetkiniz yok (Gerekli roller: ${requiredRoles.join(', ')})`);
    }

    return true;
  }
}
