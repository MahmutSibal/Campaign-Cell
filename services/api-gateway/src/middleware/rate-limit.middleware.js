const rateLimit = require('express-rate-limit');

const errorBody = (message) => ({
  success: false,
  data: null,
  error: {
    statusCode: 429,
    message,
    code: 'Too Many Requests',
  },
});

// Genel istek sınırı: IP başına 100 istek / dakika.
const rateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody('Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.'),
});

// Kimlik doğrulama (giriş/OTP) için SIKI sınır — brute-force savunması (Case §10).
// IP başına 10 deneme / dakika. Identity'nin 5/15dk hesap kilidiyle birlikte katmanlı koruma sağlar.
const authRateLimitMiddleware = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorBody('Çok fazla giriş denemesi. Güvenlik nedeniyle bir dakika bekleyin.'),
});

module.exports = rateLimitMiddleware;
module.exports.authRateLimitMiddleware = authRateLimitMiddleware;
