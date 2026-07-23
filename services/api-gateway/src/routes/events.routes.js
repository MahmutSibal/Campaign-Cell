const express = require('express');
const router = express.Router();
const sse = require('../events/sse-manager');

/**
 * GET /api/v1/events/stream — Server-Sent Events (SSE) stream endpoint
 */
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = sse.addClient(res);
  console.log(`[SSE GATEWAY] New client connected. ID: ${clientId} (Total: ${sse.clientCount()})`);

  // Send initial handshake event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'CampaignCell Real-time Event Stream Connected', timestamp: new Date().toISOString() })}\n\n`);

  // Keep-alive ping every 15s
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sse.removeClient(clientId);
    console.log(`[SSE GATEWAY] Client disconnected. ID: ${clientId} (Total: ${sse.clientCount()})`);
  });
});

/**
 * POST /api/v1/events/broadcast — Microservices/demo can POST events here to broadcast to all frontend clients
 */
router.post('/broadcast', express.json(), (req, res) => {
  const event = req.body || {};
  const count = sse.broadcast(event);
  console.log(`[SSE GATEWAY] Broadcasting event '${event.type || 'NOTIFICATION'}' to ${count} clients`);
  res.json({ success: true, data: { broadcastedTo: count }, error: null });
});

module.exports = router;
