const jwt = require('jsonwebtoken');

// Kimlik doğrulaması gerektirmeyen TAM eşleşen yollar.
const PUBLIC_EXACT = new Set([
  '/',
  '/health',
  '/api/v1/health',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/send-otp',
  '/api/v1/auth/verify-otp',
  '/api/v1/auth/refresh',
  '/api/v1/ai/health',
  '/api/v1/ai/benchmark',
  '/api/v1/ai/feature-importance',
]);

// Kimlik doğrulaması gerektirmeyen ön ek (prefix) yolları (Swagger dokümanları vb.).
const PUBLIC_PREFIXES = ['/api/docs', '/docs', '/api/v1/events/stream'];

/**
 * GÜVENLİK: Yalnızca istek YOLU (pathname) üzerinden kontrol edilir; query string
 * ATLANIR. Aksi halde '/api/v1/campaigns?x=/auth/' gibi bir istek substring eşleşmesiyle
 * auth'u atlatabilirdi (auth bypass açığı). Eşleşme tam yol veya güvenli prefix iledir.
 */
const isPublicPath = (req) => {
  let pathname = req.path || '';
  try {
    // originalUrl query içerebilir → yalnızca pathname'i al.
    pathname = new URL(req.originalUrl || req.url || '/', 'http://gw').pathname;
  } catch (_) {
    /* req.path fallback */
  }

  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) return true;
  return false;
};

const authMiddleware = (req, res, next) => {
  if (isPublicPath(req)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        statusCode: 401,
        message: 'Giriş tokenı bulunamadı. Lütfen Authorization başlığı ekleyin.',
        code: 'Unauthorized',
      },
    });
  }

  const token = authHeader.split(' ')[1];
  const jwtSecret = process.env.JWT_SECRET || 'campaigncell-secret-key-change-in-prod';

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    // Downstream servislere iletmek üzere header'lara ekle
    req.headers['x-user-id'] = decoded.sub || decoded.userId;
    req.headers['x-user-role'] = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        statusCode: 401,
        message: 'Geçersiz veya süresi dolmuş token',
        code: 'Unauthorized',
        detail: error.message,
      },
    });
  }
};

module.exports = authMiddleware;
