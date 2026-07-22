# CampaignCell AI Yaklaşımı

## Seçilen Yöntem: Kendi Eğittiğimiz Klasik ML Modeli (scikit-learn)

### Özet

AI Service artık **kendi eğittiğimiz iki scikit-learn modeli** üzerinden çalışır:

1. **Segment sınıflandırıcı** — çok sınıflı (multinomial) Logistic Regression
2. **Dönüşüm/öneri tahmincisi** — ikili (binary) Logistic Regression

Her iki model de gerçekçi, sentetik olarak üretilmiş bir eğitim verisiyle
(`services/ai-service/training/`) eğitilmiştir ve ağırlıkları
`services/ai-service/src/ml/model_weights.json` dosyasına export edilmiştir.
AI Service Node/TypeScript olduğu ve Docker imajında Python çalışma zamanı
bulunmadığı için, model ağırlıkları saf TypeScript ile
(`services/ai-service/src/ml/mlModel.ts`) inference edilir — StandardScaler
standardizasyonu + softmax/sigmoid matematiği, eğitimde kullanılanla birebir
aynı şekilde yeniden uygulanmıştır. Böylece ne bir ONNX runtime'a ne bir
Python sidecar konteynerine ihtiyaç var; eğitilen model ile production'da
çalışan model arasında hiçbir sürüklenme (drift) riski yok.

**Neden linear (Logistic Regression) model?** Ağaç tabanlı modeller (Random
Forest, Gradient Boosting) muhtemelen daha yüksek doğruluk verirdi, ama
ağırlıklarını saf JS'te yeniden üretmek çok daha fazla kod gerektirir (tüm
ağaç yapısını JSON'a export edip generic bir tree-traversal yazmak gerekir).
Logistic Regression'ın parametreleri (özellik ortalaması/ölçeği, ağırlık
matrisi, intercept) tek bir düz JSON'a export edilip ~30 satırlık bir
softmax/sigmoid fonksiyonuyla tam olarak yeniden üretilebiliyor — bu
projenin zaman kısıtları içinde doğruluk/taşınabilirlik dengesinde bilinçli
bir tercih.

**Model yoksa ne olur?** `isModelAvailable()` `false` dönerse (örn. ağırlık
dosyası bir şekilde eksikse), servis otomatik olarak eski deterministik
ağırlıklı formüle (aşağıda "Yedek Mekanizma" bölümünde) düşer — hiçbir zaman
çökmez veya sabit/mock bir değer döndürmez. Bu normal koşullarda tetiklenmez
çünkü ağırlıklar repository'ye commit edilmiştir.

---

## Eğitim Verisi

Gerçek Turkcell abone/kampanya geçmişi bir hackathon projesi için mevcut
olmadığından, `services/ai-service/training/generate_data.py` gerçekçi
dağılımlarla **sentetik ama tutarlı** bir veri seti üretir:

- **`subscribers.csv`** (3000 satır) — abone profilleri (aylık harcama,
  veri/dakika kullanımı, churn riski, değer skoru, kabul/ret geçmişi,
  tarife) + segment etiketi.
- **`subscriber_campaign_interactions.csv`** (~6000 satır) — her abone için
  1-3 rastgele kampanya eşleştirmesi + kabul/ret sonucu + (kabul edilmişse)
  1-5 yıldız puan.

**Etiketler nasıl üretildi?** Gerçek geçmiş veri olmadığı için etiketler
(segment, kabul/ret), yorumlanabilir özelliklere dayalı bir "gerçek olasılık"
fonksiyonundan + eklenen Gauss gürültüsünden (segment için) ve Bernoulli
örneklemesinden (kabul/ret için) üretildi. Bu bilinçli bir tasarım kararı:
etiket, özelliklerin **deterministik birebir fonksiyonu değil**, gürültülü/
olasılıksal bir fonksiyonu — böylece eğitilen model bir formülü ezberlemek
yerine gerçekten genelleştirilebilir bir örüntü öğrenmek zorunda kalıyor.
Segment etiketleri, mevcut kural tabanlı sınıflandırıcının (`scorer.ts`)
eşiklerinin **aynısı değil**, kasıtlı olarak farklı ağırlıklı bir softmax-
argmax şeması ile üretildi — model, var olan kuralları ezberlemek yerine
kendi ilişkisini öğreniyor.

