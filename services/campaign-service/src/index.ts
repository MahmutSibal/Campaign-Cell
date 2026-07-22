import express from 'express';
import cors from 'cors';
import pino from 'pino';
import rateLimit from 'express-rate-limit';
import { initDb } from './db/client';
import campaignsRouter from './routes/campaigns';
import casesRouter from './routes/cases';
import subscribersRouter from './routes/subscribers';
import experimentsRouter from './routes/experiments';
import analyticsRouter from './routes/analytics';

const logger = pino({ transport: { target: 'pino-pretty' } });
const app = express();
const PORT = parseInt(process.env.PORT || '3002');

app.set('trust proxy', true);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type','X-Service-Token'] }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60 * 1000, max: 300 }));

app.get('/healthz', (_, res) => res.json({ status: 'ok', service: 'campaign-service', timestamp: new Date().toISOString() }));

app.use('/v1/campaigns', campaignsRouter);
app.use('/v1/cases', casesRouter);
app.use('/v1/subscribers', subscribersRouter);
app.use('/v1/experiments', experimentsRouter);
app.use('/v1/analytics', analyticsRouter);

app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

async function main() {
  await initDb();
  app.listen(PORT, () => logger.info(`[campaign-service] listening on port ${PORT}`));
}
main().catch(err => { console.error(err); process.exit(1); });
