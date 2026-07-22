# Campaign Service

Kampanya yönetimi, optimizasyon vakası iş akışı, A/B deneyleri ve abone teklif servisi.

## Port: 3002

## Sorumluluklar
- Kampanya CRUD (DRAFT → PUBLISHED → ARCHIVED)
- **Optimizasyon vakası state machine** (7 durum, geçiş kuralları ve rol kontrolleri)
- SLA takibi ve uyarı sistemi (KRITIK: 2s, YUKSEK: 8s, ORTA: 24s, DUSUK: 72s)
- A/B deney yönetimi ve kazanan belirleme
- Abone teklif gönderme, kabul/red/puanlama
- Redis pub/sub ile gamification-service'e event yayını
- AI-service ile servis-içi iletişim (`scoreCampaignForSubscriber`)

## State Machine (Optimizasyon Vakaları)

```
YENI → ATANDI → OPTIMIZE_EDILIYOR → TEST_EDILIYOR
                                  ↓              ↓
                              TAMAMLANDI    OPTIMIZE_EDILIYOR
                                  ↓
                              YAYINDA → ARSIVLENDI
```

| Geçiş | İzin Verilen Roller |
|-------|---------------------|
| YENI → ATANDI | SUPERVISOR, ADMIN |
| ATANDI → OPTIMIZE_EDILIYOR | CAMPAIGN_EXPERT |
| OPTIMIZE_EDILIYOR → TAMAMLANDI | CAMPAIGN_EXPERT |
| TAMAMLANDI → YAYINDA | SUPERVISOR, ADMIN |
| YAYINDA → ARSIVLENDI | SUPERVISOR, ADMIN |

## Endpointler

| Yöntem | Path | Açıklama |
|--------|------|----------|
| GET/POST | /v1/campaigns | Listele / oluştur |
| GET/PATCH/DELETE | /v1/campaigns/:id | Detay / güncelle / sil |
| POST | /v1/campaigns/:id/publish | Yayınla |
| POST | /v1/campaigns/:id/archive | Arşivle |
| GET | /v1/cases | Vaka listesi (uzman → sadece kendi) |
| GET | /v1/cases/:id | Vaka detayı + notlar |
| PATCH | /v1/cases/:id | Durum geçişi (state machine) |
| POST | /v1/cases/:id/assign | Uzman ata (AI önerisi ile) |
| POST | /v1/cases/:id/complete | Tamamla (note zorunlu) |
| POST | /v1/cases/:id/notes | Not ekle |
| GET | /v1/subscribers | Abone listesi |
| GET | /v1/subscribers/:id | Profil + teklifler |
| POST | /v1/subscribers/:id/offers/:campaignId/accept | Teklif kabul |
| POST | /v1/subscribers/:id/offers/:campaignId/reject | Teklif red |
| POST | /v1/subscribers/:id/offers/:campaignId/rate | Puanla (1-5) |
| GET/POST | /v1/experiments | Deney listesi / oluştur |
| POST | /v1/experiments/:id/conclude | Kazananı belirle |
| GET | /v1/analytics/dashboard | Dashboard metrikleri |
| GET | /v1/analytics/conversion-trend | Dönüşüm trend grafiği |
| GET | /v1/analytics/campaign-distribution | Kampanya dağılımı |
| GET | /v1/analytics/expert-performance | Uzman performansı |
| GET | /v1/analytics/sla-compliance | SLA uyum raporu |
| GET | /v1/analytics/expert-kpis | Uzman KPI'ları |

## Redis Events Yayınları

- `campaign.optimized` — Vaka tamamlandığında
- `campaign.sla_breached` — SLA aşıldığında
- `offer.accepted` — Teklif kabul edildiğinde
- `offer.rejected` — Teklif reddedildiğinde
- `offer.rated` — Teklif puanlandığında
