# CampaignCell — Turkcell CodeNight 2026 Final Submission

Turkcell aboneleri için akıllı kampanya optimizasyon platformu. Mikro servis mimarisi, AI destekli öneri sistemi ve gamification ile kampanya yönetimini dönüştürür.

## Sistem Mimarisi

```
                        ┌─────────────────────┐
                        │   nginx Gateway      │
                        │     :3000            │
                        │  Rate Limiting       │
                        │  Security Headers    │
                        └─────────┬───────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
 ┌────────────────┐    ┌────────────────────┐   ┌────────────────────┐
 │identity-service│    │ campaign-service   │   │    ai-service      │
 │    :3001       │    │     :3002          │   │      :3003         │
 │                │    │                   │   │                    │
 │ Auth + JWT     │    │ Campaigns         │   │ Weighted Scoring   │
 │ Lockout 5/15m  │    │ State Machine     │   │ Segment Classify   │
 │ Token Rotation │    │ A/B Experiments   │   │ Expert Assignment  │
 │ Audit Logs     │    │ SLA Tracking      │   │ Accuracy Tracking  │
 │ Password Policy│    │ AI Integration    │   │                    │
 └───────┬────────┘    └────────┬──────────┘   └────────────────────┘
         │                      │
         │             ┌────────▼──────────┐   ┌────────────────────┐
         │             │   Redis Pub/Sub   │──▶│gamification-service│
         │             │                   │   │      :3004         │
         │             └───────────────────┘   │                    │
         │                                     │ Points Engine      │
         │                                     │ Badge Engine       │
         │                                     │ Leaderboard        │
         │                                     └────────────────────┘
         │
 ┌───────▼──────────────────────────────────────────────────────────┐
 │              React Frontend (Vite)                               │
 │              artifacts/campaigncell → /                          │
 └──────────────────────────────────────────────────────────────────┘
```

## Servisler

| Servis | Port | Veritabanı | Sorumluluk |
|--------|------|------------|------------|
| `identity-service` | 3001 | `identity_db` | Auth, kullanıcılar, roller, audit, hesap kilidi |
| `campaign-service` | 3002 | `campaign_db` | Kampanyalar, vakalar, aboneler, deneyler, analitik |
| `ai-service` | 3003 | `ai_db` | Puanlama, segment sınıflandırma, uzman atama |
| `gamification-service` | 3004 | `gamification_db` | Puanlar, rozetler, liderlik tablosu |
| `gateway` (nginx) | 3000 | — | Yönlendirme, rate limiting, güvenlik başlıkları |

## Hızlı Başlangıç (Docker Compose)

```bash
# Tüm servisleri başlat
docker compose up -d

# Logları izle
docker compose logs -f

# Seed (tüm veritabanlarını doldur)
docker compose exec identity-service npm run seed
docker compose exec ai-service npm run seed
docker compose exec campaign-service npm run seed
docker compose exec gamification-service npm run seed

# Durdur ve temizle
docker compose down -v
```

## Demo Kimlik Bilgileri

| Kullanıcı | Email | Şifre | Rol |
|-----------|-------|-------|-----|
| System Admin | admin@turkcell.com.tr | Demo1234! | ADMIN |
| Admin 2 | admin2@turkcell.com.tr | Demo1234! | ADMIN |
| Supervisor | burak.supervisor@turkcell.com.tr | Demo1234! | SUPERVISOR |
| Expert (Ahmet) | ahmet.expert@turkcell.com.tr | Demo1234! | CAMPAIGN_EXPERT |
| Expert (Ayşe) | ayse.expert@turkcell.com.tr | Demo1234! | CAMPAIGN_EXPERT |
| Subscriber | GSM: 05350000000 | OTP: 1234 | SUBSCRIBER |

## API Endpoint Özeti

### Gateway URL'leri (port 3000)

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
POST   /api/v1/auth/request-otp

GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id

GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/publish
POST   /api/v1/campaigns/:id/archive

GET    /api/v1/cases
GET    /api/v1/cases/:id
PATCH  /api/v1/cases/:id
POST   /api/v1/cases/:id/assign
POST   /api/v1/cases/:id/complete
POST   /api/v1/cases/:id/notes

POST   /api/v1/ai/recommend
GET    /api/v1/ai/accuracy
POST   /api/v1/ai/expert-assignment
PATCH  /api/v1/ai/segment-override

GET    /api/v1/game/leaderboard?period=daily|weekly
GET    /api/v1/game/profile/:userId
GET    /api/v1/game/badges
GET    /api/v1/game/points-history/:userId

GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/conversion-trend
GET    /api/v1/analytics/expert-performance
GET    /api/v1/analytics/sla-compliance
```

## Swagger / OpenAPI

- Campaign Service: `docs/openapi-campaign.yaml`
- AI Service: `docs/openapi-ai.yaml`

## Mimari Kararlar

### Güvenlik
- **Hesap kilidi**: 5 başarısız giriş → 15 dakika otomatik kilit (`identity-service`)
- **Token güvenliği**: Refresh token rotasyonu; iptal edilmiş token yeniden kullanılırsa tüm oturumlar sonlanır
- **Şifre politikası**: 8+ karakter, büyük harf, rakam, özel karakter zorunlu
- **Rate limiting**: Auth 10r/15dk, API 200r/dk (nginx + express-rate-limit)
- **Service token**: Servisler arası iletişim `X-Service-Token` header ile korunur

### AI / Scoring
Rastgele veri kullanılmamaktadır. Tüm puanlar deterministic ağırlıklı formül ile hesaplanır:
- **Öneri skoru**: Segment uyumu (0.30) + Churn faktörü (0.20) + Değer skoru (0.20) + İndirim çekiciliği (0.15) + Kullanım uyumu (0.15)
- **Uzman atama**: Uzmanlık eşleşme (0.5) + Boşluk oranı (0.3) + Geçmiş performans (0.2)

### State Machine
Optimizasyon vakaları 7 durumlu state machine ile yönetilir. Geçersiz geçişler `422` döner.

### Event-Driven Architecture
Campaign-service → Redis → Gamification-service arası async iletişim. Redis yoksa sistema çalışmaya devam eder (graceful degradation).

## Proje Yapısı

```
.
├── docker-compose.yml          # 9 konteyner: 4 PG, Redis, 4 servis, nginx
├── services/
│   ├── gateway/
│   │   ├── nginx.conf
│   │   └── Dockerfile
│   ├── identity-service/       # Port 3001
│   ├── campaign-service/       # Port 3002
│   ├── ai-service/             # Port 3003
│   └── gamification-service/   # Port 3004
├── artifacts/
│   ├── campaigncell/           # React frontend (Replit preview)
│   └── api-server/             # Legacy API (Replit preview)
├── docs/
│   ├── openapi-campaign.yaml
│   └── openapi-ai.yaml
├── EVENTS.md                   # Redis event mimarisi
├── AI_APPROACH.md              # AI metodoloji belgesi
└── README.md
```
