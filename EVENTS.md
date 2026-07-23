# CampaignCell — Olay Tabanlı Mimari Dokümanı (EVENTS.md)

CampaignCell mikroservis ekosistemi, servisler arası gevşek bağlılığı (loose coupling) ve yüksek ölçeklenebilirliği sağlamak amacıyla asenkron event-driven mimari (RabbitMQ) kullanır.

## 📡 Event Exchange ve Queue Mimarisi

- **Exchange Name**: `campaign_events` (Topic Exchange)
- **Queues**:
  - `q.campaign.ai-events`: Campaign Service dinler
  - `q.ai.campaign-events`: AI Service dinler
  - `q.gamification.campaign-events`: Gamification Service dinler

---

## 📋 Tanımlı Event Listesi & Payload Yapıları

### 1. `campaign.created`
- **Yayınlayan**: Campaign Service
- **Dinleyen**: AI Service
- **Açıklama**: Yeni bir kampanya oluşturulduğunda tetiklenir. AI servisi aboneye özel öneri skorlamasını başlatır.

```json
{
  "event_type": "campaign.created",
  "timestamp": "2026-07-22T20:00:00Z",
  "payload": {
    "campaign_id": "c1a23456-0000-0000-0000-000000000001",
    "campaign_code": "CMP-2026-000101",
    "name": "Yüksek Değerli Abone 20GB Ek Paket",
    "type": "EK_PAKET",
    "target_segment": "YUKSEK_DEGER",
    "discount_percent": 30
  }
}
```

---

### 2. `ai.prediction.created`
- **Yayınlayan**: AI Service
- **Dinleyen**: Campaign Service
- **Açıklama**: AI servisi bir vaka için tahmin ürettiğinde fırlatır.

```json
{
  "event_type": "ai.prediction.created",
  "timestamp": "2026-07-22T20:00:01Z",
  "payload": {
    "prediction_id": "p9876543-0000-0000-0000-000000000001",
    "subscriber_id": "sub-1001",
    "campaign_id": "c1a23456-0000-0000-0000-000000000001",
    "recommendation_score": 0.885,
    "conversion_probability": 0.820,
    "predicted_segment": "YUKSEK_DEGER",
    "predicted_priority": "YUKSEK",
    "recommended_expert_id": "a7f30000-0000-0000-0000-000000000001"
  }
}
```

---

### 3. `segment.changed` (AI Feedback Loop)
- **Yayınlayan**: Campaign Service
- **Dinleyen**: AI Service
- **Açıklama**: Uzman veya Süpervizör AI'ın atadığı segmenti override ettiğinde tetiklenir. AI servisi bunu 'yanlış sınıflandırma' olarak kaydeder.

```json
{
  "event_type": "segment.changed",
  "timestamp": "2026-07-22T20:05:00Z",
  "payload": {
    "case_id": "case-001",
    "original_segment": "YENI_ABONE",
    "corrected_segment": "RISKLI_KAYIP",
    "corrected_by": "supervisor@turkcell.com.tr"
  }
}
```

---

### 4. `campaign.optimized`
- **Yayınlayan**: Campaign Service
- **Dinleyen**: Gamification Service
- **Açıklama**: Uzman optimizasyon vakasını `TAMAMLANDI` durumuna getirdiğinde fırlatılır. Puan ve rozet motoru tetiklenir.

```json
{
  "event_type": "campaign.optimized",
  "timestamp": "2026-07-22T20:10:00Z",
  "payload": {
    "case_id": "case-001",
    "expert_id": "a7f30000-0000-0000-0000-000000000001",
    "priority": "KRITIK",
    "duration_minutes": 45,
    "target_exceeded": true,
    "sla_breached": false
  }
}
```

---

### 5. `sla.warning` & `sla.breached`
- **Yayınlayan**: Campaign Service (Cron görevi)
- **Dinleyen**: Gamification Service, AI Service
- **Açıklama**: SLA dolumuna %20 kaldığında veya dolduğunda fırlatılır.

```json
{
  "event_type": "sla.breached",
  "timestamp": "2026-07-22T20:15:00Z",
  "payload": {
    "case_id": "case-002",
    "case_code": "CMP-2026-000102",
    "assigned_expert_id": "a7f30000-0000-0000-0000-000000000001",
    "priority": "KRITIK",
    "sla_deadline": "2026-07-22T20:00:00Z"
  }
}
```

---

### 6. `subscriber.offer.accepted` & `subscriber.offer.rejected`
- **Yayınlayan**: Campaign Service
- **Dinleyen**: AI Service, Gamification Service
- **Açıklama**: Abone teklifi kabul/ret ettiğinde fırlatılır. AI abonenin geçmiş kabul sayısını günceller.
