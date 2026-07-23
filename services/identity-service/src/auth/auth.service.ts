import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';

/**
 * AuthService — Turkcell CodeNight 2026 Final Case §3 uyumlu kimlik/oturum yönetimi.
 *
 * Kapsam:
 *  - GSM + OTP (sabit simülasyon kodu 1234) ile abone girişi/otomatik kaydı.
 *  - Hesap kilitleme: 5 başarısız girişte 15 dk kilit + kalan süre bilgisi (§3.1).
 *  - Access JWT (15dk) + Refresh JWT (7 gün, DB'de saklanır) + token rotation.
 *  - Token theft koruması: geçersiz kılınmış refresh tekrar kullanılırsa tüm oturumlar sonlanır (§3.2).
 *  - Kapsamlı audit log: başarılı/başarısız giriş, kilitleme, token olayları (§3.4).
 */
@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_MINUTES = 15;
  private readonly REFRESH_EXPIRES_DAYS = 7;
  private readonly refreshSecret =
    process.env.JWT_REFRESH_SECRET ||
    (process.env.JWT_SECRET || 'super-secret-jwt-key') + '_refresh';

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  private otpStore = new Map<string, { code: string; expiresAt: number }>();

  // ==========================================================
  // AUDIT LOG (§3.4)
  // ==========================================================
  private async audit(
    userId: string | null,
    action: string,
    result: 'SUCCESS' | 'FAILURE',
    ip?: string,
    detail?: any,
    resourceId?: string,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action,
          result,
          ipAddress: ip ?? null,
          resourceId: resourceId ?? null,
          detail: detail ?? undefined,
        },
      });
    } catch (e) {
      console.error('[AUDIT] yazılamadı:', (e as Error).message);
    }
  }

  private async recordLoginAttempt(userId: string | null, ip: string | undefined, success: boolean) {
    try {
      await this.prisma.loginAttempt.create({
        data: { userId: userId ?? null, ipAddress: ip ?? null, success },
      });
    } catch (e) {
      console.error('[LOGIN_ATTEMPT] yazılamadı:', (e as Error).message);
    }
  }

  // ==========================================================
  // OTP (§3.1) — dinamik kod ARTIK yanıtta dönmez (güvenlik).
  // ==========================================================
  async sendOtp(gsmNumber: string, ip?: string) {
    const dynamicCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 3 * 60 * 1000; // 3 dk geçerli
    this.otpStore.set(gsmNumber, { code: dynamicCode, expiresAt });

    // Kod yalnızca sunucu loguna yazılır (SMS simülasyonu) — yanıtta ASLA dönmez.
    console.log(`[OTP SERVICE] GSM: ${gsmNumber} | Dinamik Kod: ${dynamicCode} | Sim Kod: 1234`);
    await this.audit(null, 'OTP_SENT', 'SUCCESS', ip, { gsmNumber });

    return {
      success: true,
      message: 'OTP SMS gönderildi (Simülasyon). Kodunuzu SMS ile aldınız.',
      gsmNumber,
      expiresInSeconds: 180,
      hint: 'Simülasyon ortamında sabit doğrulama kodu: 1234',
    };
  }

  async verifyOtp(gsmNumber: string, otpCode: string, ip?: string) {
    const stored = this.otpStore.get(gsmNumber);
    const isValidDynamic = !!stored && stored.expiresAt > Date.now() && stored.code === otpCode;
    const isValidSimulation = otpCode === '1234'; // Case §3.1 simülasyon kuralı

    if (!isValidDynamic && !isValidSimulation) {
      await this.audit(null, 'OTP_VERIFY_FAILED', 'FAILURE', ip, { gsmNumber });
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş OTP kodu');
    }

    this.otpStore.delete(gsmNumber);

    let user = await this.usersService.findByEmailOrGsm(gsmNumber);
    if (!user) {
      user = await this.usersService.create({
        role: 'SUBSCRIBER',
        gsmNumber,
        firstName: 'Abone',
        lastName: gsmNumber.substring(gsmNumber.length - 4),
        region: 'Türkiye',
        expertiseTags: [],
      });
    }

    await this.audit(user.id, 'OTP_LOGIN_SUCCESS', 'SUCCESS', ip);
    return this.issueTokens(user, ip);
  }

  // ==========================================================
  // ŞİFRE İLE GİRİŞ + HESAP KİLİTLEME (§3.1)
  // ==========================================================
  async validateUser(identifier: string, pass: string, ip?: string): Promise<any> {
    const user = await this.usersService.findByEmailOrGsm(identifier);

    if (!user) {
      await this.recordLoginAttempt(null, ip, false);
      await this.audit(null, 'LOGIN_FAILED', 'FAILURE', ip, { identifier, reason: 'user_not_found' });
      return null;
    }

    // Kilit kontrolü — kalan süre bilgisi ile
    if (user.isLocked && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      await this.recordLoginAttempt(user.id, ip, false);
      await this.audit(user.id, 'LOGIN_BLOCKED_LOCKED', 'FAILURE', ip, { remainingMinutes });
      throw new ForbiddenException(
        `Hesabınız güvenlik nedeniyle kilitlendi. Lütfen ${remainingMinutes} dakika sonra tekrar deneyin.`,
      );
    }

    // Süresi dolmuş kilidi otomatik temizle
    if (user.isLocked && user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
      await this.usersService.update(user.id, { isLocked: false, lockedUntil: null });
    }

    const ok = !!user.passwordHash && (await bcrypt.compare(pass, user.passwordHash));
    await this.recordLoginAttempt(user.id, ip, ok);

    if (!ok) {
      const since = new Date(Date.now() - this.LOCK_MINUTES * 60 * 1000);
      const failedCount = await this.prisma.loginAttempt.count({
        where: { userId: user.id, success: false, createdAt: { gte: since } },
      });

      if (failedCount >= this.MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + this.LOCK_MINUTES * 60 * 1000);
        await this.usersService.update(user.id, { isLocked: true, lockedUntil });
        await this.audit(user.id, 'ACCOUNT_LOCKED', 'FAILURE', ip, {
          failedAttempts: failedCount,
          lockedForMinutes: this.LOCK_MINUTES,
        });
        throw new ForbiddenException(
          `Çok fazla başarısız giriş denemesi. Hesabınız ${this.LOCK_MINUTES} dakika kilitlendi.`,
        );
      }

      await this.audit(user.id, 'LOGIN_FAILED', 'FAILURE', ip, {
        failedAttempts: failedCount,
        remainingBeforeLock: this.MAX_FAILED_ATTEMPTS - failedCount,
      });
      return null;
    }

    await this.audit(user.id, 'LOGIN_SUCCESS', 'SUCCESS', ip);
    const { passwordHash, ...result } = user;
    return result;
  }

  // ==========================================================
  // TOKEN ÜRETİMİ + ROTATION (§3.2)
  // ==========================================================
  private buildAccessPayload(user: any) {
    // Case §3.2: payload'da user_id, rol, uzmanlık/bölge alanları bulunmalıdır.
    return {
      sub: user.id,
      user_id: user.id,
      role: user.role,
      expertiseTags: user.expertiseTags ?? [],
      region: user.region ?? null,
      gsmNumber: user.gsmNumber ?? null,
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + this.REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const token = this.jwtService.sign(
      { sub: userId, jti, type: 'refresh' },
      { secret: this.refreshSecret, expiresIn: `${this.REFRESH_EXPIRES_DAYS}d` },
    );
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt,
      },
    });
    return token;
  }

  private async issueTokens(user: any, ip?: string) {
    const access_token = this.jwtService.sign(this.buildAccessPayload(user));
    const refresh_token = await this.createRefreshToken(user.id);

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: user.id,
        role: user.role,
        gsmNumber: user.gsmNumber,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        expertiseTags: user.expertiseTags ?? [],
        region: user.region ?? null,
      },
    };
  }

  async login(user: any, ip?: string) {
    return this.issueTokens(user, ip);
  }

  /**
   * Refresh token rotation + token theft koruması (§3.2).
   * - Geçerli refresh → yeni access + yeni refresh, eski geçersiz kılınır.
   * - Zaten geçersiz kılınmış (revoked) bir refresh tekrar kullanılırsa TOKEN THEFT kabul edilir
   *   ve o kullanıcının TÜM aktif oturumları sonlandırılır.
   */
  async refresh(refreshToken: string, ip?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token bulunamadı');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(refreshToken, { secret: this.refreshSecret });
    } catch {
      await this.audit(null, 'REFRESH_INVALID', 'FAILURE', ip);
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş refresh token');
    }

    const record = await this.prisma.refreshToken.findUnique({ where: { id: decoded.jti } });
    if (!record) {
      await this.audit(decoded.sub ?? null, 'REFRESH_UNKNOWN', 'FAILURE', ip);
      throw new UnauthorizedException('Refresh token tanınmıyor');
    }

    // TOKEN THEFT: geçersiz kılınmış token yeniden kullanılıyor
    if (record.isRevoked) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, isRevoked: false },
        data: { isRevoked: true },
      });
      await this.audit(record.userId, 'REFRESH_THEFT_DETECTED', 'FAILURE', ip, {
        reusedTokenId: record.id,
      });
      throw new UnauthorizedException(
        'Güvenlik ihlali: Bu refresh token daha önce kullanılmış. Tüm oturumlarınız güvenlik amacıyla sonlandırıldı.',
      );
    }

    if (new Date(record.expiresAt) <= new Date()) {
      await this.audit(record.userId, 'REFRESH_EXPIRED', 'FAILURE', ip);
      throw new UnauthorizedException('Refresh token süresi dolmuş');
    }

    const user = await this.usersService.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    // Rotation: yeni refresh üret, eskisini revoke et ve zincirle
    const newRefresh = await this.createRefreshToken(user.id);
    const newDecoded: any = this.jwtService.verify(newRefresh, { secret: this.refreshSecret });
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { isRevoked: true, replacedById: newDecoded.jti },
    });

    await this.audit(user.id, 'REFRESH_ROTATED', 'SUCCESS', ip);

    const access_token = this.jwtService.sign(this.buildAccessPayload(user));
    return {
      access_token,
      refresh_token: newRefresh,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }

  async logout(refreshToken: string, ip?: string) {
    if (!refreshToken) {
      return { success: true, message: 'Çıkış yapıldı' };
    }
    try {
      const decoded: any = this.jwtService.verify(refreshToken, { secret: this.refreshSecret });
      await this.prisma.refreshToken.updateMany({
        where: { id: decoded.jti, isRevoked: false },
        data: { isRevoked: true },
      });
      await this.audit(decoded.sub ?? null, 'LOGOUT', 'SUCCESS', ip);
    } catch {
      // Geçersiz token — sessizce başarılı dön (idempotent logout)
    }
    return { success: true, message: 'Oturum sonlandırıldı ve refresh token geçersiz kılındı.' };
  }

  // ==========================================================
  // ABONE KAYDI (§3.1) — şifre politikası uygulanır
  // ==========================================================
  async registerSubscriber(data: any, ip?: string) {
    let passwordHash: string | null = null;
    if (data.password) {
      this.assertPasswordPolicy(data.password);
      const salt = await bcrypt.genSalt();
      passwordHash = await bcrypt.hash(data.password, salt);
    }

    let existingUser: any = null;
    if (data.email) existingUser = await this.usersService.findByEmailOrGsm(data.email);
    if (!existingUser && data.gsmNumber)
      existingUser = await this.usersService.findByEmailOrGsm(data.gsmNumber);

    if (existingUser) {
      const updatedUser = await this.usersService.update(existingUser.id, {
        firstName: data.firstName || existingUser.firstName,
        lastName: data.lastName || existingUser.lastName,
        region: data.region || existingUser.region,
        passwordHash: passwordHash || existingUser.passwordHash,
      });
      await this.audit(updatedUser.id, 'SUBSCRIBER_UPDATED', 'SUCCESS', ip);
      return this.issueTokens(updatedUser, ip);
    }

    const user = await this.usersService.create({
      role: 'SUBSCRIBER',
      email: data.email,
      gsmNumber: data.gsmNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      region: data.region || 'İstanbul',
      expertiseTags: [],
      passwordHash,
    });

    await this.audit(user.id, 'SUBSCRIBER_REGISTERED', 'SUCCESS', ip);
    return this.issueTokens(user, ip);
  }

  /**
   * Şifre politikası (§3.1): min 8 karakter, en az 1 büyük harf, 1 rakam, 1 özel karakter.
   * İhlalde HANGİ kuralın ihlal edildiğini belirten net hata mesajı döner.
   */
  private assertPasswordPolicy(password: string) {
    const errors: string[] = [];
    if (!password || password.length < 8) errors.push('en az 8 karakter olmalı');
    if (!/[A-ZĞÜŞİÖÇ]/.test(password)) errors.push('en az 1 büyük harf içermeli');
    if (!/\d/.test(password)) errors.push('en az 1 rakam içermeli');
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password))
      errors.push('en az 1 özel karakter (@, #, ! vb.) içermeli');

    if (errors.length > 0) {
      throw new UnauthorizedException(`Şifre politikası ihlali: Şifreniz ${errors.join(', ')}.`);
    }
  }
}
