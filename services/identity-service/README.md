# Identity Service

Kullanıcı kimlik doğrulama, yetkilendirme, hesap yönetimi ve denetim kayıtları servisi.

## Port: 3001

## Sorumlulukar
- JWT tabanlı kimlik doğrulama (Access Token 15dk, Refresh Token 7 gün)
- Abone GSM+OTP kaydı ve girişi (`POST /v1/auth/request-otp` → `POST /v1/auth/register` veya `POST /v1/auth/login-otp`; simülasyon: sabit kod `1234`, gerçek SMS gönderilmez)
- Personel email + bcrypt girişi
- **5 başarısız giriş → 15 dakika hesap kilidi**
- Refresh token rotasyonu + hırsızlık tespiti (revoked token yeniden kullanılırsa TÜM oturumlar kapatılır)
- Şifre politikası: 8+ karakter, büyük harf, rakam, özel karakter
- Audit log (tüm güvenlik olayları kaydedilir)

## Endpointler

| Yöntem | Path | Açıklama | Yetki |
|--------|------|----------|-------|
| POST | /v1/auth/request-otp | Abone OTP gönder (simülasyon, sabit kod `1234`) | Public |
| POST | /v1/auth/register | Abone kaydı (ad, soyad, gsmNumber, otp, email?) | Public |
| POST | /v1/auth/login-otp | Kayıtlı abone için GSM+OTP girişi | Public |
| POST | /v1/auth/login | Personel email+şifre girişi | Public |
| POST | /v1/auth/refresh | Token yenile (rotasyon ile) | Public |
| POST | /v1/auth/logout | Oturumu kapat | Authenticated |
| GET | /v1/auth/me | Mevcut kullanıcı bilgisi | Authenticated |
| GET | /v1/users | Tüm kullanıcıları listele | SUPERVISOR/ADMIN |
| GET | /v1/users/:id | Kullanıcı detayı (IDOR korumalı) | Authenticated |
| POST | /v1/users | Yeni kullanıcı oluştur | ADMIN |
| PATCH | /v1/users/:id | Kullanıcı güncelle | ADMIN |
| POST | /v1/users/:id/lock | Hesabı kilitle | ADMIN |
| POST | /v1/users/:id/unlock | Hesap kilidini aç | ADMIN |
| GET | /v1/audit | Denetim kayıtları | ADMIN |
| GET | /healthz | Sağlık kontrolü | Public |

## Demo Kimlik Bilgileri

| Kullanıcı | Email | Şifre | Rol |
|-----------|-------|-------|-----|
| Admin | admin@turkcell.com.tr | Demo1234! | ADMIN |
| Supervisor | burak.supervisor@turkcell.com.tr | Demo1234! | SUPERVISOR |
| Expert | ahmet.expert@turkcell.com.tr | Demo1234! | CAMPAIGN_EXPERT |
| Subscriber | — | GSM: 05350000000, OTP: 1234 | SUBSCRIBER |

## Güvenlik Özellikleri
- Account lockout: 5 hatalı giriş → 15dk kilit
- Token theft detection: revoked token kullanımında tüm oturumlar sonlanır
- IDOR koruması: aboneler sadece kendi profillerini görebilir
- Rate limiting: auth 10r/15dk, API 200r/dk

## Ortam Değişkenleri

```
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@postgres-identity:5432/identity_db
REDIS_URL=redis://redis:6379
JWT_SECRET=change-me-in-production
SERVICE_TOKEN=campaigncell-internal-2026
```

## Seed

```bash
npm run seed
```
