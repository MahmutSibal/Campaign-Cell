import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth.js';
import { logAudit, getIp } from '../lib/audit.js';

export interface AuthPayload {
  id: string;
  email?: string;
  gsmNumber?: string;
  role: string;
  name: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);
    req.user = decoded as unknown as AuthPayload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const decoded = verifyToken(token) as unknown as AuthPayload;
      req.user = decoded;

      if (!roles.includes(decoded.role)) {
        logAudit({
          userId: decoded.id,
          userName: decoded.name,
          action: 'UNAUTHORIZED_ACCESS',
          resource: req.originalUrl,
          result: 'FAILURE',
          ipAddress: getIp(req),
          details: `Required roles: ${roles.join(', ')}, current: ${decoded.role}`,
        });
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: roles,
          current: decoded.role,
        });
        return;
      }

      next();
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  };
}
