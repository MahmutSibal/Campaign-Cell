const express = require('express');
const proxy = require('express-http-proxy');
const router = express.Router();

const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
const CAMPAIGN_SERVICE_URL = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const GAMIFICATION_SERVICE_URL = process.env.GAMIFICATION_SERVICE_URL || 'http://localhost:3003';

const proxyOptions = (targetUrl) => ({
  parseReqBody: false,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    if (srcReq.correlationId) {
      proxyReqOpts.headers['x-correlation-id'] = srcReq.correlationId;
    }
    if (srcReq.headers['x-user-id']) {
      proxyReqOpts.headers['x-user-id'] = srcReq.headers['x-user-id'];
    }
    if (srcReq.headers['x-user-role']) {
      proxyReqOpts.headers['x-user-role'] = srcReq.headers['x-user-role'];
    }
    return proxyReqOpts;
  },
  proxyErrorHandler: (err, res, next) => {
    console.error(`Proxy Hatası [${targetUrl}]:`, err.message);
    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        data: null,
        error: {
          statusCode: 503,
          message: 'Hedef mikroservis şu anda erişilebilir değil (Service Unavailable)',
          code: 'Service Unavailable',
        },
      });
    } else {
      next(err);
    }
  },
});

// 1. Identity Service Proxies
router.use('/api/v1/auth', proxy(IDENTITY_SERVICE_URL, {
  ...proxyOptions(IDENTITY_SERVICE_URL),
  proxyReqPathResolver: (req) => {
    const subPath = req.originalUrl.replace('/api/v1/auth', '');
    return `/auth${subPath}`;
  },
}));

router.use('/api/v1/users', proxy(IDENTITY_SERVICE_URL, {
  ...proxyOptions(IDENTITY_SERVICE_URL),
  proxyReqPathResolver: (req) => `/users${req.url}`,
}));

router.use('/api/v1/admin', proxy(IDENTITY_SERVICE_URL, {
  ...proxyOptions(IDENTITY_SERVICE_URL),
  proxyReqPathResolver: (req) => `/admin${req.url}`,
}));

router.use('/api/v1/audit-logs', proxy(IDENTITY_SERVICE_URL, {
  ...proxyOptions(IDENTITY_SERVICE_URL),
  proxyReqPathResolver: (req) => `/audit-logs${req.url}`,
}));

// 2. Campaign Service Proxies
router.use('/api/v1/campaigns', proxy(CAMPAIGN_SERVICE_URL, {
  ...proxyOptions(CAMPAIGN_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/campaigns${req.url}`,
}));

router.use('/api/v1/cases', proxy(CAMPAIGN_SERVICE_URL, {
  ...proxyOptions(CAMPAIGN_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/cases${req.url}`,
}));

router.use('/api/v1/feedback', proxy(CAMPAIGN_SERVICE_URL, {
  ...proxyOptions(CAMPAIGN_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/feedback${req.url}`,
}));

router.use('/api/v1/ab-tests', proxy(CAMPAIGN_SERVICE_URL, {
  ...proxyOptions(CAMPAIGN_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/ab-tests${req.url}`,
}));

// Case §8.2: Aboneye özel teklifler → Campaign Service
router.use('/api/v1/subscribers', proxy(CAMPAIGN_SERVICE_URL, {
  ...proxyOptions(CAMPAIGN_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/subscribers${req.url}`,
}));

// 3. AI Service Proxy
router.use('/api/v1/ai', proxy(AI_SERVICE_URL, {
  ...proxyOptions(AI_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/ai${req.url}`,
}));

// 4. Gamification Service Proxy
// Case §8.1: kanonik yol '/api/v1/game/**' → Gamification Service
router.use('/api/v1/game', proxy(GAMIFICATION_SERVICE_URL, {
  ...proxyOptions(GAMIFICATION_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/gamification${req.url}`,
}));

// Geriye dönük uyumluluk için '/api/v1/gamification/**' alias'ı da korunur.
router.use('/api/v1/gamification', proxy(GAMIFICATION_SERVICE_URL, {
  ...proxyOptions(GAMIFICATION_SERVICE_URL),
  proxyReqPathResolver: (req) => `/api/v1/gamification${req.url}`,
}));

module.exports = router;