Yeniden üretmek için:
```bash
cd services/ai-service/training
pip install -r requirements.txt
python generate_data.py
python train_model.py
```

---

## Görev 1: Öneri Skorlama / Dönüşüm Tahmini (ML Model)

**Model:** İkili Logistic Regression (`LogisticRegression`, scikit-learn)

**Özellikler:** `monthlySpend`, `dataUsageGb`, `voiceMinutes`, `churnRisk`,
`valueScore`, `acceptedCampaigns`, `rejectedCampaigns`, `discount`,
`segmentMatch` (abone segmenti = kampanya segmenti ise 1.0, abone `BELIRSIZ`
ise 0.5, aksi halde 0.0), kampanya tipinin one-hot kodlaması (4 sütun).

**Çıktı:** `conversionProbability` = modelin `predict_proba`'sı.
`recommendationScore` bu olasılık ile segment sınıflandırıcının kendi
tahminine olan güveni harmanlanarak hesaplanır:

```
recommendationScore = min(1, conversionProbability × 0.75 + segmentConfidence × 0.25)
```

Bu, "modelin dönüşüm ihtimali yüksek gördüğü VE hangi segmentte olduğundan
emin olduğu" abonelerin öne çıkmasını sağlar.

**Test doğruluğu:** ~%59 (ikili sınıflandırma, rastgele tahmin temeli %50) —
`GET /v1/ai/model-info` üzerinden canlı olarak görülebilir. Bu mütevazı ama
gerçek bir sayı: sentetik veriye kasıtlı olarak gürültü eklendi, bu yüzden
mükemmele yakın bir doğruluk zaten beklenmiyor/istenmiyor (aksi halde model
gürültüyü ezberlemiş demektir).

**Gösterim Eşiği** (case gereksinimi, model tipinden bağımsız):

| Skor | Eylem |
|---|---|
| < 0.60 | Aboneye gösterilmez |
| 0.60 – 0.79 | Standart gösterim |
| ≥ 0.80 | Öncelikli / öne çıkan gösterim |

---

## Görev 2: Segment Sınıflandırma (ML Model)

**Model:** Çok sınıflı (multinomial) Logistic Regression, `class_weight='balanced'`
(segmentler arası örnek sayısı dengesiz olduğundan — bkz. aşağıdaki dağılım).

**Özellikler:** `monthlySpend`, `dataUsageGb`, `voiceMinutes`, `churnRisk`,
`valueScore`, `acceptedCampaigns`, `rejectedCampaigns`, + iki mühendislik
özelliği: `isNewSubscriber` (kabul VE ret sayısı 0 ise 1) ve `isLowUsage`
(düşük harcama VE düşük veri kullanımı ise 1).

**Çıktı:** 5 sınıf üzerinde softmax olasılık dağılımı; en yüksek olasılıklı
sınıf = tahmin edilen segment, o olasılık = `confidence`.

**Test doğruluğu:** ~%58 (5 sınıf, rastgele tahmin temeli %20) — sınıf
bazında: YUKSEK_DEGER ve RISKLI_KAYIP ~%60-70 recall ile iyi ayrışıyor;
PASIF ve YENI_ABONE (en az örnekli sınıflar) daha düşük precision ile ama
`class_weight='balanced'` sayesinde sıfır değil (dengelenmemiş halde bu iki
sınıf %0 recall alıyordu — bkz. eğitim script çıktısı).

`RISKLI_KAYIP` segmenti otomatik yüksek öncelik alır (aşağıya bakınız).

### Öncelik Türetme (segment tahmininden sonra, deterministik)

