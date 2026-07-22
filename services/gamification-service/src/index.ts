import express from 'express';
import cors from 'cors';
import pino from 'pino';
import rateLimit from 'express-rate-limit';
import { initDb } from './db/client';
import { startRedisSubscriber } from './lib/redis';
import gamificationRouter from './routes/gamification';
import sseRouter from './routes/sse';

const logger = pino({ transport: { target: 'pino-pretty' } });
const app = express();
const PORT = parseInt(process.env.PORT || '3004');

app.set('trust proxy', true);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type','X-Service-Token'] }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.get('/healthz', (_, res) => res.json({ status: 'ok', service: 'gamification-service', timestamp: new Date().toISOString() }));
app.use('/v1/game', gamificationRouter);
app.use('/v1/game', sseRouter);
app.use((req, res) => res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` }));

async function main() {
  await initDb();
  startRedisSubscriber();
  app.listen(PORT, () => logger.info(`[gamification-service] listening on port ${PORT}`));
}
main().catch(err => { console.error(err); process.exit(1); });
