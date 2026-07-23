# CampaignCell — Yapay Zeka (AI/ML) Yaklaşım Dokümanı

Turkcell CodeNight 2026 Final case'i kapsamında geliştirilen **AI Service**, abonelerin telko kullanım davranışlarını analiz ederek kişiselleştirilmiş kampanya önerisi skorlama, dönüşüm olasılığı tahmini, segment sınıflandırması ve akıllı uzman ataması gerçekleştiren makine öğrenmesi katmanıdır.

---

## 1. Mimari Seçim ve Model Tasarımı

Projede **kendi eğittiğimiz makine öğrenmesi modelleri (scikit-learn)** ve **kural tabanlı hibrit mimari** tercih edilmiştir:

- **Sınıflandırma Modeli (Segment Sınıflandırması)**: `RandomForestClassifier(n_estimators=100, max_depth=8)`
- **Dönüşüm Tahmin Modeli**: `RandomForestClassifier` (Dönüşüm olasılığı için `predict_proba`)
- **Alternatif Model**: `GradientBoostingClassifier` (Canlı yeniden eğitim ile geçiş yapılabilir)

### Neden RandomForest?
1. Tabüler telko verilerinde (GB kullanımı, konuşma süresi, ARPU, şikayet sayısı) yüksek f1-score ve doğruluk sağlar.
2. Aşırı öğrenmeye (overfitting) karşı `max_depth` ve `n_estimators` parametreleriyle dayanıklıdır.
3. Hızlı çıkarım (inference) süresi (<10ms) ile yüksek trafik altında mikroservis performansını korur.

---

## 2. Eğitim Veriseti (`dataset_generator.py`)

Gerçekçi Turkcell abone profillerini simüle etmek amacıyla 1200 örnekli sentetik telko veriseti üretilmiştir:

### Feature Listesi (Girdiler)
| Feature | Tanım | Dağılım / Üretim Mantığı |
|---|---|---|
| `monthly_data_usage_gb` | Aylık İnternet Tüketimi (GB) | Gamma dağılımı (shape=2.5, scale=8.0) |
| `monthly_voice_min` | Aylık Konuşma (Dakika) | Normal dağılım (mean=600, std=200) |
| `monthly_spend_try` | Aylık Ortalama Harcama (ARPU) | `(GB * 15) + (Dk * 0.2) + Gürültü` |
| `tenure_months` | Abonelik Süresi (Ay) | Üniform dağılım (1-120 ay) |
| `past_accepted_count` | Geçmiş Kabul Edilen Teklif | Poisson dağılımı (lam=1.5) |
| `past_rejected_count` | Geçmiş Reddedilen Teklif | Poisson dağılımı (lam=1.0) |
| `complaint_count` | Aktif Şikayet Kaydı | Poisson dağılımı (lam=0.4) |
| `data_usage_trend_pct` | 60 Günlük Kullanım Trendi (%) | Normal dağılım (mean=5, std=25) |

---

## 3. XAI (Açıklanabilir Yapay Zeka)

Modelin ürettiği tahminlerin arkasındaki gerekçeler anlaşılır Türkçe metin olarak süpervizör ve uzman ekranlarına sunulur:

```python
# Örnek Çıktı:
"AI Analizi: [RISKLI_KAYIP] segmenti ve [KRITIK] önceliği belirlenmiştir. 
Gerekçe: Müşterinin 3 adet aktif şikayet kaydı bulunmaktadır. 
Son 60 günlük veri kullanımı %-28.5 oranında düşüş göstermiştir. 
Aylık 42.0 GB yüksek veri tüketimi mevcuttur. Tahmini dönüşüm olasılığı: %35."
```

---

## 4. Akıllı Uzman Atama Algoritması

Optimizasyon vakaları için en uygun uzman şu skora göre belirlenir:

$$\text{Atama Skoru} = (\text{Uzmanlık Eşleşmesi} \times 0.5) + (\text{Müsaitlik} \times 0.3) + (\text{Performans} \times 0.2)$$

- **Uzmanlık Eşleşmesi**: Uzmanın uzmanlık etiketi (örn: `CHURN_PREVENTION`) vaka segmentiyle çakışıyorsa 1.0, aksi halde 0.5.
- **Müsaitlik**: `1.0 - (aktif_vaka_sayisi / 10.0)`
- **Performans**: Uzmanın geçmiş vaka tamamlama ve dönüşüm artış puanı.

---

## 5. Canlı Model Yeniden Eğitimi & Feedback Loop

- **Segment Override**: Uzman veya Süpervizör AI segmentini değiştirdiğinde bu veri RabbitMQ üzerinden `segment.changed` olarak fırlatılır ve `PredictionCorrection` tablosuna 'yanlış sınıflandırma' olarak kaydedilir.
- **Model Training Endpoint**: `POST /api/v1/ai/train` çağrıldığında yeni sentetik veya gerçek verilerle model anında yeniden eğitilir, sürüm etiketi (`v1.6-gb`) güncellenir ve pasif/aktif model değişimi gerçekleşir.
