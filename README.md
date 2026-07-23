# CampaignCell — Turkcell Kişiselleştirilmiş Kampanya ve Öneri Platformu

> **Turkcell CodeNight 2026 Final Case Projesi**  
> **Motto:** *Doğru Teklif · Doğru Müşteri · Doğru Zaman*

CampaignCell; Turkcell abonelerinin kullanım alışkanlıklarını analiz eden, AI tabanlı dönüşüm olasılığı tahmini üreten, düşük performanslı segmentleri uzman ekibe yönlendiren ve oyunlaştırma ile operasyon motivasyonunu artıran uçtan uca bir mikroservis platformudur.

---

## İçindekiler

- [1. Proje Özeti](#1-proje-özeti)
- [2. Problem Tanımı ve Hedef](#2-problem-tanımı-ve-hedef)
- [3. Mimari Yaklaşım](#3-mimari-yaklaşım)
- [4. Servisler ve Sorumlulukları](#4-servisler-ve-sorumlulukları)
- [5. Teknoloji Yığını](#5-teknoloji-yığını)
- [6. Kurulum ve Çalıştırma](#6-kurulum-ve-çalıştırma)
- [7. Ortam Değişkenleri](#7-ortam-değişkenleri)
- [8. Demo Hesapları](#8-demo-hesapları)
- [9. API Kullanım Senaryoları](#9-api-kullanım-senaryoları)
- [10. Event-Driven Akışlar (RabbitMQ)](#10-event-driven-akışlar-rabbitmq)
- [11. AI/ML Yaklaşımı](#11-aiml-yaklaşımı)
- [12. Gamification Modeli](#12-gamification-modeli)
- [13. Güvenlik, Yetkilendirme ve Audit](#13-güvenlik-yetkilendirme-ve-audit)
- [14. Gözlemlenebilirlik (Observability)](#14-gözlemlenebilirlik-observability)
- [15. Test Stratejisi](#15-test-stratejisi)
- [16. CI/CD Süreci](#16-cicd-süreci)
- [17. Performans ve Ölçeklenebilirlik](#17-performans-ve-ölçeklenebilirlik)
- [18. Klasör Yapısı](#18-klasör-yapısı)
- [19. Yol Haritası](#19-yol-haritası)
- [20. Jüri Notları ve Demo Akışı](#20-jüri-notları-ve-demo-akışı)
- [21. Lisans](#21-lisans)

---

## 1. Proje Özeti

CampaignCell platformu aşağıdaki ana kabiliyetleri sağlar:

- **Kişiselleştirilmiş kampanya skorlama** (abone bazlı)
- **Dönüşüm olasılığı tahmini** (AI/ML)
- **Düşük performanslı segmentlerin tespiti**
- **Uzman müdahalesi ile segment override / vaka yönetimi**
- **Canlı event akışı (SSE)**
- **Personel performansını artıran oyunlaştırma**

---

## 2. Problem Tanımı ve Hedef

Telekom operasyonlarında aynı kampanyanın tüm abonelere eşit şekilde sunulması:
- düşük dönüşüm,
- yüksek iletişim maliyeti,
- müşteri memnuniyetsizliği doğurur.

### Hedefler
1. Abonelere **en uygun kampanyayı** önermek  
2. Operasyon ekiplerine **açıklanabilir performans metrikleri** sunmak  
3. Kampanya yönetimini **ölçülebilir ve iteratif** hale getirmek  
4. Sistem içi geri bildirimleri event tabanlı yapıyla **gerçek zamanlı** taşımak

---

## 3. Mimari Yaklaşım

Sistem, **API Gateway + 4 bağımsız mikroservis** olarak tasarlanmıştır.  
Servisler arası senkron iletişim REST ile, asenkron iletişim RabbitMQ üzerinden yapılır.

```text
Frontend (Next.js)
   │
   ▼
API Gateway (Express :8080)
   ├── Identity Service (NestJS :3001)
   ├── Campaign Service (NestJS :3002)
   ├── AI Service (FastAPI :8000)
   └── Gamification Service (NestJS :3003)

Databases: PostgreSQL (service başına ayrık DB)
Message Broker: RabbitMQ (topic exchange)
Realtime: SSE stream (/api/v1/events/stream)
```

### Mimari Prensipler
- **Database per service**
- **Loose coupling**
- **Event-driven interoperability**
- **Role-based access control**
- **Fail-soft yaklaşımı** (servislerden biri degradasyon yaşasa da sistemin tamamı düşmez)

---

## 4. Servisler ve Sorumlulukları

## 4.1 Identity Service (`:3001`)
- Kullanıcı kimlik doğrulama (personel + abone)
- Rol yönetimi (`ADMIN`, `SUPERVISOR`, `SPECIALIST`, `SUBSCRIBER`)
- JWT üretimi / doğrulama
- Audit log temel kayıtları

## 4.2 Campaign Service (`:3002`)
- Kampanya CRUD
- Segment tanımları
- Kampanya-atama ve teklif lifecycle yönetimi
- A/B test varyantları
- Uzman müdahale operasyonları (override, reassignment)

## 4.3 AI Service (`:8000`)
- Özellik çıkarımı (feature engineering)
- Model inference (dönüşüm olasılığı tahmini)
- Segment bazlı doğruluk kırılımı
- Model versiyonlama ve metrik endpointleri

## 4.4 Gamification Service (`:3003`)
- Personel puanlama
- Rozet/achievement mekanikleri
- Liderlik tablosu
- Operasyon KPI’larına dayalı motivasyon sistemi

## 4.5 API Gateway (`:8080`)
- Tek giriş noktası
- Route aggregation
- Auth forwarding / request context
- SSE üzerinden event yayınlama
- Cross-service response standardizasyonu

---

## 5. Teknoloji Yığını

### Backend
- **Node.js + NestJS** (Identity, Campaign, Gamification)
- **Python + FastAPI** (AI)
- **Express** (Gateway)

### Veri ve Mesajlaşma
- **PostgreSQL** (servis başına ayrı instance)
- **RabbitMQ** (topic exchange: `campaign_events`)

### Frontend
- **Next.js**
- Dashboard + canlı event feed + rol bazlı ekranlar

### DevOps
- **Docker / Docker Compose**
- **GitHub Actions CI**

---

## 6. Kurulum ve Çalıştırma

## 6.1 Gereksinimler
- Docker 24+
- Docker Compose v2+
- (Opsiyonel local geliştirme için) Node.js 20+, Python 3.11+

## 6.2 Hızlı Başlangıç

```bash
# 1) Repo
git clone <repo-url>
cd campaigncell

# 2) Env
cp .env.example .env

# 3) Build & Up
docker compose up --build -d

# 4) Log takibi (opsiyonel)
docker compose logs -f
```

## 6.3 Durdurma / Temizlik

```bash
docker compose down
docker compose down -v   # volume'leri de siler (DB reset)
```

---

## 7. Ortam Değişkenleri

> Ayrıntılı örnekler için `.env.example` dosyasını baz alın.

Temel değişken grupları:

- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `POSTGRES_*` (servis bazlı DB host/port/user/pass/db)
- `RABBITMQ_URL`, `RABBITMQ_EXCHANGE`
- `AI_MODEL_PATH`, `AI_THRESHOLD`
- `SSE_HEARTBEAT_INTERVAL`
- `CORS_ORIGIN`

> **Not:** Production ortamında tüm secret’lar Vault/KMS benzeri güvenli kaynaklardan yönetilmelidir.

---

## 8. Demo Hesapları

| Rol | Giriş | Parola / OTP | Kullanım |
|---|---|---|---|
| System Admin | `admin@turkcell.com.tr` | `Turkcell2026!` | Personel yönetimi, audit |
| Süpervizör | `supervisor@turkcell.com.tr` | `Turkcell2026!` | KPI/AI doğruluk/SLA |
| Kampanya Uzmanı | `uzman@turkcell.com.tr` | `Turkcell2026!` | Vaka ve teklif operasyonu |
| Abone | `05551112233` | `1234` (OTP sim) | Teklif görüntüleme, kabul/ret |

---

## 9. API Kullanım Senaryoları

## 9.1 Healthcheck
- `GET /api/v1/health`

## 9.2 Login
- Personel login -> JWT
- Abone OTP simülasyon login -> token

## 9.3 Teklif Akışı (Örnek)
1. Abone davranış verisi alınır  
2. AI service skor üretir  
3. Campaign service kampanyayı eşleştirir  
4. Event RabbitMQ’ya yayınlanır  
5. Gateway SSE ile dashboard’a canlı iletir

## 9.4 Dokümantasyon Uç Noktaları
- Identity: `http://localhost:3001/api/docs`
- Campaign: `http://localhost:3002/api/docs`
- AI: `http://localhost:8000/docs`
- Gamification: `http://localhost:3003/api/docs`

---

## 10. Event-Driven Akışlar (RabbitMQ)

Exchange: `campaign_events` (topic)

Örnek routing key’ler:
- `campaign.offer.created`
- `campaign.offer.accepted`
- `campaign.offer.rejected`
- `ai.prediction.generated`
- `gamification.points.updated`

### Akış Faydaları
- Servis bağımsızlığı
- Yeniden deneme (retry) ve eventual consistency
- Yük altında daha esnek ölçeklenme

> Detay: `EVENTS.md`

---

## 11. AI/ML Yaklaşımı

Kullanılan modeller:
- `RandomForestClassifier`
- `GradientBoostingClassifier`

Veri:
- 1200+ sentetik telko müşteri kaydı
- Segment etiketleri: `YUKSEK_DEGER`, `RISKLI_KAYIP`, `YENI_ABONE`, `PASIF`

Metrikler:
- Accuracy / Precision / Recall / F1
- Segment bazlı isabet oranı endpointleri

Açıklanabilirlik:
- Feature importance raporları
- Segment bazlı hata analizi

> Detay: `AI_APPROACH.md`, `dataset_generator.py`

---

## 12. Gamification Modeli

### Puanlama Örnekleri
- Başarılı teklif dönüşümü: +X puan
- Düşük dönüşüm segmentinde iyileştirme: +Y bonus
- SLA içinde vaka kapama: +Z puan

### Rozetler (Örnek)
- `Conversion Master`
- `SLA Guardian`
- `Segment Doctor`

Amaç:
- Operasyon ekibinde görünür başarı
- KPI odaklı sağlıklı rekabet
- Süreklilik ve motivasyon

---

## 13. Güvenlik, Yetkilendirme ve Audit

- JWT tabanlı authentication
- Role-based authorization (RBAC)
- Input validation (DTO / schema)
- API gateway seviyesinde merkezi güvenlik politikaları
- Kritik aksiyonların audit loglanması

Önerilen production iyileştirmeleri:
- Rate limiting
- Refresh token rotation
- IP/device anomaly detection
- Secret rotation policy

---

## 14. Gözlemlenebilirlik (Observability)

- Servis health endpointleri
- Merkezi log toplama (öneri: ELK/Loki)
- Correlation ID ile request tracing
- Queue depth ve consumer lag takibi
- AI inference latency monitörü

---

## 15. Test Stratejisi

- **Unit test:** servis iş kuralları
- **Integration test:** DB + broker + endpoint entegrasyonu
- **Contract test:** servisler arası API sözleşmeleri
- **E2E test:** ana kullanıcı akışları (login -> öneri -> karar -> puan)

Önerilen komutlar (projene göre uyarlayabilirsin):
```bash
npm run test
npm run test:integration
npm run test:e2e
```

---

## 16. CI/CD Süreci

GitHub Actions (`.github/workflows/ci.yml`) içinde önerilen adımlar:
1. Lint
2. Unit test
3. Build
4. (Opsiyonel) Docker image build
5. Güvenlik taraması (SCA/SAST)

PR quality gate:
- Test pass zorunlu
- En az 1 code review
- Ana branch koruması

---

## 17. Performans ve Ölçeklenebilirlik

- Stateless servisler -> yatay ölçeklenme uygun
- DB indeksleri: kullanıcı, segment, kampanya durum alanları
- AI inference cache (kısa TTL)
- Queue-based backpressure yönetimi
- SSE bağlantıları için connection pooling/heartbeat

---

## 18. Klasör Yapısı

```text
campaigncell/
├─ api-gateway/
├─ frontend/
├─ services/
│  ├─ identity-service/
│  ├─ campaign-service/
│  ├─ ai-service/
│  └─ gamification-service/
├─ .github/workflows/
├─ EVENTS.md
├─ AI_APPROACH.md
├─ docker-compose.yml
└─ README.md
```

---

## 19. Yol Haritası

- [ ] Gerçek telko datası ile yeniden eğitim
- [ ] Online learning / model drift alarmı
- [ ] Çok kanallı bildirim (SMS/Push/e-mail)
- [ ] Explainable AI ekranları (SHAP benzeri)
- [ ] Multi-tenant operasyon desteği

---

## 20. Jüri Notları ve Demo Akışı

### 7 Dakikalık Önerilen Demo Script
1. **Mimariyi tanıt** (1 dk)
2. **Admin login + kullanıcı/rol görünümü** (1 dk)
3. **Abone tarafında kişiselleştirilmiş teklif** (2 dk)
4. **Süpervizör panelinde AI doğruluk kırılımı** (1 dk)
5. **Uzman panelinde vaka müdahalesi + gamification puanı** (1 dk)
6. **SSE canlı event akışı + kapanış** (1 dk)

### Bonus Vurgusu
- Kendi eğittiğin model
- RabbitMQ ile event-driven mimari
- Segment bazlı doğruluk analizi
- Canlı SSE bildirimleri
- CI/CD pipeline

---

## 21. Lisans

Bu proje Turkcell CodeNight 2026 final değerlendirmesi kapsamında hazırlanmıştır.  
Lisanslama için kurum/payload gereksinimlerine göre MIT veya özel lisans metni eklenebilir.
