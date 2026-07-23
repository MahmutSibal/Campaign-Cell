import os
import json
import time
import uuid
import logging
import threading
import pika
from datetime import datetime, timezone

logger = logging.getLogger("AIServiceRabbitMQ")


class RabbitMQManager:
    """
    AI Service RabbitMQ yöneticisi.

    ÖNEMLİ: pika BlockingConnection thread-safe DEĞİLDİR. Bu yüzden publisher (HTTP istek
    thread'leri) ile consumer (arka plan thread) AYRI bağlantılar kullanır. Aksi halde aynı
    kanalın iki thread'den kullanılması bağlantıyı bozar (IndexError: pop from empty deque)
    ve consumer çöker. Publisher ayrıca bir kilit (lock) ile korunur.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RabbitMQManager, cls).__new__(cls)
            cls._instance.exchange = "campaigncell.events"
            cls._instance.queue_name = "q.ai.campaign-events"
            cls._instance._pub_conn = None
            cls._instance._pub_channel = None
            cls._instance._pub_lock = threading.Lock()
        return cls._instance

    def _url(self):
        return os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672")

    # ==========================================================
    # PUBLISHER (HTTP thread'lerinden çağrılır — kilitli, ayrı bağlantı)
    # ==========================================================
    def _ensure_publisher(self):
        if self._pub_conn is not None and self._pub_conn.is_open:
            return
        parameters = pika.URLParameters(self._url())
        self._pub_conn = pika.BlockingConnection(parameters)
        self._pub_channel = self._pub_conn.channel()
        self._pub_channel.exchange_declare(exchange=self.exchange, exchange_type="topic", durable=True)

    def connect(self):
        """Geriye dönük uyumluluk: publisher bağlantısını kurar."""
        try:
            self._ensure_publisher()
            return True
        except Exception as e:
            logger.warning(f"RabbitMQ publisher bağlantısı kurulamadı: {e}")
            return False

    def publish_event(self, event_type: str, payload: dict):
        envelope = {
            "event_type": event_type,
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "ai-service",
            "version": "1.0",
            "payload": payload,
        }
        with self._pub_lock:
            try:
                self._ensure_publisher()
                self._pub_channel.basic_publish(
                    exchange=self.exchange,
                    routing_key=event_type,
                    body=json.dumps(envelope),
                    properties=pika.BasicProperties(delivery_mode=2, content_type="application/json"),
                )
                logger.info(f"Event [{event_type}] başarıyla yayınlandı.")
                return True
            except Exception as e:
                logger.error(f"Event [{event_type}] yayınlama hatası: {e}")
                # Bağlantıyı sıfırla → sonraki çağrı yeniden bağlanır.
                try:
                    if self._pub_conn and self._pub_conn.is_open:
                        self._pub_conn.close()
                except Exception:
                    pass
                self._pub_conn = None
                self._pub_channel = None
                return False

    def publish_recovered_event(self):
        """AI Servisi ayağa kalktığında Campaign Service'i bilgilendirir (ai.service.recovered)."""
        return self.publish_event("ai.service.recovered", {
            "service": "ai-service",
            "status": "UP",
            "recovered_at": datetime.now(timezone.utc).isoformat(),
            "message": "AI Servisi aktif. Manuel optimizasyon bekleyen kampanyalar işlenebilir."
        })

    # ==========================================================
    # CONSUMER (arka plan thread — KENDİ bağlantısı + otomatik reconnect)
    # ==========================================================
    def start_consumer(self, callback_handler):
        binding_keys = [
            "campaign.created",
            "campaign.optimization.required",
            "segment.changed",
            "subscriber.offer.#",
        ]

        def _on_message(ch, method, properties, body):
            try:
                data = json.loads(body)
                callback_handler(method.routing_key, data)
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as err:
                logger.error(f"Mesaj işleme hatası: {err}")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        def _consume():
            while True:
                try:
                    conn = pika.BlockingConnection(pika.URLParameters(self._url()))
                    channel = conn.channel()
                    channel.exchange_declare(exchange=self.exchange, exchange_type="topic", durable=True)
                    channel.queue_declare(queue=self.queue_name, durable=True)
                    for key in binding_keys:
                        channel.queue_bind(exchange=self.exchange, queue=self.queue_name, routing_key=key)
                    logger.info(f"RabbitMQ consumer bağlandı. Queue '{self.queue_name}' dinleniyor.")
                    channel.basic_consume(queue=self.queue_name, on_message_callback=_on_message)
                    channel.start_consuming()
                except Exception as e:
                    logger.warning(f"RabbitMQ consumer koptu, 5 sn sonra yeniden bağlanılıyor: {e}")
                    time.sleep(5)

        thread = threading.Thread(target=_consume, daemon=True)
        thread.start()
