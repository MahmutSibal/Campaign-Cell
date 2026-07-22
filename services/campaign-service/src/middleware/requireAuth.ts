import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { publishEvent } from '../lib/redis.js';

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

export interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request with user
declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      publishEvent('audit.log', {
        userId: req.user.id,
        userName: req.user.name,
        action: 'UNAUTHORIZED_ACCESS',
        resource: req.originalUrl,
        result: 'FAILURE',
        ipAddress: getIp(req),
        details: `Required roles: ${roles.join(', ')}, current: ${req.user.role}`,
      });
      res.status(403).json({ success: false, error: `Access denied. Required roles: ${roles.join(', ')}` });
      return;
    }
    next();
  };
}
