import { Router, type Request, type Response } from 'express';
import { eq, desc, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersTable } from '../db/schema.js';
import type { NewUser } from '../db/schema.js';
import { hashPassword, validatePasswordPolicy } from '../lib/auth.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { logAudit, getIp } from '../lib/audit.js';

const router = Router();

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

// GET /v1/users — list users (ADMIN only — Sistem Yöneticisi)
router.get('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
    const offset = (page - 1) * limit;

    const [users, totalResult] = await Promise.all([
      db
        .select()
        .from(usersTable)
        .orderBy(desc(usersTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(usersTable),
    ]);

    const total = totalResult[0]?.total ?? 0;

    res.json({
      success: true,
      data: {
        users: users.map(sanitizeUser),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /v1/users/:id — get user (IDOR: non-admin can only see themselves)
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const requestingUser = req.user!;

  // Non-admin/supervisor can only see themselves
  if (
    requestingUser.role !== 'ADMIN' &&
    requestingUser.role !== 'SUPERVISOR' &&
    requestingUser.id !== id
  ) {
    logAudit({
      userId: requestingUser.id,
      userName: requestingUser.name,
      action: 'UNAUTHORIZED_ACCESS',
      resource: req.originalUrl,
      resourceId: id,
      result: 'FAILURE',
      ipAddress: getIp(req),
      details: `Attempted to access another user's record (IDOR) as role ${requestingUser.role}`,
    });
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: { user: sanitizeUser(user) } });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/users — create user (ADMIN only)
router.post('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const {
    name,
    email,
    role,
    password,
    gsmNumber,
    expertise,
    region,
  } = req.body as {
    name?: string;
    email?: string;
    role?: string;
    password?: string;
    gsmNumber?: string;
    expertise?: string[];
    region?: string[];
  };
  const ip = getIp(req);

  if (!name || !email || !role || !password) {
    res.status(400).json({ success: false, error: 'name, email, role, and password are required' });
    return;
  }

  const validRoles = ['SUBSCRIBER', 'CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'];
  if (!validRoles.includes(role)) {
    res
      .status(400)
      .json({ success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }

  const policyResult = validatePasswordPolicy(password);
  if (!policyResult.valid) {
    res.status(400).json({
      success: false,
      error: 'Password does not meet policy requirements',
      errors: policyResult.errors,
    });
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    const newUserData = {
      name,
      email,
      role: role as 'SUBSCRIBER' | 'CAMPAIGN_EXPERT' | 'SUPERVISOR' | 'ADMIN',
      passwordHash,
      gsmNumber: gsmNumber || null,
      expertise: expertise || [],
      region: region || [],
    } as unknown as NewUser;

    const [newUser] = await db.insert(usersTable).values(newUserData).returning();

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'USER_CREATED',
      resource: 'users',
      resourceId: newUser.id,
      result: 'SUCCESS',
      ipAddress: ip,
      details: `Created user ${email} with role ${role}`,
    });

    res.status(201).json({ success: true, data: { user: sanitizeUser(newUser) } });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ success: false, error: 'A user with that email or GSM number already exists' });
      return;
    }
    console.error('Create user error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PATCH /v1/users/:id — update user (ADMIN only)
router.patch('/:id', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const ip = getIp(req);

  const allowedFields = ['name', 'email', 'role', 'gsmNumber', 'expertise', 'region'];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in req.body) {
      if (field === 'role') {
        const validRoles = ['SUBSCRIBER', 'CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'];
        if (!validRoles.includes(req.body[field] as string)) {
          res.status(400).json({
            success: false,
            error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
          });
          return;
        }
      }
      updates[field] = req.body[field];
    }
  }

  // Handle password update separately
  if ('password' in req.body && req.body.password) {
    const policyResult = validatePasswordPolicy(req.body.password as string);
    if (!policyResult.valid) {
      res.status(400).json({
        success: false,
        error: 'Password does not meet policy requirements',
        errors: policyResult.errors,
      });
      return;
    }
    updates['passwordHash'] = await hashPassword(req.body.password as string);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ success: false, error: 'No valid fields to update' });
    return;
  }

  try {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);

    const [user] = await db
      .update(usersTable)
      .set(updates as Partial<typeof usersTable.$inferInsert>)
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if ('role' in updates && existingUser && existingUser.role !== updates['role']) {
      await logAudit({
        userId: req.user!.id,
        userName: req.user!.name,
        action: 'ROLE_CHANGED',
        resource: 'users',
        resourceId: id,
        result: 'SUCCESS',
        ipAddress: ip,
        details: `${existingUser.role} -> ${updates['role']} for ${user.email}`,
      });
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'USER_UPDATED',
      resource: 'users',
      resourceId: id,
      result: 'SUCCESS',
      ipAddress: ip,
      details: `Updated fields: ${Object.keys(updates).join(', ')}`,
    });

    res.json({ success: true, data: { user: sanitizeUser(user) } });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ success: false, error: 'A user with that email or GSM number already exists' });
      return;
    }
    console.error('Update user error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/users/:id/lock — lock user (ADMIN only)
router.post('/:id/lock', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const ip = getIp(req);

  try {
    const [user] = await db
      .update(usersTable)
      .set({ isLocked: true, lockedUntil: null })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'USER_LOCKED',
      resource: 'users',
      resourceId: id,
      result: 'SUCCESS',
      ipAddress: ip,
      details: `Admin locked user ${user.email}`,
    });

    res.json({ success: true, data: { user: sanitizeUser(user), message: 'User locked successfully' } });
  } catch (err) {
    console.error('Lock user error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /v1/users/:id/unlock — unlock user (ADMIN only)
router.post('/:id/unlock', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const ip = getIp(req);

  try {
    const [user] = await db
      .update(usersTable)
      .set({ isLocked: false, loginAttempts: 0, lockedUntil: null })
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    await logAudit({
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'USER_UNLOCKED',
      resource: 'users',
      resourceId: id,
      result: 'SUCCESS',
      ipAddress: ip,
      details: `Admin unlocked user ${user.email}`,
    });

    res.json({ success: true, data: { user: sanitizeUser(user), message: 'User unlocked successfully' } });
  } catch (err) {
    console.error('Unlock user error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
