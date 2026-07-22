# CampaignCell AI Yaklaşımı

## Seçilen Yöntem: Kural Tabanlı Ağırlıklı Skorlama (Hibrit Sezgisel Model)

### Özet

CampaignCell AI Service, gerçek abone davranış verilerini kullanan **belirleyici, açıklanabilir bir hibrit puanlama algoritması** uygular. Saf ML modeli yerine bu yaklaşım seçilmiştir çünkü:

1. Etiketli eğitim verisi miktarı sınırlıdır (demo ortamı)
2. İş kuralları net tanımlıdır (segment eşleşmesi, churn riski, kullanım kalıpları)
3. Açıklanabilirlik, telekomünikasyon sektöründe düzenleyici bir zorunluluktur
4. Demo sırasında gerçek zamanlı çalışabilirlik kritiktir

---

## Görev 1: Öneri Skorlama

### Girdi Özellikleri

| Özellik | Kaynak | Ağırlık | Neden? |
|---|---|---|---|
| `segmentMatch` | Abone segmenti vs kampanya segmenti | 0.30 | Demografik hedefleme en önemli belirleyicidir |
| `churnFactor` | Abone churnRisk + kampanya türü | 0.20 | SADAKAT kampanyaları yüksek churn riskli aboneleri önceliklendirir |
| `valueFactor` | Abone valueScore | 0.20 | Yüksek değerli aboneler daha iyi dönüşüm sağlar |
| `discountAppeal` | Kampanya indirim oranı | 0.15 | İndirim arttıkça çekim artar |
| `usageFactor` | Veri kullanımı veya aylık harcama | 0.15 | Kampanya tipine göre (EK_PAKET → veri kullanımı, TARIFE_YUKSELTME → harcama) |

### Ceza/Bonus Çarpanları

- `historyPenalty`: 5'ten fazla ret → 0.70x, 2'den fazla ret → 0.85x
- `historyBonus`: 3'ten fazla kabul → 1.10x

### Formül

```
rawScore = (segmentMatch × 0.30) + (churnFactor × 0.20) +
           (valueFactor × 0.20) + (discountAppeal × 0.15) +
           (usageFactor × 0.15)

recommendationScore = clamp(rawScore × historyPenalty × historyBonus, 0, 1)

conversionProbability = recommendationScore × (1 - churnRisk × 0.25) × (valueScore × 0.40 + 0.60)
```

### Örnek Hesaplama

```
Abone: churnRisk=0.72, valueScore=0.65, dataUsageGb=45, segment=RISKLI_KAYIP
Kampanya: type=SADAKAT, discount=35%, segment=RISKLI_KAYIP

segmentMatch  = 1.00 (tam eşleşme)
churnFactor   = min(0.72 × 1.2, 1.0) = 0.864 (SADAKAT kampanyası)
valueFactor   = 0.65
discountAppeal= min(35/100 × 1.1, 1.0) = 0.385
usageFactor   = 0.60 (SADAKAT tipi için sabit)

rawScore = 1.00×0.30 + 0.864×0.20 + 0.65×0.20 + 0.385×0.15 + 0.60×0.15
         = 0.300 + 0.173 + 0.130 + 0.058 + 0.090 = 0.751

historyPenalty = 1.00 (2 ret)
historyBonus   = 1.00 (1 kabul)

recommendationScore = 0.751 ✓ (> 0.60 → abone ekrana çıkar)
conversionProbability = 0.751 × (1 - 0.72×0.25) × (0.65×0.40 + 0.60) = 0.751 × 0.82 × 0.86 = 0.529
```

### Gösterim Eşiği

| Skor | Eylem |
|---|---|
| < 0.60 | Aboneye gösterilmez |
| 0.60 – 0.79 | Standart gösterim |
| ≥ 0.80 | Öncelikli / öne çıkan gösterim |

---

## Görev 2: Segment Sınıflandırma

### Karar Ağacı

```
churnRisk > 0.85  →  RISKLI_KAYIP (KRITIK öncelik)
churnRisk > 0.55  →  RISKLI_KAYIP (YUKSEK öncelik)
monthlySpend > 250 AND valueScore > 0.70  →  YUKSEK_DEGER (ORTA)
monthlySpend < 50 AND dataUsageGb < 5 AND voiceMinutes < 100  →  PASIF (DUSUK)
acceptedCampaigns == 0 AND rejectedCampaigns == 0  →  YENI_ABONE (DUSUK)
Diğer  →  BELIRSIZ (DUSUK)
```

### Doğruluk Takibi

Personel veya süpervizör AI'ın atadığı segmenti değiştirdiğinde bu "yanlış sınıflandırma" olarak kaydedilir.

```
Doğruluk = (totalPredictions - misclassified) / totalPredictions × 100
```

Segment bazlı kırılım da hesaplanır: hangi segment tipinde ne kadar isabetli?

---

## Görev 3: Akıllı Uzman Ataması

Case dokümanından alınan formül:

```
skor = (uzmanlık_eşleşme × 0.50) + (boşluk_oranı × 0.30) + (performans × 0.20)

uzmanlık_eşleşme = expert.specializations.includes(caseSegment) ? 1.0 : 0.0
boşluk_oranı     = 1 - (activeCases / maxCapacity)      [maxCapacity = 10]
performans        = min(avgConversionLift × 5, 1.0)       [normalized 0–1]
```

Kapasite dolu (activeCases >= maxCapacity) uzmanlara skor = -1 atanır (seçilmez).

---

## Sınırlılıklar ve Gelecek İyileştirmeler

### Mevcut Sınırlılıklar

1. Özellikler arası etkileşimler (interaction terms) modellenmemiştir
2. Zaman serisi verileri (mevsimsellik, hafta içi/sonu) kullanılmamaktadır
3. Kampanya yorgunluğu (aynı aboneye çok sık teklif) henüz modellenmemiştir

### Planlanan ML Genişletmesi

```python
# Minimum 100 örnek ile scikit-learn Gradient Boosting modeli
from sklearn.ensemble import GradientBoostingClassifier

features = ['churn_risk', 'value_score', 'monthly_spend', 'data_usage_gb',
            'voice_minutes', 'segment_match', 'campaign_discount',
            'accepted_campaigns', 'rejected_campaigns']
target = 'accepted'  # 1 = kabul, 0 = ret

model = GradientBoostingClassifier(n_estimators=100, max_depth=4)
model.fit(X_train, y_train)
```

Eğitim verisi: `services/ai-service/training/subscriber_campaign_interactions.csv` (150 gerçekçi örnek, AI araçları ile üretilmiştir)
