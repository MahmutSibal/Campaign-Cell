import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on('error', (err) => logger.warn({ err }, 'Redis connection error'));
  }
  return redis;
}

export async function publishEvent(channel: string, payload: object): Promise<void> {
  try {
    const r = getRedis();
    await r.publish(channel, JSON.stringify({ event_type: channel, timestamp: new Date().toISOString(), payload }));
  } catch (err) {
    logger.warn({ err, channel }, 'Failed to publish Redis event - continuing without event');
  }
}
