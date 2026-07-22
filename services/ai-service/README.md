# AI Service

Abone-kampanya eşleştirme puanlaması, segment sınıflandırması ve uzman atama servisi.

## Port: 3003

## Sorumluluklar
- **Deterministic scoring**: Ağırlıklı formül ile öneri skoru hesaplama (rastgele veri YOK)
- Segment sınıflandırma (YUKSEK_DEGER, RISKLI_KAYIP, YENI_ABONE, PASIF, BELIRSIZ)
- Uzman atama: Uzman×Boşluk×Performans formülü
- AI doğruluk takibi ve segment düzeltme (expert override)
- Tüm tahminler kalıcı olarak saklanır

## Formül (Ağırlıklı Scoring)

```
rawScore = segmentMatch(0.30) + churnFactor(0.20) + valueFactor(0.20)
         + discountAppeal(0.15) + usageFactor(0.15)

recommendationScore = rawScore × historyPenalty × historyBonus

conversionProbability = recommendationScore × (1 - churnRisk×0.25) × (valueScore×0.40 + 0.60)
```

## Uzman Atama Formülü

```
uzmanlıkEşleşme × 0.5 + boşlukOranı × 0.3 + performans × 0.2
```

## Endpointler

| Yöntem | Path | Açıklama | Yetki |
|--------|------|----------|-------|
| POST | /v1/ai/recommend | Kampanya öneri skoru hesapla | Auth / Service |
| POST | /v1/ai/predict | Öneri skoru (alias) | Auth / Service |
| GET | /v1/ai/predictions | Tüm tahminleri listele | SUPERVISOR/ADMIN |
| GET | /v1/ai/accuracy | Model doğruluk raporu (segment bazlı) | SUPERVISOR/ADMIN |
| POST | /v1/ai/expert-assignment | Vakaya en uygun uzmanı bul | Auth / Service |
| PATCH | /v1/ai/segment-override | AI sınıflandırmasını düzelt | CAMPAIGN_EXPERT/SUPERVISOR |
| GET | /healthz | Sağlık kontrolü | Public |

## Service-to-Service Erişimi

Campaign-service bu servisi `X-Service-Token` header'ı ile çağırır:
```http
X-Service-Token: campaigncell-internal-2026
```

## Örnek İstek

```json
POST /v1/ai/recommend
{
  "subscriberProfile": {
    "monthlySpend": 350,
    "dataUsageGb": 65,
    "voiceMinutes": 1200,
    "churnRisk": 0.72,
    "valueScore": 0.85,
    "acceptedCampaigns": 3,
    "rejectedCampaigns": 1,
    "segment": "RISKLI_KAYIP",
    "tariff": "Süper 30GB"
  },
  "campaignProfile": {
    "type": "SADAKAT",
    "discount": 25,
    "segment": "RISKLI_KAYIP"
  }
}
```

## Ortam Değişkenleri

```
PORT=3003
DATABASE_URL=postgresql://postgres:postgres@postgres-ai:5432/ai_db
JWT_SECRET=change-me-in-production
SERVICE_TOKEN=campaigncell-internal-2026
```
