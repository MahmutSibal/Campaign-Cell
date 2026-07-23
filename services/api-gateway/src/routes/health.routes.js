const express = require('express');
const router = express.Router();
const http = require('http');

const checkServiceHealth = (url) => {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'GET',
          timeout: 2000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              resolve({ status: res.statusCode === 200 ? 'UP' : 'DEGRADED', detail: data });
            } catch {
              resolve({ status: res.statusCode === 200 ? 'UP' : 'DEGRADED' });
            }
          });
        },
      );

      req.on('error', () => resolve({ status: 'DOWN', error: 'Bağlantı kurulamadı' }));
      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'TIMEOUT', error: 'Zaman aşımı' });
      });
      req.end();
    } catch (err) {
      resolve({ status: 'DOWN', error: err.message });
    }
  });
};

router.get('/health', async (req, res) => {
  const identityUrl = process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
  const campaignUrl = process.env.CAMPAIGN_SERVICE_URL || 'http://localhost:3002';
  const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const gamificationUrl = process.env.GAMIFICATION_SERVICE_URL || 'http://localhost:3003';

  const [identityHealth, campaignHealth, aiHealth, gamificationHealth] = await Promise.all([
    checkServiceHealth(`${identityUrl}/api/v1/health`),
    checkServiceHealth(`${campaignUrl}/api/v1/health`),
    checkServiceHealth(`${aiUrl}/api/v1/ai/health`),
    checkServiceHealth(`${gamificationUrl}/api/v1/gamification/health`),
  ]);

  const services = {
    identity: { url: identityUrl, ...identityHealth },
    campaign: { url: campaignUrl, ...campaignHealth },
    ai: { url: aiUrl, ...aiHealth },
    gamification: { url: gamificationUrl, ...gamificationHealth },
  };

  const allUp = Object.values(services).every((s) => s.status === 'UP');
  const anyDown = Object.values(services).some((s) => s.status === 'DOWN');

  let overallStatus = 'UP';
  if (anyDown) overallStatus = 'DEGRADED';

  res.status(200).json({
    status: overallStatus,
    service: 'API Gateway',
    timestamp: new Date().toISOString(),
    services,
  });
});

module.exports = router;
