import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ transport: { target: 'pino-pretty' } });
const router = Router();

// GET /v1/game/events?userId=<id>
// Server-Sent Events endpoint — streams badge.earned events to the client in real time
router.get('/events', (req: Request, res: Response) => {
  const userId = String(req.query['userId'] || '');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Keep-alive ping every 25 s
  const ping = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const sub = new Redis(REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: null });

  sub.subscribe('badge.earned', 'points.updated', (err) => {
    if (err) logger.error({ err }, 'SSE Redis subscribe error');
  });

  sub.on('message', (channel: string, message: string) => {
    try {
      const data = JSON.parse(message);
      // Only forward events relevant to this user (or broadcast if no userId)
      if (!userId || data.userId === userId || data.expertId === userId) {
        res.write(`event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    } catch (err) {
      logger.warn({ err }, 'SSE message parse error');
    }
  });

  req.on('close', () => {
    clearInterval(ping);
    sub.unsubscribe().catch(() => {});
    sub.disconnect();
  });
});

export default router;
