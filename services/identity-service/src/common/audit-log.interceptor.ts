import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Yazma işlemleri (POST/PUT/PATCH/DELETE) için genel audit log.
 * Hem başarılı hem başarısız sonuçları kaydeder (Case §3.4).
 * Not: /auth/* uç noktaları AuthService içinde ayrıntılı olarak zaten loglanır;
 * burada çift kayıt olmaması için auth yolları atlanır.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  private ipOf(req: any): string | null {
    const xff = req.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
    return req.ip || null;
  }

  private async write(req: any, result: 'SUCCESS' | 'FAILURE', detail?: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          action: `${req.method} ${req.originalUrl || req.url}`,
          ipAddress: this.ipOf(req),
          result,
          detail: detail ?? undefined,
        },
      });
    } catch (e) {
      console.error('[AUDIT] yazılamadı:', (e as Error).message);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const url: string = req.originalUrl || req.url || '';
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isAuthPath = url.includes('/auth/'); // AuthService içinde ayrıntılı loglanıyor

    if (!isWrite || isAuthPath) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => this.write(req, 'SUCCESS')),
      catchError((err) => {
        this.write(req, 'FAILURE', { status: err?.status, message: err?.message });
        return throwError(() => err);
      }),
    );
  }
}
