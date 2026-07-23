require('dotenv').config();
const app = require('./app');
const { startEventBridge } = require('./events/event-bridge');

const port = process.env.API_GATEWAY_PORT || process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`===========================================`);
  console.log(`CampaignCell API Gateway running on port ${port}`);
  console.log(`Aggregated Health Check: http://localhost:${port}/health`);
  console.log(`===========================================`);

  // RabbitMQ → SSE köprüsünü başlat (gerçek zamanlı bildirimler)
  startEventBridge();
});
