# CampaignCell — Turkcell CodeNight 2026 Final Submission

Turkcell abonelerine doğru teklifi doğru anda sunan, yapay zeka destekli, mikroservis mimarili
kişiselleştirilmiş kampanya ve öneri platformu. Dört bağımsız mikroservis (kimlik, kampanya, AI,
gamification) bir API Gateway arkasında çalışır ve tüm sistem `docker compose up` ile tek komutta
ayağa kalkar.

## İçindekiler

- [Senaryo](#senaryo)
- [Sistem Mimarisi](#sistem-mimarisi)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Servisler](#servisler)
- [Hızlı Başlangıç](#hızlı-başlangıç-docker-compose)
- [Sorun Giderme](#sorun-giderme)
- [Demo Kimlik Bilgileri](#demo-kimlik-bilgileri)
- [Kullanıcı Rolleri ve Yetki Matrisi](#kullanıcı-rolleri-ve-yetki-matrisi)
- [Optimizasyon Vakası State Machine](#optimizasyon-vakası-state-machine)
- [Segment, Öncelik ve SLA Kuralları](#segment-öncelik-ve-sla-kuralları)
- [API Endpoint Referansı](#api-endpoint-referansı)
- [Yapay Zeka Yaklaşımı](#yapay-zeka-yaklaşımı)
- [Gamification Kuralları](#gamification-kuralları)
- [Olay Tabanlı Mimari (Event-Driven)](#olay-tabanlı-mimari-event-driven)
- [Güvenlik](#güvenlik)
- [Test](#test)
- [Proje Yapısı](#proje-yapısı)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Değerlendirme Kriterleri Eşlemesi](#değerlendirme-kriterleri-eşlemesi)

## Senaryo

Turkcell'in milyonlarca abonesi vardır ve her birinin kullanım alışkanlığı farklıdır. CampaignCell
bir abonenin kullanım profilini analiz eder, en uygun kampanyayı önerir, dönüşüm olasılığını tahmin
eder ve düşük dönüşümlü segmentleri bir kampanya uzmanına yönlendirir. Uzmanlar kampanyaları
optimize ettikçe puan kazanır; süpervizörler tüm kampanya performansını ve modelin isabetini tek
ekrandan izler.

| Rol | Kim? | Ne yapar? |
|---|---|---|
| Abone | Turkcell müşterisi | Kişiselleştirilmiş teklifleri görür, kabul/ret eder, geri bildirim verir |
| Kampanya Uzmanı | Pazarlama çalışanı | Kampanya oluşturur, düşük performanslı segmentleri optimize eder, rozet kazanır |
| Süpervizör | Operasyon yöneticisi | Dashboard izler, model isabetini ve KPI'ları takip eder, manuel atama yapar |
| Admin | Sistem yöneticisi | Uzman hesapları oluşturur, rol yönetir, audit log görür |

## Sistem Mimarisi

```
                        ┌─────────────────────┐
                        │   nginx Gateway      │
                        │     :3000            │
                        │  Rate Limiting       │
                        │  Security Headers    │
                        │  JWT auth_request    │  (yalnızca /users, /audit)
                        └─────────┬───────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
 ┌────────────────┐    ┌────────────────────┐   ┌────────────────────┐
 │identity-service│    │ campaign-service   │   │    ai-service      │
 │    :3001       │    │     :3002          │   │      :3003         │
 │                │    │                   │   │                    │
 │ Auth + JWT     │    │ Campaigns         │   │ Weighted Scoring   │
 │ GSM+OTP Kayıt  │    │ State Machine     │   │ Segment Classify   │
 │ Lockout 5/15m  │    │ A/B Experiments   │   │ Expert Assignment  │
 │ Token Rotation │    │ SLA Scheduler     │   │ Accuracy Tracking  │
 │ Audit Logs     │    │ AI Integration    │   │                    │
 │ Password Policy│    │ Auto-Archive      │   │                    │
 └───────┬────────┘    └────────┬──────────┘   └─────────┬──────────┘
         │  ▲                   │  │                      │
         │  │ audit.log         │  │ campaign.optimized    │
         │  │ (Redis, 403+      │  │ campaign.sla_breached │
         │  │  kritik olaylar)  │  │ offer.rated            │
         │  │                   │  ▼                      │
         │  └──────────── Redis Pub/Sub ──────┐            │
         │                                    ▼            │
         │                          ┌────────────────────┐ │
         │                          │gamification-service│ │
         │                          │      :3004         │ │
         │                          │                    │ │
         │                          │ Points Engine      │ │
         │                          │ Badge Engine       │ │
         │                          │ Leaderboard        │ │
         │                          │ SSE (badge.earned) │ │
         │                          └────────────────────┘ │
         │                                                 │
         └─────────────────── REST (sync) ──────────────────┘
                     (recommend, expert-assignment, segment-override)

 ┌─────────────────────────────────────────────────────────────────┐
 │              React Frontend (Vite) — artifacts/campaigncell      │
 └─────────────────────────────────────────────────────────────────┘
```

**Mimari kurallar:**
- **Database-per-service**: her servisin kendi PostgreSQL veritabanı vardır, hiçbir servis başka
  servisin veritabanına doğrudan erişmez.
- **Bağımsızlık**: bir servis çöktüğünde diğerleri çalışmaya devam eder. Örn. `ai-service` kapalıyken
  kampanya yine oluşturulur (segment: `BELIRSIZ`, öncelik: `ORTA`, manuel kuyruğa düşer).
- **Servisler arası iletişim**: kritik/gerçek-zamanlı akışlar (Campaign → Gamification, çapraz-servis
  audit log) Redis Pub/Sub üzerinden async; senkron cevap gereken çağrılar (AI skorlama, uzman atama)
  REST üzerinden.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend | Node.js 22, TypeScript, Express 5 |
| ORM / DB | Drizzle ORM, PostgreSQL 16 (servis başına ayrı instance) |
| Mesajlaşma | Redis 7 (Pub/Sub) |
| Kimlik doğrulama | JWT (access + refresh), bcrypt |
| Gateway | nginx (routing, rate limiting, `auth_request` ile JWT doğrulama) |
| Frontend | React 19, Vite, TypeScript, TanStack Query, wouter, shadcn/ui |
| Test | Vitest |
| Container | Docker, Docker Compose |
| API dokümantasyonu | OpenAPI 3 (`lib/api-spec/openapi.yaml`) |

## Servisler

| Servis | Port | Veritabanı | Sorumluluk |
|--------|------|------------|------------|
| `identity-service` | 3001 | `identity_db` | Auth (email+şifre ve GSM+OTP), kullanıcılar, roller, audit log, hesap kilidi |
| `campaign-service` | 3002 | `campaign_db` | Kampanyalar, optimizasyon vakaları (state machine), aboneler, A/B deneyleri, analitik, SLA zamanlayıcı |
| `ai-service` | 3003 | `ai_db` | Öneri skorlama, segment sınıflandırma, uzman atama, doğruluk takibi |
| `gamification-service` | 3004 | `gamification_db` | Puan motoru, rozet motoru, seviye, liderlik tablosu, SSE bildirimleri |
| `gateway` (nginx) | 3000 | — | Tek giriş noktası: routing, rate limiting, güvenlik başlıkları, hassas rotalarda JWT doğrulama |

Her servisin kendi README'si vardır (sorumluluk, tam endpoint listesi, environment değişkenleri):
[`services/identity-service/README.md`](services/identity-service/README.md) ·
[`services/campaign-service/README.md`](services/campaign-service/README.md) ·
[`services/ai-service/README.md`](services/ai-service/README.md) ·
[`services/gamification-service/README.md`](services/gamification-service/README.md)

## Hızlı Başlangıç (Docker Compose)

**Gereksinimler:** Docker Desktop (veya Docker Engine + Compose plugin).

```bash
# 1) Depoyu klonlayın ve kök dizine geçin
git clone <repo-url> && cd Campaign-Cell

# 2) Tüm sistemi ayağa kaldırın (4 servis + 4 PostgreSQL + Redis + gateway = 10 konteyner)
docker compose up -d

# 3) Konteynerlerin sağlıklı (Up) durumda olduğunu doğrulayın
docker compose ps

# 4) Demo verisini yükleyin (her servis kendi veritabanını doldurur)
docker compose exec identity-service npm run seed
docker compose exec campaign-service npm run seed
docker compose exec ai-service npm run seed
docker compose exec gamification-service npm run seed

# 5) Gateway health check
curl http://localhost:3000/healthz
```

Sistem ayaktayken tüm API tek bir base URL üzerinden erişilebilir: **`http://localhost:3000/api/v1/...`**

```bash
# Logları izlemek için
docker compose logs -f

# Belirli bir servisin loglarını izlemek için
docker compose logs -f campaign-service

# Bir servisi kapatıp sistemin geri kalanının çalışmaya devam ettiğini kanıtlamak için
docker compose stop ai-service
curl -X POST http://localhost:3000/api/v1/campaigns -H "Authorization: Bearer <token>" ...  # yine 201 döner, segment: BELIRSIZ

# Durdurup temizlemek için
docker compose down        # konteynerleri kaldırır, veri kalır
docker compose down -v     # + veritabanı volume'lerini de siler
```

### Yerel geliştirme (Docker olmadan, servis bazında)

```bash
cd services/campaign-service
npm install
cp .env.example .env       # DATABASE_URL'i kendi Postgres'inize göre düzenleyin
npm run dev                # tsx watch ile canlı yeniden yükleme
npm test                   # vitest
```

## Sorun Giderme

- **`npm install` build sırasında `Exit handler never called!` hatası veriyor**: Bu, npm 10.9.x'in
  bilinen bir hatasıdır (npm/cli#7657) — kurulum aslında başarıyla tamamlanır, npm sadece kendi çıkış
  temizliğinde çöker. Dockerfile'lar bunu `node_modules` dolu mu diye kontrol ederek etrafından dolanır;
  yerelde çalıştırıyorsanız komutu tekrar çalıştırmanız yeterlidir.
- **Konteyner sürekli restart oluyor / `esbuild` platform hatası**: `package-lock.json` dosyaları
  kasıtlı olarak Docker imajına kopyalanmıyor — bu dosyalar Replit'in dahili paket proxy'sinde
  üretildiği için bazen yanlış platforma ait ikili paketleri (`@esbuild/aix-ppc64` gibi) sabitliyor.
  Konteyner içinde `npm install` her zaman `package.json`'dan taze çözümleme yapar, bu yüzden doğru
  platform (Linux/musl) paketleri kurulur.
- **`docker compose exec ... npm run seed` "connection refused" veriyor**: Veritabanı konteynerleri
  henüz hazır olmayabilir; birkaç saniye bekleyip tekrar deneyin, veya `docker compose ps` ile
  `postgres-*` servislerinin `Up` olduğunu doğrulayın.
- **Windows'ta `docker compose build` ile 4 servisi paralel build ederken ara sıra network hatası**:
  Bazı Docker Desktop/Windows kurulumlarında eşzamanlı npm kurulumları geçici ağ gecikmesi yaşayabilir;
  `docker compose build <servis-adı>` ile tek tek build etmek genelde sorunu çözer.

## Demo Kimlik Bilgileri

| Kullanıcı | Email | Şifre | Rol |
|-----------|-------|-------|-----|
| System Admin | admin@turkcell.com.tr | Demo1234! | ADMIN |
| Admin 2 | admin2@turkcell.com.tr | Demo1234! | ADMIN |
| Supervisor | burak.supervisor@turkcell.com.tr | Demo1234! | SUPERVISOR |
| Expert (Ahmet) | ahmet.expert@turkcell.com.tr | Demo1234! | CAMPAIGN_EXPERT |
| Expert (Ayşe) | ayse.expert@turkcell.com.tr | Demo1234! | CAMPAIGN_EXPERT |
| Subscriber (seed) | GSM: 05350000000 | OTP: 1234 | SUBSCRIBER |
| Subscriber (yeni kayıt) | `POST /api/v1/auth/request-otp` → `/register` | OTP: 1234 (simülasyon, sabit) | SUBSCRIBER |

## Kullanıcı Rolleri ve Yetki Matrisi

Endpoint seviyesinde uygulanan yetki matrisi (yetkisiz erişim denemesi `403` döner ve audit log'a
yazılır — bkz. [Güvenlik](#güvenlik)):

| İşlem | Müşteri | Personel (Uzman) | Süpervizör | Admin |
|---|:---:|:---:|:---:|:---:|
| Kampanya oluşturma | ✓ | – | – | – |
| Kendi kayıtlarını görme | ✓ | ✓ (atanan) | ✓ (tümü) | ✓ (tümü) |
| Durum değiştirme | – | ✓ | ✓ | – |
| Manuel atama | – | – | ✓ | – |
| Kategori/tür değiştirme (AI override) | – | ✓ | ✓ | – |
| Dashboard görüntüleme | – | – | ✓ | ✓ |
| Personel hesabı oluşturma | – | – | – | ✓ |
| Audit log görüntüleme | – | – | – | ✓ |

## Optimizasyon Vakası State Machine

Düşük dönüşümlü kampanyalar bir optimizasyon vakasına dönüşür. Kural dışı bir geçiş denemesi `422`
döner:

| Mevcut Durum | Hedef Durum | Kim Yapabilir | Koşul |
|---|---|---|---|
| YENI | ATANDI | Sistem (AI) / Süpervizör | Uzman belirlendi |
| ATANDI | OPTIMIZE_EDILIYOR | Atanan Uzman | Uzman çalışmaya başladı |
| OPTIMIZE_EDILIYOR | TEST_EDILIYOR | Atanan Uzman | A/B testi başlatıldı |
| TEST_EDILIYOR | OPTIMIZE_EDILIYOR | Sistem | Test sonuçlandı |
| OPTIMIZE_EDILIYOR | TAMAMLANDI | Atanan Uzman | Optimizasyon notu zorunlu |
| TAMAMLANDI | YAYINDA | Süpervizör | Onay verildi |
| YAYINDA | ARSIVLENDI | Sistem (zamanlayıcı) | Kampanya geçerlilik süresi doldu |

`campaign-service`'te arka planda çalışan bir zamanlayıcı (`src/lib/scheduler.ts`, 60 sn'de bir):
1. Geçerlilik süresi dolmuş `YAYINDA` vakalarını otomatik `ARSIVLENDI`'ya taşır.
2. SLA süresi dolan ama henüz işaretlenmemiş vakaları proaktif olarak `slaBreached=true` yapıp
   `campaign.sla_breached` olayını yayınlar (bir sonraki PATCH isteğini beklemeden).

## Segment, Öncelik ve SLA Kuralları

**Segment türleri** (AI tarafından atanır; uzman veya süpervizör değiştirebilir, değişiklik AI
servisine `segment.override` olayıyla bildirilir):
`YUKSEK_DEGER` · `RISKLI_KAYIP` · `YENI_ABONE` · `PASIF` · `BELIRSIZ`

**Öncelik seviyeleri**: `DUSUK` · `ORTA` · `YUKSEK` · `KRITIK` — `RISKLI_KAYIP` segmenti otomatik
olarak minimum `YUKSEK` öncelik alır (süpervizör manuel olarak daha da yükseltebilir).

| Öncelik | SLA Süresi | Aşım Durumunda |
|---|---|---|
| KRITIK | 2 saat | Vaka **kırmızı** işaretlenir, süpervizör panelinde en üstte görünür |
| YUKSEK | 8 saat | Vaka **turuncu** işaretlenir |
| ORTA | 24 saat | Görsel uyarı (sarı/amber) |
| DUSUK | 72 saat | Görsel uyarı (sarı/amber) |

SLA süresi vaka oluşturma anından itibaren sayılır, optimizasyon tamamlanınca durur. Kalan süre hem
uzman hem süpervizör ekranında görünür (`SLACountdown` bileşeni, `priority`'ye göre renklendirilir).

## API Endpoint Referansı

Tüm istekler gateway üzerinden `http://localhost:3000/api/v1/...` ile yapılır. Standart yanıt zarfı:
`{ success: boolean, data?: ..., error?: string }`. Tam şema için `lib/api-spec/openapi.yaml`.

### Identity Service (`/api/v1/auth`, `/api/v1/users`, `/api/v1/audit`)

```
POST   /api/v1/auth/login                 # email + şifre (personel/admin)
POST   /api/v1/auth/refresh               # refresh token rotasyonu
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
GET    /api/v1/auth/verify                # gateway auth_request için internal doğrulama
POST   /api/v1/auth/request-otp           # GSM + OTP simülasyonu (sabit kod: 1234)
POST   /api/v1/auth/register              # ad, soyad, gsmNumber, otp, email? → SUBSCRIBER kaydı
POST   /api/v1/auth/login-otp             # kayıtlı abone için GSM+OTP ile giriş

GET    /api/v1/users                      # ADMIN — sayfalı liste
POST   /api/v1/users                      # ADMIN — personel hesabı oluştur (uzmanlık/bölge atanabilir)
GET    /api/v1/users/:id                  # kendisi / SUPERVISOR / ADMIN (IDOR korumalı)
PATCH  /api/v1/users/:id                  # ADMIN — rol değişikliği ayrıca loglanır
POST   /api/v1/users/:id/lock
POST   /api/v1/users/:id/unlock

GET    /api/v1/audit                      # ADMIN — ?action=&userId= filtreli, sayfalı
```

### Campaign Service (`/api/v1/campaigns`, `/api/v1/cases`, `/api/v1/subscribers`, `/api/v1/experiments`, `/api/v1/analytics`)

```
GET    /api/v1/campaigns                  # ?status=&segment=
POST   /api/v1/campaigns                  # oluşturunca otomatik AI skorlama tetiklenir
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id
POST   /api/v1/campaigns/:id/publish
POST   /api/v1/campaigns/:id/archive
DELETE /api/v1/campaigns/:id              # ADMIN — audit log'a yazılır

GET    /api/v1/cases                      # ?status=&priority= — uzman sadece kendi vakalarını görür
GET    /api/v1/cases/:id
PATCH  /api/v1/cases/:id                  # status | segment | priority | optimizationNote
POST   /api/v1/cases/:id/assign           # {expertId,expertName} veya {auto:true} (AI skorlamalı atama)
POST   /api/v1/cases/:id/complete
POST   /api/v1/cases/:id/notes

GET    /api/v1/subscribers                              # sayfalı liste
GET    /api/v1/subscribers/:id
GET    /api/v1/subscribers/:id/campaigns                # aboneye özel teklifler
POST   /api/v1/subscribers/:id/offers/:campaignId/accept
POST   /api/v1/subscribers/:id/offers/:campaignId/reject   # reason zorunlu, benzer tekliflerin skorunu düşürür
POST   /api/v1/subscribers/:id/offers/:campaignId/rate     # 1-5 yıldız, tek seferlik

GET    /api/v1/experiments                # A/B test yönetimi
GET    /api/v1/experiments/:id
POST   /api/v1/experiments
POST   /api/v1/experiments/:id/conclude

GET    /api/v1/analytics/dashboard             # SÜPERVIZÖR/ADMIN — KPI özet
GET    /api/v1/analytics/conversion-trend
GET    /api/v1/analytics/campaign-distribution # segment bazlı dağılım
GET    /api/v1/analytics/sla-compliance
GET    /api/v1/analytics/expert-kpis           # tamamlanan vaka, ortalama dönüşüm artışı, süre
```

### AI Service (`/api/v1/ai`)

```
POST   /api/v1/ai/recommend               # öneri skoru + dönüşüm olasılığı + segment + öncelik
POST   /api/v1/ai/predict                 # recommend ile aynı, alternatif isimlendirme
GET    /api/v1/ai/predictions             # SÜPERVIZÖR/ADMIN
GET    /api/v1/ai/accuracy                # genel + segment bazlı doğruluk kırılımı
POST   /api/v1/ai/expert-assignment       # skorlama formülüyle en uygun uzmanı seçer
PATCH  /api/v1/ai/segment-override        # personel AI kategorisini değiştirdiğinde çağrılır
```

### Gamification Service (`/api/v1/game`)

```
GET    /api/v1/game/leaderboard?period=daily|weekly
GET    /api/v1/game/profile/:userId
GET    /api/v1/game/badges
GET    /api/v1/game/points-history/:userId
GET    /api/v1/game/events?userId=<id>    # Server-Sent Events — badge.earned, points.updated
```

## Yapay Zeka Yaklaşımı

Kendi eğittiğimiz iki scikit-learn modeli (segment sınıflandırma + dönüşüm tahmini), gerçekçi
sentetik eğitim verisiyle eğitilmiş ve ağırlıkları saf TypeScript'te inference edilecek şekilde
export edilmiştir (`services/ai-service/src/ml/`) — Docker imajında Python çalışma zamanı yoktur.
Model yüklenemezse deterministik ağırlıklı formüle otomatik döner (asla mock/sabit çıktı yok).
Detaylı metodoloji, eğitim süreci, özellik mühendisliği ve doğruluk metrikleri için:
[`AI_APPROACH.md`](AI_APPROACH.md).

- **Öneri/dönüşüm skorlama**: İkili Logistic Regression, ~%59 test doğruluğu (temel: %50).
  Skor < 0.60 aboneye gösterilmez, skor > 0.80 öncelikli/öne çıkan olarak işaretlenir.
- **Segment sınıflandırma**: Çok sınıflı Logistic Regression, ~%58 test doğruluğu (temel: %20) —
  `YUKSEK_DEGER` / `RISKLI_KAYIP` / `YENI_ABONE` / `PASIF` / `BELIRSIZ`; `RISKLI_KAYIP` otomatik
  yüksek öncelik alır.
- **Eğitim verisi**: `services/ai-service/training/` içinde üretim script'i (`generate_data.py`)
  ve eğitim script'i (`train_model.py`) repository'de paylaşılmıştır; `pip install -r
  requirements.txt` sonrası yeniden çalıştırılabilir.
- **Uzman atama**: `skor = uzmanlık_eşleşme × 0.5 + boşluk_oranı × 0.3 + performans × 0.2`
  (case'te verilen formül birebir uygulanır, ML değildir; kapasite: uzman başına 10 aktif vaka).
- **Doğruluk takibi**: personel/süpervizör AI kategorisini değiştirdiğinde "yanlış sınıflandırma"
  olarak kaydedilir; `/api/v1/ai/accuracy` genel ve segment bazlı isabet oranını, `/api/v1/ai/model-info`
  eğitilmiş modelin metadata'sını (doğruluk, eğitim tarihi, örnek sayısı) döner.

## Gamification Kuralları

**Puan tablosu**

| Olay | Puan | Koşul |
|---|---|---|
| Optimizasyon tamamlandı | +10 | Her tamamlama |
| Hızlı optimizasyon bonusu | +5 | 2 saatten kısa sürede |
| Dönüşüm hedefi aşıldı | +15 | conversionLift > 0.15 |
| KRITIK vaka SLA içinde tamamlandı | +15 | SLA içinde ve hızlı |
| SLA aşımı | -5 | Her aşım |
| Abone düşük puan verdi | -3 | 1-2 yıldız |

**Rozetler**: İlk Kampanya · Hız Ustası (2 saat altı 10 optimizasyon) · Dönüşüm Kralı (10 kampanyada
hedef aşımı) · Maratoncu (bir takvim gününde 20 optimizasyon) · Churn Avcısı (10 RISKLI_KAYIP vaka
kurtarma) · Uzman (**tek bir segmentte** 50 optimizasyon). Rozet kazanıldığı anda SSE üzerinden
frontend'e bildirim gider ve toast olarak gösterilir.

**Seviyeler**: Bronz (0-499) → Gümüş (500-1499) → Altın (1500-2999) → Platin (3000+).

## Olay Tabanlı Mimari (Event-Driven)

Servisler arası iletişimde Redis Pub/Sub tercih edilir (REST minimum kabul edilir). Tüm olaylar ve
payload şemaları: [`EVENTS.md`](EVENTS.md). Özet:

| Olay | Yayınlayan | Dinleyen | Amaç |
|---|---|---|---|
| `campaign.optimized` | campaign-service | gamification-service | Puan/rozet hesaplama |
| `campaign.sla_breached` | campaign-service | gamification-service | -5 puan cezası |
| `offer.accepted` / `offer.rejected` | campaign-service | — (gelecek: dönüşüm analitiği) | |
| `offer.rated` | campaign-service | gamification-service | Düşük puan cezası |
| `segment.override` | campaign-service | ai-service (REST) | Doğruluk metriği |
| `audit.log` | campaign / ai / gamification-service | identity-service | 403 ve kritik durum değişikliklerini merkezi audit log'a yazar (database-per-service kuralı bozulmadan) |
| `badge.earned` / `points.updated` | gamification-service | Frontend (SSE) | Gerçek zamanlı bildirim |

**Dayanıklılık kuralları**: AI servisi erişilemezse kampanya yine `BELIRSIZ`/`ORTA` ile oluşturulur;
Redis erişilemezse olay sessizce düşürülür ve istek başarısız sayılmaz (fire-and-forget).

## Güvenlik

- **Şifre politikası**: min 8 karakter, 1 büyük harf, 1 rakam, 1 özel karakter — ihlalde hangi kuralın
  ihlal edildiğini belirten hata mesajı döner.
- **Hash**: bcrypt (cost factor 12). Düz metin veya MD5/SHA1 kullanılmaz.
- **Hesap kilidi**: 5 başarısız girişte 15 dakika kilit; kilitli hesaba girişte kalan süre bilgisi döner.
- **JWT access token**: 15 dakika geçerlilik, payload'da `user_id`, `rol`, `uzmanlık`, `bölge`.
- **Refresh token**: 7 gün, veritabanında saklanır. **Token rotation**: her kullanımda yeni refresh
  token üretilir, eskisi geçersiz kılınır. İptal edilmiş bir token yeniden kullanılmaya çalışılırsa
  o kullanıcının **tüm oturumları** sonlandırılır (theft protection).
- **Rol/yetki matrisi** endpoint seviyesinde uygulanır; yetkisiz erişim (`403`) **audit log'a yazılır**
  (bkz. [Olay Tabanlı Mimari](#olay-tabanlı-mimari-event-driven) — `audit.log` kanalı).
- **Audit log** alanları: kim (user_id), ne (action), ne zaman (timestamp), nereden (IP), sonuç
  (başarılı/başarısız), detay. Kaydedilen olaylar: giriş denemeleri, hesap kilitlenmesi, rol
  değişiklikleri, yetkisiz erişim denemeleri, kampanya silme, kritik durum değişiklikleri.
- **Rate limiting**: gateway'de auth 10r/dk, genel API 200r/dk (nginx `limit_req_zone`); ayrıca
  `identity-service`'te `express-rate-limit` ile ikinci savunma katmanı.
- **Gateway JWT doğrulama**: nginx `auth_request` ile `/api/v1/users` ve `/api/v1/audit` gibi her
  zaman korumalı rotalarda token, backend'e ulaşmadan önce doğrulanır; tüm servisler ayrıca kendi
  `jwt.verify` kontrolünü de yapar (defense in depth).
- **SQL injection**: tüm sorgular Drizzle ORM / parametreli sorgular ile yapılır, ham string
  birleştirme yoktur.
- **XSS**: React'in otomatik escape'i + gateway güvenlik başlıkları (`X-XSS-Protection`,
  `X-Content-Type-Options`, `X-Frame-Options`).
- **IDOR koruması**: kayıt ID değiştirerek başka kullanıcının verisine erişim denemeleri `403` döner
  ve audit log'a yazılır (`services/identity-service/src/routes/users.ts`,
  `services/campaign-service/src/routes/cases.ts`).

## Test

```bash
# Servis bazında (identity-service, campaign-service, ai-service)
cd services/<servis-adı> && npm test

# Docker içinde
docker compose exec campaign-service npm test
```

## Proje Yapısı

```
.
├── docker-compose.yml          # 10 konteyner: 4 PostgreSQL, Redis, 4 servis, nginx
├── services/
│   ├── gateway/
│   │   ├── nginx.conf
│   │   └── Dockerfile
│   ├── identity-service/       # Port 3001
│   ├── campaign-service/       # Port 3002
│   ├── ai-service/             # Port 3003
│   └── gamification-service/   # Port 3004
├── artifacts/
│   ├── campaigncell/           # React frontend (Replit preview)
│   └── api-server/             # Legacy mockup (docker-compose'a dahil değil)
├── lib/
│   └── api-spec/
│       └── openapi.yaml        # Swagger/OpenAPI spec (tüm servisler)
├── EVENTS.md                   # Redis event mimarisi ve payload şemaları
├── AI_APPROACH.md              # AI metodoloji belgesi
└── README.md
```

## Ortam Değişkenleri

Her servisin `.env.example` dosyası vardır. Docker Compose ile çalıştırırken bu değerler
`docker-compose.yml` içinde önceden tanımlıdır; yerel geliştirme için `.env.example`'ı `.env`'e
kopyalayıp düzenleyin.

| Değişken | Açıklama | Hangi servisler |
|---|---|---|
| `PORT` | HTTP portu | tümü |
| `DATABASE_URL` | PostgreSQL bağlantı dizesi (servise özel DB) | tümü |
| `REDIS_URL` | Redis bağlantı adresi | identity, campaign, ai, gamification |
| `JWT_SECRET` | Token imzalama anahtarı (tüm servislerde aynı olmalı) | tümü |
| `SERVICE_TOKEN` | Servisler arası dahili çağrılar için paylaşılan sır (`X-Service-Token`) | tümü |
| `AI_SERVICE_URL` | AI servisinin dahili adresi | campaign-service |

## Değerlendirme Kriterleri Eşlemesi

| Kategori | Bu depoda nerede |
|---|---|
| Mimari ve Kod Kalitesi | Database-per-service (`docker-compose.yml`), event tasarımı (`EVENTS.md`), gateway (`services/gateway/nginx.conf`) |
| Fonksiyonellik | 4 servisin zorunlu özellikleri, state machine (`campaign-service/src/routes/cases.ts`), gamification kuralları |
| Güvenlik | [Güvenlik](#güvenlik) bölümü, canlı audit log doğrulaması |
| UI/UX Kalitesi | `artifacts/campaigncell` — responsive, loading/error/empty state'ler |
| Test ve Dokümantasyon | Vitest paketleri, bu README, `EVENTS.md`, `AI_APPROACH.md`, `lib/api-spec/openapi.yaml` |
| Sunum ve Canlı Demo | [Hızlı Başlangıç](#hızlı-başlangıç-docker-compose) bölümündeki servis kapatma senaryosu |
