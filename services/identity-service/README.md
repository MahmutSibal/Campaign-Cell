# CampaignCell — Identity Service

Identity Service, Turkcell CampaignCell platformunun kimlik doğrulama, yetkilendirme (RBAC), token yönetimi, kullanıcı yönetimi ve güvenlik denetim (audit logging) mikroservisidir.

## 🚀 Sorumluluklar

- **GSM + OTP Girişi**: Müşteriler için dinamik ve simüle (1234) OTP SMS doğrulama.
- **E-Posta + Şifre Girişi**: Personel (Uzman, Süpervizör, Admin) hesapları için güvenli şifre doğrulama.
- **Şifre Politikası**: Minimum 8 karakter, 1 büyük harf, 1 rakam, 1 özel karakter kontrolü.
- **Hesap Kilitleme**: 5 başarısız giriş denemesinde hesabı 15 dakika kilitler.
- **JWT & Token Rotation**: 15 dakika geçerli Access Token + 7 gün geçerli Refresh Token. Refresh token kullanıldığında yeni token üretilir, eski token geçersiz kılınır (Token theft koruması).
- **Rol Tabanlı Yetkilendirme (RBAC)**: `SUBSCRIBER`, `CAMPAIGN_EXPERT`, `SUPERVISOR`, `ADMIN` rolleri.
- **Audit Logging**: Kritik yazma işlemlerini, şifre denemelerini ve yetkisiz erişimleri (403) veritabanına kaydeder.

## 📡 API Endpointleri

| Metot | Endpoint | Yetki | Açıklama |
|---|---|---|---|
| `POST` | `/auth/send-otp` | Public | Abone GSM numarasına OTP gönderir |
| `POST` | `/auth/verify-otp` | Public | OTP kodunu doğrular, JWT Access/Refresh Token döner |
| `POST` | `/auth/login` | Public | Personel e-posta + şifre ile giriş yapar |
| `POST` | `/auth/register` | Public | Yeni abone hesabı açar |
| `GET` | `/auth/profile` | Auth | Giriş yapmış kullanıcının profilini getirir |
| `GET` | `/admin/users` | ADMIN | Tüm kullanıcı hesaplarını listeler |
| `POST` | `/admin/users` | ADMIN | Yeni personel hesabı (Uzman/Süpervizör/Admin) oluşturur |
| `PATCH` | `/admin/users/:id/role` | ADMIN | Kullanıcı rolünü günceller |
| `PATCH` | `/admin/users/:id/unlock` | ADMIN | Kilitli kullanıcının kilidini kaldırır |
| `GET` | `/admin/audit-logs` | ADMIN, SUPERVISOR | Güvenlik ve denetim loglarını getirir |

## ⚙️ Environment Değişkenleri

```env
PORT=3001
DATABASE_URL=postgresql://campaigncell_user:campaigncell_secret_2026@identity-db:5432/identity_db?schema=public
JWT_SECRET=super_secret_jwt_key_turkcell_2026
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```
