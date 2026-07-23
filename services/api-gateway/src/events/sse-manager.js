/**
 * SSE Manager — bağlı frontend istemcilerini tutar ve tüm istemcilere olay yayınlar.
 * Hem HTTP /broadcast ucu hem de RabbitMQ köprüsü tarafından ortak kullanılır.
 */

let clients = [];

function addClient(res) {
  const clientId = Date.now() + Math.random();
  clients.push({ id: clientId, res });
  return clientId;
}

function removeClient(clientId) {
  clients = clients.filter((c) => c.id !== clientId);
}

function clientCount() {
  return clients.length;
}

/**
 * Tüm bağlı istemcilere olay yollar.
 * @param {object} event - { type, title, message, ...extra }
 */
function broadcast(event) {
  const payload = `data: ${JSON.stringify({
    type: event.type || 'NOTIFICATION',
    title: event.title || 'Sistem Bildirimi',
    message: event.message || 'Yeni bir olay gerçekleşti.',
    timestamp: new Date().toISOString(),
    ...event,
  })}\n\n`;

  clients.forEach((c) => {
    try {
      c.res.write(payload);
    } catch (_) {
      // yazılamayan istemci bir sonraki temizlemede düşer
    }
  });

  return clients.length;
}

module.exports = { addClient, removeClient, clientCount, broadcast };
