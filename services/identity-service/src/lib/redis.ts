import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'redis' });

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    const url = process.env.REDIS_URL || 'redis://redis:6379';
    redisInstance = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });

    redisInstance.on('error', (err: Error) => {
      logger.warn({ err }, 'Redis connection error');
    });

    redisInstance.on('connect', () => {
      logger.info('Redis connected');
    });
  }
  return redisInstance;
}

export async function publishEvent(channel: string, payload: object): Promise<void> {
  try {
    const redis = getRedis();
    await redis.publish(channel, JSON.stringify(payload));
  } catch (err) {
    logger.warn({ err, channel }, 'Failed to publish Redis event — continuing without it');
  }
}
