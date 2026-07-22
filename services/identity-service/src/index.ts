import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { initDb } from './db/client.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';

const logger = pino({
  name: 'identity-service',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Trust nginx gateway (1 hop)
app.set('trust proxy', 1);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Global rate limiter
app.use(apiLimiter);

// Health check (no auth required)
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'identity-service' });
});

// Routes
app.use('/v1/auth', authRoutes);
app.use('/v1/users', usersRoutes);
app.use('/v1/audit', auditRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  },
);

async function main() {
  try {
    logger.info('Initializing database...');
    await initDb();
    logger.info('Database initialized');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Identity service listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start service');
    process.exit(1);
  }
}

main();
