const rateLimit = require('express-rate-limit');

const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000, // 1 Dakika
  max: 100, // IP başına 100 istek
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      statusCode: 429,
      message: 'Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.',
      code: 'Too Many Requests',
    },
  },
});

module.exports = rateLimitMiddleware;
