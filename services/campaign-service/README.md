# CampaignCell — Campaign Service

Campaign Service, kampanya oluşturma, optimizasyon vakaları yaşam döngüsü (state machine), SLA takibi, A/B testi ve müşteri geri bildirimlerinin yönetildiği çekirdek iş mantığı mikroservisidir.

## 🚀 Sorumluluklar

- **Kampanya Yönetimi**: Kampanya oluşturma (CMP-2026-XXXXXX kod üretimi), tip belirleme (`EK_PAKET`, `TARIFE_YUKSELTME`, `CIHAZ_FIRSATI`, `SADAKAT`), indirim oranı ve hedef segment tanımlama.
- **Optimizasyon Vakası Yaşam Döngüsü (State Machine)**:
  - Durumlar: `YENI` → `ATANDI` → `OPTIMIZE_EDILIYOR` → `TEST_EDILIYOR` → `TAMAMLANDI` → `YAYINDA` → `ARSIVLENDI`.
  - Kural dışı durum geçişlerinde HTTP 422 Unprocessable Entity döner.
- **SLA Takibi**:
  - `KRITIK`: 2 Saat
  - `YUKSEK`: 8 Saat
  - `ORTA`: 24 Saat
  - `DUSUK`: 72 Saat
  - SLA dolumuna %20 kala uyarır (`sla.warning`), süre dolduğunda ihlal olarak işaretler (`sla.breached`).
- **Segment Override & AI Feedback Loop**: Süpervizör veya Uzman segment değiştirdiğinde AI servisine RabbitMQ üzerinden haber verilir.
- **A/B Testi & Feedback**: Kampanyalar için A/B testi varyant sonuçları saklanır; abone kabul/ret ve 1-5 yıldız memnuniyet puanları kaydolur.

## 📡 API Endpointleri

| Metot | Endpoint | Yetki | Açıklama |
|---|---|---|---|
| `POST` | `/api/v1/campaigns` | Uzman, Süpervizör, Admin | Yeni kampanya oluşturur (AI servisine event atar) |
| `GET` | `/api/v1/campaigns` | Auth | Tüm kampanyaları listeler |
| `GET` | `/api/v1/campaigns/:id` | Auth | Kampanya detayını getirir |
| `GET` | `/api/v1/cases` | Auth | Optimizasyon vakalarını listeler |
| `POST` | `/api/v1/cases/:id/assign` | Süpervizör, Admin | Vakaya uzman atar |
| `PATCH` | `/api/v1/cases/:id/status` | Uzman, Süpervizör | Vaka durumunu günceller (State Machine) |
| `PATCH` | `/api/v1/cases/:id/segment` | Uzman, Süpervizör | Segment override yapar (AI'a bildirilir) |
| `POST` | `/api/v1/feedback` | Abone | Teklif yanıtı (Kabul/Red) ve memnuniyet puanı verir |
| `POST` | `/api/v1/ab-tests` | Uzman, Süpervizör | A/B test varyant sonuçlarını kaydeder |

## ⚙️ Environment Değişkenleri

```env
PORT=3002
DATABASE_URL=postgresql://campaigncell_user:campaigncell_secret_2026@campaign-db:5432/campaign_db?schema=public
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
```
