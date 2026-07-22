import Redis from 'ioredis';
import pino from 'pino';
import { logAudit } from './audit.js';

const logger = pino({ name: 'audit-subscriber' });

interface AuditEventPayload {
  userId?: string;
  userName?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  result?: string;
  ipAddress?: string;
  details?: string;
}

// Cross-service audit trail: campaign/ai/gamification services can't write
// directly to identity-service's audit_logs table (database-per-service), so
// they publish to the shared `audit.log` Redis channel and this subscriber
// persists those entries here.
export function startAuditSubscriber(): void {
  const url = process.env.REDIS_URL || 'redis://redis:6379';
  const subscriber = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: null });

  subscriber.on('connect', () => logger.info('Audit subscriber connected to Redis'));
  subscriber.on('error', (err: Error) => logger.warn({ err }, 'Audit subscriber Redis error'));

  subscriber.subscribe('audit.log', (err) => {
    if (err) logger.error({ err }, 'Failed to subscribe to audit.log channel');
    else logger.info('Subscribed to audit.log channel');
  });

  subscriber.on('message', async (channel: string, message: string) => {
    if (channel !== 'audit.log') return;
    try {
      const parsed = JSON.parse(message) as { payload: AuditEventPayload };
      const payload = parsed.payload;
      await logAudit({
        userId: payload.userId,
        userName: payload.userName,
        action: payload.action,
        resource: payload.resource,
        resourceId: payload.resourceId,
        result: payload.result,
        ipAddress: payload.ipAddress,
        details: payload.details,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to process audit.log event');
    }
  });
}
