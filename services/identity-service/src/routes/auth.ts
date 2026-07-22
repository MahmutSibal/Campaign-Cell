import { Router, type Request, type Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersTable, refreshTokensTable } from '../db/schema.js';
import { signToken, verifyPassword, generateRefreshToken } from '../lib/auth.js';
import { logAudit, getIp } from '../lib/audit.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

function buildUserResponse(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gsmNumber: user.gsmNumber,
    isLocked: user.isLocked,
    createdAt: user.createdAt,
    expertise: user.expertise,
    region: user.region,
  };
}

// Fixed simulation OTP code — the case spec explicitly calls for a hardcoded
// "1234" instead of sending a real SMS.
const SIMULATED_OTP = '1234';

// Normalizes a Turkish GSM number to the canonical `05XXXXXXXXX` (11 digit)
// form. Accepts `05XXXXXXXXX`, `+905XXXXXXXXX`, `905XXXXXXXXX`, and bare
// `5XXXXXXXXX`. Returns null if the input isn't a plausible Turkish mobile
// number.
function normalizeGsmNumber(raw: string): string | null {
  const trimmed = raw.replace(/[\s\-()]/g, '');

  let digits: string;
  if (/^\+90\d{10}$/.test(trimmed)) {
    digits = `0${trimmed.slice(3)}`;
  } else if (/^90\d{10}$/.test(trimmed)) {
    digits = `0${trimmed.slice(2)}`;
  } else if (/^0\d{10}$/.test(trimmed)) {
    digits = trimmed;
  } else if (/^5\d{9}$/.test(trimmed)) {
    digits = `0${trimmed}`;
  } else {
    return null;
  }

  // Turkish mobile numbers are 11 digits and start with "05".
  if (!/^05\d{9}$/.test(digits)) return null;
  return digits;
}

// POST /v1/auth/login  — email + şifre
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip = getIp(req);

  try {
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'email ve password gereklidir' });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal if user exists — user enumeration prevention
      await logAudit({
        action: 'LOGIN_FAILED',
        resource: 'auth',
        result: 'FAILURE',
        ipAddress: ip,
        details: `Unknown email: ${email}`,
      });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check lock
    if (user.isLocked) {
      const lockedUntil = user.lockedUntil;
      if (lockedUntil && lockedUntil > new Date()) {
        const remainingSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        await logAudit({
          userId: user.id,
          userName: user.name,
          action: 'LOGIN_BLOCKED',
          resource: 'auth',
          result: 'FAILURE',
          ipAddress: ip,
          details: 'Account locked',
        });
        res.status(401).json({
          success: false,
          error: 'Account is locked',
          lockedUntil: lockedUntil.toISOString(),
          remainingSeconds,
        });
        return;
      }
      // Lock expired — unlock
      await db
        .update(usersTable)
        .set({ isLocked: false, loginAttempts: 0, lockedUntil: null })
        .where(eq(usersTable.id, user.id));
    }

    if (!user.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      const newAttempts = (user.loginAttempts ?? 0) + 1;

      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await db
          .update(usersTable)
          .set({ loginAttempts: newAttempts, isLocked: true, lockedUntil })
          .where(eq(usersTable.id, user.id));

        await logAudit({
          userId: user.id,
          userName: user.name,
          action: 'ACCOUNT_LOCKED',
          resource: 'auth',
          result: 'FAILURE',
          ipAddress: ip,
          details: `Locked after ${newAttempts} failed attempts`,
        });

        res.status(401).json({
          success: false,
          error: 'Account has been locked due to too many failed login attempts',
          lockedUntil: lockedUntil.toISOString(),
          remainingSeconds: 15 * 60,
        });
        return;
      }

      await db
        .update(usersTable)
        .set({ loginAttempts: newAttempts })
        .where(eq(usersTable.id, user.id));

      await logAudit({
        userId: user.id,
        userName: user.name,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        result: 'FAILURE',
        ipAddress: ip,
        details: `Failed attempt ${newAttempts}/5`,
      });

      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Successful login — reset attempts
    await db
      .update(usersTable)
      .set({ loginAttempts: 0, lastLoginAt: new Date(), isLocked: false, lockedUntil: null })
      .where(eq(usersTable.id, user.id));

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      gsmNumber: user.gsmNumber,
      role: user.role,
      expertise: user.expertise,
      region: user.region,
    };

    const accessToken = signToken(tokenPayload, 15 * 60);
    const refreshTokenValue = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt,
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      result: 'SUCCESS',
      ipAddress: ip,
      details: 'Email/password login',
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: refreshTokenValue,
        user: buildUserResponse(user),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  const ip = getIp(req);

  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'refreshToken is required' });
    return;
  }

  try {
    const [tokenRecord] = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.token, refreshToken))
      .limit(1);

    if (!tokenRecord) {
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    // Token already revoked → revoke ALL tokens for user (theft detection)
    if (tokenRecord.revokedAt !== null) {
      await db
        .update(refreshTokensTable)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokensTable.userId, tokenRecord.userId as string),
            isNull(refreshTokensTable.revokedAt),
          ),
        );

      await logAudit({
        userId: tokenRecord.userId ?? undefined,
        action: 'REFRESH_TOKEN_THEFT_DETECTED',
        resource: 'auth',
        result: 'FAILURE',
        ipAddress: ip,
        details: 'Revoked token reuse detected — all tokens revoked',
      });

      res.status(401).json({ success: false, error: 'Token has been revoked. Please log in again.' });
      return;
    }

    // Token expired
    if (tokenRecord.expiresAt < new Date()) {
      res.status(401).json({ success: false, error: 'Refresh token has expired. Please log in again.' });
      return;
    }

    // Revoke old token
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.id, tokenRecord.id));

    // Get user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, tokenRecord.userId as string))
      .limit(1);

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      gsmNumber: user.gsmNumber,
      role: user.role,
      expertise: user.expertise,
      region: user.region,
    };

    const accessToken = signToken(tokenPayload, 15 * 60);
    const newRefreshTokenValue = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: newRefreshTokenValue,
      expiresAt,
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'TOKEN_REFRESHED',
      resource: 'auth',
      result: 'SUCCESS',
      ipAddress: ip,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshTokenValue,
        user: buildUserResponse(user),
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  const ip = getIp(req);

  try {
    if (refreshToken) {
      await db
        .update(refreshTokensTable)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokensTable.token, refreshToken),
            eq(refreshTokensTable.userId, req.user!.id),
            isNull(refreshTokensTable.revokedAt),
          ),
        );
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'LOGOUT',
      resource: 'auth',
      result: 'SUCCESS',
      ipAddress: ip,
    });

    res.json({ success: true, data: { success: true } });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /v1/auth/verify — used by the gateway (nginx auth_request) to validate a
