import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { publishEvent } from '../lib/redis.js';

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

export interface AuthRequest extends Request {
  user?: { id: string; role: string; name: string; email: string };
}

const JWT_SECRET = process.env.JWT_SECRET || 'campaigncell-dev-secret-2026';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || '';

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.headers['x-service-token'] === SERVICE_TOKEN && SERVICE_TOKEN) {
    next(); return;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authorization token required' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        if (req.user) {
          publishEvent('audit.log', {
            userId: req.user.id,
            userName: req.user.name,
            action: 'UNAUTHORIZED_ACCESS',
            resource: req.originalUrl,
            result: 'FAILURE',
            ipAddress: getIp(req),
            details: `Required roles: ${roles.join(', ')}, current: ${req.user.role}`,
          });
        }
        res.status(403).json({ success: false, error: `Access denied. Required roles: ${roles.join(', ')}` });
        return;
      }
      next();
    });
  };
}
