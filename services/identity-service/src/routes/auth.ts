import { Router, type Request, type Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersTable, refreshTokensTable, auditLogsTable } from '../db/schema.js';
import { signToken, verifyPassword, generateRefreshToken } from '../lib/auth.js';
import { publishEvent } from '../lib/redis.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

async function logAudit(params: {
  userId?: string;
  userName?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  result?: string;
  ipAddress?: string;
  details?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      result: params.result ?? 'SUCCESS',
      ipAddress: params.ipAddress,
      details: params.details,
    });
    await publishEvent('audit:events', {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // don't fail the request if audit logging fails
  }
}

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

// POST /v1/auth/login  — email + şifre
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const ip = getIp(req);

  try {
    if (!email || !password) {
      res.status(400).json({ error: 'email ve password gereklidir' });
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
      res.status(401).json({ error: 'Invalid credentials' });
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
      res.status(401).json({ error: 'Invalid credentials' });
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

      res.status(401).json({ error: 'Invalid credentials' });
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
      data: {
        accessToken,
        refreshToken: refreshTokenValue,
        user: buildUserResponse(user),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  const ip = getIp(req);

  if (!refreshToken) {
    res.status(400).json({ error: 'refreshToken is required' });
    return;
  }

  try {
    const [tokenRecord] = await db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.token, refreshToken))
      .limit(1);

    if (!tokenRecord) {
      res.status(401).json({ error: 'Invalid refresh token' });
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

      res.status(401).json({ error: 'Token has been revoked. Please log in again.' });
      return;
    }

    // Token expired
    if (tokenRecord.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token has expired. Please log in again.' });
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
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      gsmNumber: user.gsmNumber,
      role: user.role,
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
      data: {
        accessToken,
        refreshToken: newRefreshTokenValue,
        user: buildUserResponse(user),
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
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

    res.json({ data: { success: true } });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
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
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({ data: { user: buildUserResponse(user) } });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
