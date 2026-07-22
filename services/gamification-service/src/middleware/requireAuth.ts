import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
        return;
      }
      next();
    });
  };
}
