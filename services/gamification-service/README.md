# CampaignCell — Gamification Service

Gamification Service, kampanya uzmanlarının ve çalışanların motivasyonunu artırmak amacıyla puan, rozet, seviye ve liderlik tablosu (leaderboard) yönetimi sunan olay tabanlı (event-driven) mikroservistir.

## 🚀 Sorumluluklar

- **Olay Tabanlı Mimari (Event-Driven)**: Diğer servislerden gelen RabbitMQ event'lerini dinler, puan ve rozetleri otomatik hesaplar (doğrudan REST çağrısı gerektirmez).
- **Puan Kuralları**:
  - Optimizasyon tamamlandı: **+10 Puan**
  - Hızlı optimizasyon bonusu (2 saatten kısa): **+5 Puan**
  - Dönüşüm hedefi aşıldı: **+15 Puan**
  - KRİTİK vaka SLA içinde tamamlandı: **+15 Puan**
  - SLA aşımı: **-5 Puan**
  - Müşteriden düşük yıldız (1-2 yıldız): **-3 Puan**
- **Rozetler**: `ILK_KAMPANYA`, `HIZ_USTASI`, `DONUSUM_KRALI`, `MARATONCU`, `CHURN_AVCISI`, `UZMAN`.
- **Seviyeler**: `Bronz` (0-499), `Gümüş` (500-1499), `Altın` (1500-2999), `Platin` (3000+).
- **Liderlik Tablosu (Leaderboard)**: Uzmanların toplam puanlarına göre anlık veya günlük/haftalık sıralaması.
- **Idempotency**: Mükerrer puan eklenmesini önlemek için benzersiz `eventId` takibi.

## 📡 API Endpointleri

| Metot | Endpoint | Açıklama |
|---|---|---|
| `GET` | `/api/v1/gamification/health` | Servis sağlık kontrolü |
| `GET` | `/api/v1/gamification/leaderboard` | Liderlik sıralamasını getirir |
| `GET` | `/api/v1/gamification/experts/:expertId/points` | Uzmanın toplam puanını ve seviyesini getirir |
| `GET` | `/api/v1/gamification/experts/:expertId/badges` | Uzmanın kazandığı rozetleri listeler |

## ⚙️ Environment Değişkenleri

```env
PORT=3003
DATABASE_URL=postgresql://campaigncell_user:campaigncell_secret_2026@gamification-db:5432/gamification_db?schema=public
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672
```
