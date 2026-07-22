import type { Request } from 'express';
import { db } from '../db/client.js';
import { auditLogsTable } from '../db/schema.js';
import { publishEvent } from './redis.js';

export function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

export async function logAudit(params: {
  userId?: string;
  userName?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  result?: string;
  ipAddress?: string;
  details?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      result: params.result ?? 'SUCCESS',
      ipAddress: params.ipAddress,
      details: params.details,
    });
    await publishEvent('audit:events', {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // don't fail the request if audit logging fails
  }
}