```
segment == RISKLI_KAYIP  →  churnRisk > 0.85 ? KRITIK : YUKSEK
segment == YUKSEK_DEGER  →  ORTA
diğer                    →  DUSUK
```

### Doğruluk Takibi

Personel veya süpervizör AI'ın atadığı segmenti değiştirdiğinde bu "yanlış
sınıflandırma" olarak kaydedilir:

```
Doğruluk = (totalPredictions - misclassified) / totalPredictions × 100
```

Segment bazlı kırılım da hesaplanır (`GET /v1/ai/accuracy`).

---

## Görev 3: Akıllı Uzman Ataması (deterministik — ML değil)

Case dokümanında formülü açıkça verilen tek görev budur; ML ile değiştirmek
yerine verilen formülü birebir uyguladık:

```
skor = (uzmanlık_eşleşme × 0.50) + (boşluk_oranı × 0.30) + (performans × 0.20)

uzmanlık_eşleşme = expert.specializations.includes(caseSegment) ? 1.0 : 0.0
boşluk_oranı     = 1 - (activeCases / maxCapacity)      [maxCapacity = 10]
performans        = min(avgConversionLift × 5, 1.0)       [normalized 0–1]
```

Kapasite dolu (activeCases >= maxCapacity) uzmanlara skor = -1 atanır (seçilmez).

---

## Yedek Mekanizma: Kural Tabanlı Ağırlıklı Skorlama

ML ağırlıkları herhangi bir sebeple yüklenemezse (`src/lib/scorer.ts`),
servis bu deterministik formüle döner — sistemin hiçbir zaman çökmemesini
veya sabit/mock bir değer döndürmemesini garanti eder:

```
rawScore = (segmentMatch × 0.30) + (churnFactor × 0.20) +
           (valueFactor × 0.20) + (discountAppeal × 0.15) +
           (usageFactor × 0.15)

recommendationScore = clamp(rawScore × historyPenalty × historyBonus, 0, 1)
conversionProbability = recommendationScore × (1 - churnRisk × 0.25) × (valueScore × 0.40 + 0.60)
```

Segment sınıflandırma yedeği için karar ağacı:

```
churnRisk > 0.85  →  RISKLI_KAYIP (KRITIK öncelik)
churnRisk > 0.55  →  RISKLI_KAYIP (YUKSEK öncelik)
monthlySpend > 250 AND valueScore > 0.70  →  YUKSEK_DEGER (ORTA)
monthlySpend < 50 AND dataUsageGb < 5 AND voiceMinutes < 100  →  PASIF (DUSUK)
acceptedCampaigns == 0 AND rejectedCampaigns == 0  →  YENI_ABONE (DUSUK)
Diğer  →  BELIRSIZ (DUSUK)
```

---

## Sınırlılıklar ve Gelecek İyileştirmeler

### Mevcut Sınırlılıklar

1. Eğitim verisi sentetik — gerçek abone davranışı üzerinde doğrulanmadı.
2. Doğrusal modeller (Logistic Regression) özellikler arası karmaşık
   etkileşimleri (interaction terms) yakalayamaz; ağaç tabanlı modeller
   muhtemelen daha yüksek doğruluk verir (bkz. yukarıdaki taşınabilirlik
   gerekçesi).
3. Zaman serisi verileri (mevsimsellik, hafta içi/sonu) kullanılmamaktadır.
4. Kampanya yorgunluğu (aynı aboneye çok sık teklif) henüz modellenmemiştir.

### Sıradaki Adımlar

- Gradient Boosting / Random Forest'a geçiş + ağaç yapısının JSON'a export
  edilip TS'te generic bir tree-traversal ile inference edilmesi (daha
  yüksek doğruluk, orta düzeyde ek mühendislik).
- Gerçek kullanım verisi biriktikçe (abone kabul/ret/puan geçmişi zaten
  `campaign_db`'de tutuluyor) modelin periyodik olarak yeniden eğitilmesi.
- Model sürümleme: `model_weights.json`'a bir `version` alanı eklenip
  `GET /v1/ai/model-info`'da gösterilmesi.
