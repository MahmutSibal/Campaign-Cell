import Redis from 'ioredis';
import pino from 'pino';
import { handleCampaignOptimized, handleSlaBreached, handleOfferRated } from './pointsEngine';

const logger = pino({ transport: { target: 'pino-pretty' } });

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
