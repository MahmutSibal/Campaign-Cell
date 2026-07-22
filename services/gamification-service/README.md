# Gamification Service

Puan sistemi, rozet yönetimi, liderlik tablosu ve Redis event tüketici servisi.

## Port: 3004

## Sorumluluklar
- Redis pub/sub ile async event tüketimi (campaign.optimized, campaign.sla_breached, offer.rated)
- Puan motoru: vaka tipi, hız bonusu, dönüşüm hedefi, segment bazlı bonus
- Rozet motoru: idempotent kontrol ile 8 rozet türü
- Seviye hesabı: BRONZ → GÜMÜŞ → ALTIN → PLATIN
- Günlük/Haftalık liderlik tablosu

## Puan Kuralları (Case: `campaign.optimized`)

| Kural | Puan |
|-------|------|
| Vaka tamamlama | +10 |
| Hızlı tamamlama (<2 saat) | +5 |
| Dönüşüm hedefi aşımı (>%15 lift) | +15 |
| Kritik vaka SLA içinde | +15 |
| SLA aşımı | -5 |
| Abone düşük puan (1-2/5) | -3 |

## Seviyer

| Seviye | Puan Eşiği |
|--------|------------|
| BRONZ | 0 |
| GÜMÜŞ | 500 |
| ALTIN | 1500 |
| PLATIN | 3000 |

## Rozetler

| ID | İsim | Koşul |
|----|------|-------|
| ilk-kampanya | İlk Kampanya 🏆 | completedCases ≥ 1 |
| hiz-ustasi | Hız Ustası ⚡ | fastCompletions ≥ 10 |
| donusum-krali | Dönüşüm Kralı 👑 | conversionTargetHits ≥ 10 |
| maratoncu | Maratoncu 🏃 | 24 saatte 20+ optimizasyon |
| churn-avcisi | Churn Avcısı 🎯 | churnCasesResolved ≥ 10 |
| uzman | Uzman 🌟 | completedCases ≥ 50 |
| guvenilir | Güvenilir 🛡️ | completedCases ≥ 100 |
| efsane | Efsane ⭐ | totalPoints ≥ 3000 |

## Endpointler

| Yöntem | Path | Açıklama |
|--------|------|----------|
| GET | /v1/game/leaderboard?period=daily\|weekly | Liderlik tablosu |
| GET | /v1/game/profile/:userId | Profil + rozetler + sıralama |
| GET | /v1/game/badges | Tüm rozetler |
| GET | /v1/game/points-history/:userId | Puan geçmişi |

## Redis Kanalları (Dinlenen)

- `campaign.optimized` → `handleCampaignOptimized()`
- `campaign.sla_breached` → `handleSlaBreached()`
- `offer.rated` → `handleOfferRated()`
