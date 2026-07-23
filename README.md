# CampaignCell — Turkcell Kişiselleştirilmiş Kampanya ve Öneri Platformu

> **Turkcell CodeNight 2026 Final Case Projesi**  
> *"Doğru Teklif. Doğru Müşteri. Doğru Zaman."*

---

## 📐 Sistem ve Mimari Genel Bakış

CampaignCell, Turkcell abonelerinin kullanım alışkanlıklarını analiz ederek kişiselleştirilmiş kampanya önerisi skorlayan, dönüşüm olasılığı tahmini üreten, düşük performanslı segmentleri kampanya uzmanlarına yönlendiren ve oyunlaştırma (gamification) ile personel motivasyonunu artıran **4 bağımsız mikroservis + 1 API Gateway** ekosistemidir.

```
                       ┌─────────────────────────┐
                       │   Turkcell Frontend     │
                       │     (Next.js App)       │
                       └────────────┬────────────┘
                                    │ HTTP / REST & SSE Stream
                                    ▼
                       ┌─────────────────────────┐
                       │       API GATEWAY       │
                       │   (Express / Port 8080) │
                       └────────────┬────────────┘
         ┌──────────────────┬───────┴──────────┬──────────────────┐
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
┌─────────────────┐┌─────────────────┐┌─────────────────┐┌─────────────────┐
│Identity Service ││Campaign Service ││   AI Service    ││Gamification Svc │
│ (NestJS / 3001) ││ (NestJS / 3002) ││ (FastAPI/8000)  ││ (NestJS / 3003) │
└────────┬────────┘└────────┬────────┘└────────┬────────┘└────────┬────────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
  [Identity DB]      [Campaign DB]          [AI DB]       [Gamification DB]
 (PostgreSQL:5433)  (PostgreSQL:5434)   (PostgreSQL:5435)  (PostgreSQL:5436)

         └──────────────────┴───────┬──────────┴──────────────────┘
                                    │ Event Exchange (Asenkron)
                                    ▼
                         ┌────────────────────┐
                         │  RabbitMQ Broker   │
                         │    (Port 5672)     │
                         └────────────────────┘
```

---

## 🚀 Hızlı Başlangıç (Docker Compose)

Tüm mikroservisler, veritabanları, RabbitMQ ve Frontend tek bir komut ile derlenip ayağa kaldırılır:

```bash
# 1. Depoyu klonlayın ve kök dizine geçin
cd campaigncell

# 2. Örnek ortam değişkenlerini kopyalayın
cp .env.example .env

# 3. Tüm sistemi Docker Compose ile başlatın
docker compose up --build -d
```

---

## 🔑 Demo Kullanıcı Bilgileri (Jüri Değerlendirmesi İçin)

Proje veritabanı başlangıçta (seeding) aşağıdaki jüri demo hesaplarıyla yüklenir:

| Rol | E-Posta / GSM | Parola / OTP | Açıklama |
|---|---|---|---|
| **System Admin** | `admin@turkcell.com.tr` | `Turkcell2026!` | Sistem yöneticisi, personel hesabı açma, audit logları izleme |
| **Süpervizör** | `supervisor@turkcell.com.tr` | `Turkcell2026!` | Operasyon yöneticisi, AI doğruluk takibi, SLA izleme, liderlik tablosu |
| **Kampanya Uzmanı** | `uzman@turkcell.com.tr` | `Turkcell2026!` | Vaka yönetimi, state machine geçişleri, A/B testi, segment override |
| **Abone (Müşteri)** | `05551112233` | `1234` (OTP Simülasyon) | Müşteri portali, kişiselleştirilmiş teklifler, kabul/ret, 1-5 yıldız değerlendirme |

---

## 🌐 Servis Portları & Dokümantasyon Linkleri

| Servis | Bağlantı Noktası (Port) | Dokümantasyon Uç Noktası |
|---|---|---|
| **Frontend UI** | `http://localhost:3000` | — |
| **API Gateway** | `http://localhost:8080` | `/api/v1/health` |
| **Identity Service** | `http://localhost:3001` | `http://localhost:3001/api/docs` (Swagger) |
| **Campaign Service** | `http://localhost:3002` | `http://localhost:3002/api/docs` (Swagger) |
| **AI Service** | `http://localhost:8000` | `http://localhost:8000/docs` (FastAPI Swagger) |
| **Gamification Service** | `http://localhost:3003` | `http://localhost:3003/api/docs` (Swagger) |
| **RabbitMQ Dashboard** | `http://localhost:15672` | Kullanıcı: `guest` / Şifre: `guest` |

---

## 🏆 Bonus Puan Özellikleri (+20 / 20 Tam Bonus)

1. **Kendi Eğittiğiniz ML Modeli (+8 Puan)**:
   - `scikit-learn` tabanlı `RandomForestClassifier` & `GradientBoostingClassifier` modelleri 1200+ sentetik telko verisetiyle eğitilmiştir (`dataset_generator.py` ve `AI_APPROACH.md`).
2. **Message Queue İle Event İletimi (+5 Puan)**:
   - RabbitMQ `campaign_events` Topic Exchange ile asenkron servis haberleşmesi.
3. **Kategori Bazlı AI Doğruluk Kırılımı (+3 Puan)**:
   - Süpervizör panelinde `YUKSEK_DEGER`, `RISKLI_KAYIP`, `YENI_ABONE`, `PASIF` segment isabet oranları ve `GET /api/v1/ai/accuracy`.
4. **Gerçek Zamanlı Bildirimler - SSE Stream (+2 Puan)**:
   - API Gateway `/api/v1/events/stream` üzerinden Server-Sent Events (SSE) canlı event yayını ve Toast bildirim kartları.
5. **CI/CD Pipeline (+2 Puan)**:
   - `.github/workflows/ci.yml` GitHub Actions pipeline.

---

## 📄 Ek Dokümantasyonlar

- **Olay Tabanlı Mimari Dokümanı**: [`EVENTS.md`](file:///c:/Users/Administrator/Desktop/Projelerim/campaigncell/EVENTS.md)
- **Yapay Zeka (AI/ML) Dokümanı**: [`AI_APPROACH.md`](file:///c:/Users/Administrator/Desktop/Projelerim/campaigncell/AI_APPROACH.md)
- **Identity Service Dokümanı**: [`services/identity-service/README.md`](file:///c:/Users/Administrator/Desktop/Projelerim/campaigncell/services/identity-service/README.md)
- **Campaign Service Dokümanı**: [`services/campaign-service/README.md`](file:///c:/Users/Administrator/Desktop/Projelerim/campaigncell/services/campaign-service/README.md)
- **AI Service Dokümanı**: [`services/ai-service/README.md`](file:///c:/Users/Administrator/Desktop/Projelerim/campaigncell/services/ai-service/README.md)
- **Gamification Service Dokümanı**: [`services/gamification-service/README.md`](file:///c:/Users/Administrator/Desktop/Projelerim/campaigncell/services/gamification-service/README.md)
