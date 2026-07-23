const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const correlationMiddleware = require('./middleware/correlation.middleware');
const authMiddleware = require('./middleware/auth.middleware');
const rateLimitMiddleware = require('./middleware/rate-limit.middleware');
const { authRateLimitMiddleware } = require('./middleware/rate-limit.middleware');
const healthRoutes = require('./routes/health.routes');
const proxyRoutes = require('./routes/proxy.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(correlationMiddleware);
// Brute-force savunması: giriş/OTP uçlarına SIKI limit (Case §10), diğer her şeye genel limit.
app.use(['/api/v1/auth/login', '/api/v1/auth/verify-otp', '/api/v1/auth/send-otp'], authRateLimitMiddleware);
app.use(rateLimitMiddleware);

const eventsRoutes = require('./routes/events.routes');

// Health & SSE Stream endpoints (Auth bypass for streaming)
app.use('/', healthRoutes);
app.use('/api/v1', healthRoutes);
app.use('/api/v1/events', eventsRoutes);

// JWT Auth Middleware
app.use(authMiddleware);

// Proxy rotaları
app.use('/', proxyRoutes);

// 404 Handler (standart {success, data, error} formatı — Case §8.2)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      statusCode: 404,
      message: `API Gateway: Bulunamayan uç nokta '${req.method} ${req.path}'`,
      code: 'Not Found',
    },
  });
});

module.exports = app;
