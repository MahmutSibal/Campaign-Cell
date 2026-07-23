/**
 * RabbitMQ → SSE Köprüsü
 * Gateway, olay tabanlı mimarideki bildirim olaylarını dinler ve bağlı frontend
 * istemcilerine gerçek zamanlı (SSE) olarak iletir. Böylece rozet kazanımı, puan,
 * atama ve SLA olayları anında ekrana yansır (Case §6.4: anlık görsel bildirim).
 */
const amqp = require('amqplib');
const sse = require('./sse-manager');

const EXCHANGE = 'campaigncell.events';
const QUEUE = 'q.gateway.sse-notifications';

// Dinlenen olaylar → kullanıcıya gösterilecek bildirim şablonu
const NOTIFICATION_MAP = {
  'badge.earned': (p) => ({
    type: 'BADGE_EARNED',
    title: 'Yeni Rozet Kazanıldı!',
    message: `${p.badge_name || 'Rozet'} kazanıldı.`,
    expertId: p.expert_id,
    badgeCode: p.badge_code,
  }),
  'points.awarded': (p) => ({
    type: 'POINTS_AWARDED',
    title: 'Puan Güncellendi',
    message: `${p.points_added > 0 ? '+' : ''}${p.points_added} puan (${p.reason}). Toplam: ${p.total_points}`,
    expertId: p.expert_id,
    totalPoints: p.total_points,
    level: p.current_level,
  }),
  'campaign.assigned': (p) => ({
    type: 'CASE_ASSIGNED',
    title: 'Yeni Vaka Atandı',
    message: `${p.case_code || 'Vaka'} size atandı.`,
    expertId: p.expert_id,
    caseId: p.case_id,
  }),
  'campaign.optimized': (p) => ({
    type: 'CASE_OPTIMIZED',
    title: 'Optimizasyon Tamamlandı',
    message: `${p.case_code || 'Vaka'} tamamlandı.`,
    expertId: p.expert_id,
    caseId: p.case_id,
  }),
  'sla.breached': (p) => ({
    type: 'SLA_BREACHED',
    title: 'SLA Aşımı!',
    message: `${p.case_code || 'Vaka'} için SLA süresi aşıldı.`,
    expertId: p.assigned_expert_id || p.expert_id,
    caseId: p.case_id,
  }),
};

async function startEventBridge() {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  const bindingKeys = Object.keys(NOTIFICATION_MAP);

  const attempt = async () => {
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });

    for (const key of bindingKeys) {
      await channel.bindQueue(QUEUE, EXCHANGE, key);
    }

    console.log(`[SSE BRIDGE] RabbitMQ bağlandı. '${QUEUE}' dinleniyor: ${bindingKeys.join(', ')}`);

    channel.consume(
      QUEUE,
      (msg) => {
        if (!msg) return;
        try {
          const envelope = JSON.parse(msg.content.toString());
          const routingKey = msg.fields.routingKey;
          const mapper = NOTIFICATION_MAP[routingKey];
          if (mapper) {
            const notification = mapper(envelope.payload || {});
            const count = sse.broadcast(notification);
            console.log(`[SSE BRIDGE] '${routingKey}' → ${count} istemciye iletildi.`);
          }
          channel.ack(msg);
        } catch (err) {
          console.error(`[SSE BRIDGE] Olay işleme hatası: ${err.message}`);
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );

    connection.on('close', () => {
      console.warn('[SSE BRIDGE] RabbitMQ bağlantısı kapandı. 5sn sonra yeniden denenecek.');
      setTimeout(retry, 5000);
    });
    connection.on('error', (e) => console.error(`[SSE BRIDGE] RabbitMQ hatası: ${e.message}`));
  };

  const retry = () => {
    attempt().catch((err) => {
      console.warn(`[SSE BRIDGE] RabbitMQ bağlantısı kurulamadı, 5sn sonra tekrar denenecek: ${err.message}`);
      setTimeout(retry, 5000);
    });
  };

  retry();
}

module.exports = { startEventBridge };
