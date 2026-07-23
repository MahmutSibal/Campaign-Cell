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

Proje veritabanı başlangıçta (seeding) yalnızca aşağıdaki **hesaplar** ve gamification **rozet/seviye tanımları** ile yüklenir. **Örnek kampanya, vaka veya sahte puan verisi YOKTUR** — sistem gerçek veriyle çalışır; kampanyalar, optimizasyon vakaları, puanlar ve liderlik tablosu demo sırasında canlı olarak oluşur.

| Rol | E-Posta / GSM | Parola / OTP | Açıklama |
|---|---|---|---|
| **System Admin** | `admin@turkcell.com.tr` | `Turkcell2026!` | Sistem yöneticisi, personel hesabı açma, audit logları izleme, **canlı health-check** |
| **Süpervizör** | `supervisor@turkcell.com.tr` | `Turkcell2026!` | Operasyon yöneticisi, AI doğruluk takibi, SLA izleme, liderlik tablosu |
| **Kampanya Uzmanı** | `uzman@turkcell.com.tr` | `Turkcell2026!` | Ahmet Yılmaz — Churn/RISKLI_KAYIP uzmanı. Vaka yönetimi, state machine, A/B testi, segment override |
| **Kampanya Uzmanı 2** | `uzman2@turkcell.com.tr` | `Turkcell2026!` | Zeynep Kaya — YUKSEK_DEGER/Tarife uzmanı (akıllı atama demosu için) |
| **Kampanya Uzmanı 3** | `uzman3@turkcell.com.tr` | `Turkcell2026!` | Mehmet Demir — YENI_ABONE/Ek Paket uzmanı (akıllı atama demosu için) |
| **Abone (Müşteri)** | `05551112233` | `1234` (OTP Simülasyon) | Ahmet Yılmaz — Müşteri portali, kişiselleştirilmiş teklifler, kabul/ret, 1-5 yıldız değerlendirme, AI profil düzenleme |

> **Kişisel teklif akışı:** Abone önce **Profil** ekranından gerçek kullanım verisini girer (AI profili); kişisel teklifler bu profile göre AI ile skorlanır (`skor ≥ 0.60` gösterilir, `> 0.80` öncelikli). Profil boşken teklif üretilmez — kişiselleştirme uydurulmaz.

> **Temiz demo başlangıcı:** Sunumdan hemen önce sıfır durumla başlamak için `docker compose down -v && docker compose up -d` çalıştırın.

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

## 🔒 Güvenlik (Case §10 — Jüri Canlı Güvenlik Testine Hazır)

Jürinin deneyeceği tüm saldırı senaryolarına karşı katmanlı savunma uygulanmış ve canlı test edilmiştir:

| Saldırı Senaryosu | Önlem | Sonuç |
|---|---|---|
| **SQL Injection** (`' OR 1=1 --`) | Prisma ORM + SQLAlchemy (parametreli sorgular, ham SQL yok) | `401`, çökme yok |
| **Yetkisiz endpoint erişimi** | Endpoint-seviyesi rol/yetki matrisi (`RolesGuard`); abone → personel/admin uçları | `403` + audit log |
| **IDOR** (başka kullanıcının verisi) | Sahiplik kontrolü: `/subscribers/:id/offers`, `/history`, AI `/subscribers/:id` yalnızca kendi id | `403` |
| **Token manipülasyonu** (değiştirilmiş/süresi dolmuş JWT) | Gateway + her serviste bağımsız JWT doğrulama (savunma derinliği) | `401` |
| **İptal refresh token yeniden kullanımı** | Token rotation + theft koruması (yeniden kullanımda **tüm oturumlar** sonlanır) | `401` + oturum imhası |
| **XSS** (`<script>` enjeksiyonu) | Girdi literal saklanır; React otomatik escape (`dangerouslySetInnerHTML` yok) | Çalıştırılmaz |
| **Brute-force** | Giriş/OTP uçlarına özel **10/dk** rate limit + **5 başarısız → 15 dk hesap kilidi** | `429` / `403` (kalan süre) |

Ek önlemler: `bcrypt` şifre hash, şifre politikası (ihlalde net mesaj), AI servisi doğrudan erişimde bile (port 8000) hassas uçlarda JWT ister, tüm 403/kilit/kritik işlemler audit log'a yazılır.

## 🔗 Öne Çıkan API Uçları

| Method | Endpoint | Açıklama |
|---|---|---|
| `POST` | `/api/v1/campaigns` | Kampanya oluştur → senkron AI skorlama + akıllı uzman ataması tetiklenir |
| `GET` | `/api/v1/subscribers/:id/offers` | Aboneye özel, AI ile skorlanmış kişisel teklifler (skor ≥ 0.60) — IDOR korumalı |
| `GET` | `/api/v1/subscribers/:id/history` | Abonenin gerçek teklif geçmişi (kabul/ret + puanlar) — IDOR korumalı |
| `POST` | `/api/v1/feedback` | Abone yanıtı (kabul/ret) + 1-5 yıldız (tek seferlik) |
| `PATCH` | `/api/v1/cases/:id/status` | State machine geçişi (kural dışı → `422`, yetkisiz → `403`) |
| `GET/PUT` | `/api/v1/ai/subscribers/:id` | Abone AI kullanım profili (JWT + sahiplik korumalı) |
| `GET` | `/api/v1/game/leaderboard?period=daily` | Canlı liderlik tablosu (gerçek isimle) |

## 📄 Ek Dokümantasyonlar

- **Olay Tabanlı Mimari Dokümanı**: [`EVENTS.md`](./EVENTS.md)
- **Yapay Zeka (AI/ML) Dokümanı**: [`AI_APPROACH.md`](./AI_APPROACH.md)
- **Identity Service Dokümanı**: [`services/identity-service/README.md`](./services/identity-service/README.md)
- **Campaign Service Dokümanı**: [`services/campaign-service/README.md`](./services/campaign-service/README.md)
- **AI Service Dokümanı**: [`services/ai-service/README.md`](./services/ai-service/README.md)
- **Gamification Service Dokümanı**: [`services/gamification-service/README.md`](./services/gamification-service/README.md)
