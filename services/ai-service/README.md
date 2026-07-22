# AI Service

Abone-kampanya eşleştirme puanlaması, segment sınıflandırması ve uzman atama servisi.

## Port: 3003

## Sorumluluklar
- **Kendi eğittiğimiz ML modeli**: scikit-learn ile eğitilmiş Logistic Regression modelleri —
  öneri/dönüşüm skorlaması ve segment sınıflandırması (bkz. `training/` ve kök dizindeki
  `AI_APPROACH.md`). Model ağırlıkları `src/ml/model_weights.json`'a export edilir ve saf
  TypeScript ile (`src/ml/mlModel.ts`) çalışma anında Python gerektirmeden inference yapılır.
- Segment sınıflandırma (YUKSEK_DEGER, RISKLI_KAYIP, YENI_ABONE, PASIF, BELIRSIZ)
- Uzman atama: Uzman×Boşluk×Performans formülü (deterministik, ML değil — case'in verdiği formül)
- AI doğruluk takibi ve segment düzeltme (expert override)
- Model ağırlıkları bulunamazsa (`isModelAvailable()` false), eski deterministik ağırlıklı
  formüle (`src/lib/scorer.ts`) otomatik düşer — servis asla çökmez
- Tüm tahminler kalıcı olarak saklanır

## Model Eğitimi

```bash
cd training
pip install -r requirements.txt
python generate_data.py   # sentetik eğitim verisi üretir (subscribers.csv, subscriber_campaign_interactions.csv)
python train_model.py     # scikit-learn ile eğitir, ../src/ml/model_weights.json üretir
```

Detaylı metodoloji, özellik mühendisliği ve doğruluk metrikleri için kök dizindeki `AI_APPROACH.md`.

## Formül (Uzman Atama — deterministik, ML değil)

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
| GET | /v1/ai/model-info | Eğitilmiş ML modelinin metadata'sı (accuracy, eğitim tarihi, örnek sayısı) | Auth |
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
