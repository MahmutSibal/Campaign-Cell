import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, refreshTokensTable, subscribersTable } from "@workspace/db";
import { signToken, generateRefreshToken, hashPassword, verifyPassword, validatePasswordPolicy } from "../lib/auth.js";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

// Request OTP — simülasyon, OTP her zaman 1234
router.post("/v1/auth/request-otp", async (req, res): Promise<void> => {
  const { gsmNumber } = req.body;
  if (!gsmNumber) { res.status(400).json({ error: "gsmNumber gereklidir" }); return; }
  res.json({ success: true, message: "OTP gönderildi (simülasyon)" });
});

// Login — email+password (personel) veya gsmNumber+otp (abone)
router.post("/v1/auth/login", async (req, res): Promise<void> => {
  const { gsmNumber, otp, email, password } = req.body;

  // Personel girişi (email + şifre)
  if (email) {
    if (!password) { res.status(400).json({ error: "email ve password gereklidir" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) { res.status(401).json({ error: "Geçersiz e-posta veya şifre" }); return; }
    if (user.isLocked) { res.status(401).json({ error: "Hesap kilitli" }); return; }
    if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      // Increment failed attempts
      const attempts = parseInt(user.loginAttempts || "0") + 1;
      const lockUpdate: Record<string, unknown> = { loginAttempts: String(attempts) };
      if (attempts >= 5) {
        lockUpdate.isLocked = true;
        lockUpdate.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await db.update(usersTable).set(lockUpdate).where(eq(usersTable.id, user.id));
      res.status(401).json({ error: "Geçersiz e-posta veya şifre" }); return;
    }

    // Başarılı giriş — login attempts sıfırla, bcrypt'e migrate et
    const migratedHash = user.passwordHash.startsWith("$2")
      ? user.passwordHash
      : await hashPassword(password);

    await db.update(usersTable).set({
      lastLoginAt: new Date(),
      loginAttempts: "0",
      isLocked: false,
      lockedUntil: null,
      passwordHash: migratedHash,
    }).where(eq(usersTable.id, user.id));

    const accessToken = signToken({ id: user.id, role: user.role, name: user.name, email: user.email }, 900);
    const refreshToken = generateRefreshToken();
    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, gsmNumber: user.gsmNumber, isLocked: false, createdAt: user.createdAt?.toISOString() },
    });
    return;
  }

  // Abone girişi (GSM + OTP simülasyon: 1234)
  if (gsmNumber) {
    if (otp !== "1234") { res.status(401).json({ error: "Geçersiz OTP" }); return; }

    const [subscriber] = await db.select().from(subscribersTable)
      .where(eq(subscribersTable.gsmNumber, gsmNumber)).limit(1);

    if (subscriber) {
      const accessToken = signToken({ id: subscriber.id, role: "SUBSCRIBER", name: subscriber.name, email: `${gsmNumber.replace("+", "")}@subscriber.local` }, 900);
      const refreshToken = generateRefreshToken();

      let [userEntry] = await db.select().from(usersTable).where(eq(usersTable.gsmNumber, gsmNumber)).limit(1);
      if (!userEntry) {
        [userEntry] = await db.insert(usersTable).values({
          name: subscriber.name,
          email: `${gsmNumber.replace("+", "")}@subscriber.local`,
          gsmNumber,
          role: "SUBSCRIBER",
          passwordHash: "otp-user",
        }).returning();
      }

      await db.insert(refreshTokensTable).values({
        userId: userEntry.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      });

      res.json({
        accessToken,
        refreshToken,
        user: { id: subscriber.id, name: subscriber.name, email: `${gsmNumber.replace("+", "")}@subscriber.local`, role: "SUBSCRIBER" as const, gsmNumber: subscriber.gsmNumber, isLocked: false, createdAt: subscriber.createdAt?.toISOString() },
      });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.gsmNumber, gsmNumber)).limit(1);
    if (!user) { res.status(404).json({ error: "Bu GSM numarası kayıtlı değil" }); return; }
    if (user.isLocked) { res.status(401).json({ error: "Hesap kilitli" }); return; }

    const accessToken = signToken({ id: user.id, role: "SUBSCRIBER", name: user.name, email: user.email }, 900);
    const refreshToken = generateRefreshToken();
    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: "SUBSCRIBER" as const, gsmNumber: user.gsmNumber, isLocked: false, createdAt: user.createdAt?.toISOString() },
    });
    return;
  }

  res.status(400).json({ error: "gsmNumber veya email gereklidir" });
});

// Refresh token
router.post("/v1/auth/refresh", async (req, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(400).json({ error: "refreshToken gereklidir" }); return; }

  const [token] = await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.token, refreshToken)).limit(1);
  if (!token || token.revokedAt || new Date(token.expiresAt) < new Date()) {
    res.status(401).json({ error: "Geçersiz veya süresi dolmuş refresh token" }); return;
  }

  await db.update(refreshTokensTable).set({ revokedAt: new Date() }).where(eq(refreshTokensTable.token, refreshToken));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, token.userId)).limit(1);
  if (!user) { res.status(401).json({ error: "Kullanıcı bulunamadı" }); return; }

  const newAccessToken = signToken({ id: user.id, role: user.role, name: user.name, email: user.email }, 900);
  const newRefreshToken = generateRefreshToken();
  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: newRefreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, gsmNumber: user.gsmNumber, isLocked: user.isLocked, createdAt: user.createdAt?.toISOString() } });
});

// Logout
router.post("/v1/auth/logout", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.update(refreshTokensTable).set({ revokedAt: new Date() }).where(eq(refreshTokensTable.token, refreshToken));
  }
  res.json({ success: true, message: "Oturum kapatıldı" });
});

// Me
router.get("/v1/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id)).limit(1);
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, gsmNumber: user.gsmNumber, isLocked: user.isLocked, createdAt: user.createdAt?.toISOString() });
});

export default router;
