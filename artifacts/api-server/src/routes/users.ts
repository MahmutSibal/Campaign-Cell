import { Router } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, usersTable, auditLogsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";
import { hashPassword, validatePasswordPolicy } from "../lib/auth.js";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, gsmNumber: u.gsmNumber,
    expertise: u.expertise ?? null, region: u.region ?? null, isLocked: u.isLocked,
    createdAt: u.createdAt?.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
  };
}

router.get("/v1/users", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== "ADMIN") { res.status(403).json({ error: "Erişim reddedildi" }); return; }
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.role) conditions.push(eq(usersTable.role, String(req.query.role)));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [data, totalRows] = await Promise.all([
    db.select().from(usersTable).where(whereClause).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
    db.select({ cnt: count() }).from(usersTable).where(whereClause),
  ]);

  res.json({ data: data.map(formatUser), total: Number(totalRows[0]?.cnt ?? 0), page, limit });
});

router.post("/v1/users", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== "ADMIN") { res.status(403).json({ error: "Erişim reddedildi" }); return; }
  const { name, email, gsmNumber, role, expertise, region, password } = req.body;
  if (!name || !email || !gsmNumber || !role) { res.status(400).json({ error: "name, email, gsmNumber, role gereklidir" }); return; }
  if (!password) { res.status(400).json({ error: "password gereklidir" }); return; }

  const policy = validatePasswordPolicy(password);
  if (!policy.valid) { res.status(400).json({ error: "Şifre politikası ihlali", errors: policy.errors }); return; }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ name, email, gsmNumber, role, expertise, region, passwordHash }).returning();
  await db.insert(auditLogsTable).values({ userId: req.user!.id, userName: req.user!.name, action: "USER_CREATED", resource: "users", resourceId: user.id, result: "SUCCESS", ipAddress: req.ip ?? "::1", details: `Created ${email} with role ${role}` });
  res.status(201).json(formatUser(user));
});

router.get("/v1/users/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (req.user?.role !== "ADMIN" && req.user?.role !== "SUPERVISOR" && req.user?.id !== id) {
    res.status(403).json({ error: "Erişim reddedildi" }); return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  res.json(formatUser(user));
});

router.patch("/v1/users/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== "ADMIN") { res.status(403).json({ error: "Erişim reddedildi" }); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, email, role, expertise, region, password } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (email !== undefined) update.email = email;
  if (role !== undefined) update.role = role;
  if (expertise !== undefined) update.expertise = expertise;
  if (region !== undefined) update.region = region;
  if (password) {
    const policy = validatePasswordPolicy(password);
    if (!policy.valid) { res.status(400).json({ error: "Şifre politikası ihlali", errors: policy.errors }); return; }
    update.passwordHash = await hashPassword(password);
  }

  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  await db.insert(auditLogsTable).values({ userId: req.user!.id, userName: req.user!.name, action: "USER_UPDATED", resource: "users", resourceId: id, result: "SUCCESS", ipAddress: req.ip ?? "::1" });
  res.json(formatUser(user));
});

router.post("/v1/users/:id/lock", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== "ADMIN") { res.status(403).json({ error: "Erişim reddedildi" }); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.update(usersTable).set({ isLocked: true }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  await db.insert(auditLogsTable).values({ userId: req.user!.id, userName: req.user!.name, action: "USER_LOCK", resource: "users", resourceId: id, result: "SUCCESS", ipAddress: req.ip ?? "::1" });
  res.json(formatUser(user));
});

router.post("/v1/users/:id/unlock", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (req.user?.role !== "ADMIN") { res.status(403).json({ error: "Erişim reddedildi" }); return; }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.update(usersTable).set({ isLocked: false, loginAttempts: "0", lockedUntil: null }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Kullanıcı bulunamadı" }); return; }
  await db.insert(auditLogsTable).values({ userId: req.user!.id, userName: req.user!.name, action: "USER_UNLOCK", resource: "users", resourceId: id, result: "SUCCESS", ipAddress: req.ip ?? "::1" });
  res.json(formatUser(user));
});

export default router;