// bearer token before proxying to sensitive downstream routes.
router.get('/verify', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: { valid: true, userId: req.user!.id, role: req.user!.role } });
});

// GET /v1/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { user: buildUserResponse(user) } });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/auth/request-otp — GSM+OTP self-registration/login, step 1.
// Simulation only: no real SMS is sent, the code is always fixed (1234), and
// the hint is returned in the response so the demo/frontend can proceed
// without a real telecom SMS gateway.
router.post('/request-otp', authLimiter, async (req: Request, res: Response) => {
  const { gsmNumber } = req.body as { gsmNumber?: string };

  if (!gsmNumber) {
    res.status(400).json({ success: false, error: 'gsmNumber is required' });
    return;
  }

  const normalized = normalizeGsmNumber(gsmNumber);
  if (!normalized) {
    res.status(400).json({ success: false, error: 'Invalid GSM number format' });
    return;
  }

  res.json({
    success: true,
    data: {
      message: 'OTP sent',
      otpHint: SIMULATED_OTP,
    },
  });
});

// POST /v1/auth/register — GSM+OTP self-registration for SUBSCRIBER users.
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const { ad, soyad, gsmNumber, otp, email } = req.body as {
    ad?: string;
    soyad?: string;
    gsmNumber?: string;
    otp?: string;
    email?: string;
  };
  const ip = getIp(req);

  if (!ad || !soyad || !gsmNumber || !otp) {
    res.status(400).json({ success: false, error: 'ad, soyad, gsmNumber ve otp gereklidir' });
    return;
  }

  const normalizedGsm = normalizeGsmNumber(gsmNumber);
  if (!normalizedGsm) {
    res.status(400).json({ success: false, error: 'Invalid GSM number format' });
    return;
  }

  if (otp !== SIMULATED_OTP) {
    await logAudit({
      action: 'SUBSCRIBER_REGISTER_FAILED',
      resource: 'auth',
      result: 'FAILURE',
      ipAddress: ip,
      details: `Invalid OTP for GSM: ${normalizedGsm}`,
    });
    res.status(401).json({ success: false, error: 'Invalid OTP' });
    return;
  }

  try {
    const name = `${ad} ${soyad}`.trim();

    const [newUser] = await db
      .insert(usersTable)
      .values({
        name,
        email: email || null,
        gsmNumber: normalizedGsm,
        role: 'SUBSCRIBER',
        expertise: [],
        region: [],
        passwordHash: null,
      } as typeof usersTable.$inferInsert)
      .returning();

    const tokenPayload = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      gsmNumber: newUser.gsmNumber,
      role: newUser.role,
      expertise: newUser.expertise,
      region: newUser.region,
    };

    const accessToken = signToken(tokenPayload, 15 * 60);
    const refreshTokenValue = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokensTable).values({
      userId: newUser.id,
      token: refreshTokenValue,
      expiresAt,
    });

    await logAudit({
      userId: newUser.id,
      userName: newUser.name,
      action: 'SUBSCRIBER_REGISTERED',
      resource: 'auth',
      resourceId: newUser.id,
      result: 'SUCCESS',
      ipAddress: ip,
      details: `GSM+OTP self-registration: ${normalizedGsm}`,
    });

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken: refreshTokenValue,
        user: buildUserResponse(newUser),
      },
    });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res
        .status(409)
        .json({ success: false, error: 'A user with that email or GSM number already exists' });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/auth/login-otp — GSM+OTP login for already-registered SUBSCRIBER
