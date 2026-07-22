import Redis from 'ioredis';
import pino from 'pino';
import { handleCampaignOptimized, handleSlaBreached, handleOfferRated } from './pointsEngine';

const logger = pino({ transport: { target: 'pino-pretty' } });

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    publisher.on('error', (err) => logger.warn({ err }, 'Redis publisher connection error'));
  }
  return publisher;
}

export async function publishEvent(channel: string, payload: object): Promise<void> {
  try {
    const r = getPublisher();
    await r.publish(channel, JSON.stringify({ event_type: channel, timestamp: new Date().toISOString(), payload }));
  } catch (err) {
    logger.warn({ err, channel }, 'Failed to publish Redis event - continuing without event');
  }
}

export function startRedisSubscriber(): void {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const subscriber = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });

  subscriber.on('connect', () => logger.info('[gamification-service] Redis subscriber connected'));
  subscriber.on('error', (err) => logger.warn({ err }, 'Redis subscriber error'));

  subscriber.subscribe('campaign.optimized', 'campaign.sla_breached', 'offer.rated', (err, count) => {
    if (err) logger.error({ err }, 'Failed to subscribe to Redis channels');
    else logger.info(`[gamification-service] Subscribed to ${count} Redis channels`);
  });

  subscriber.on('message', async (channel: string, message: string) => {
    try {
      const { payload } = JSON.parse(message);
      switch (channel) {
        case 'campaign.optimized':
          await handleCampaignOptimized(payload);
          break;
        case 'campaign.sla_breached':
          await handleSlaBreached(payload);
          break;
        case 'offer.rated':
          await handleOfferRated(payload);
          break;
      }
    } catch (err) {
      logger.error({ err, channel }, 'Error processing Redis message');
    }
  });
}