// users (simulation: fixed code 1234, same as /request-otp and /register).
router.post('/login-otp', authLimiter, async (req: Request, res: Response) => {
  const { gsmNumber, otp } = req.body as { gsmNumber?: string; otp?: string };
  const ip = getIp(req);

  if (!gsmNumber || !otp) {
    res.status(400).json({ success: false, error: 'gsmNumber ve otp gereklidir' });
    return;
  }

  const normalizedGsm = normalizeGsmNumber(gsmNumber);
  if (!normalizedGsm) {
    res.status(400).json({ success: false, error: 'Invalid GSM number format' });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.gsmNumber, normalizedGsm))
      .limit(1);

    if (!user || user.role !== 'SUBSCRIBER') {
      // Don't reveal whether the GSM number is registered — enumeration prevention
      await logAudit({
        action: 'LOGIN_FAILED',
        resource: 'auth',
        result: 'FAILURE',
        ipAddress: ip,
        details: `Unknown/ineligible GSM for OTP login: ${normalizedGsm}`,
      });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Respect admin-initiated account locks (see /users/:id/lock). Unlike the
    // password login path, a wrong OTP does NOT increment/trigger a lockout
    // here: the OTP is a fixed simulated value, not a guessable secret whose
    // repeated mis-entry indicates a brute-force attack, so there is no
    // extra signal to act on beyond "did they send 1234 or not".
    if (user.isLocked) {
      const lockedUntil = user.lockedUntil;
      if (lockedUntil && lockedUntil > new Date()) {
        const remainingSeconds = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        await logAudit({
          userId: user.id,
          userName: user.name,
          action: 'LOGIN_BLOCKED',
          resource: 'auth',
          result: 'FAILURE',
          ipAddress: ip,
          details: 'Account locked',
        });
        res.status(401).json({
          success: false,
          error: 'Account is locked',
          lockedUntil: lockedUntil.toISOString(),
          remainingSeconds,
        });
        return;
      }
      // Lock expired — unlock
      await db
        .update(usersTable)
        .set({ isLocked: false, loginAttempts: 0, lockedUntil: null })
        .where(eq(usersTable.id, user.id));
    }

    if (otp !== SIMULATED_OTP) {
      await logAudit({
        userId: user.id,
        userName: user.name,
        action: 'LOGIN_FAILED',
        resource: 'auth',
        result: 'FAILURE',
        ipAddress: ip,
        details: 'Invalid OTP',
      });
      res.status(401).json({ success: false, error: 'Invalid OTP' });
      return;
    }

    await db
      .update(usersTable)
      .set({ loginAttempts: 0, lastLoginAt: new Date(), isLocked: false, lockedUntil: null })
      .where(eq(usersTable.id, user.id));

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      gsmNumber: user.gsmNumber,
      role: user.role,
      expertise: user.expertise,
      region: user.region,
    };

    const accessToken = signToken(tokenPayload, 15 * 60);
    const refreshTokenValue = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt,
    });

    await logAudit({
      userId: user.id,
      userName: user.name,
      action: 'LOGIN_SUCCESS',
      resource: 'auth',
      result: 'SUCCESS',
      ipAddress: ip,
      details: 'GSM/OTP login',
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: refreshTokenValue,
        user: buildUserResponse(user),
      },
    });
  } catch (err) {
    console.error('Login-otp error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
