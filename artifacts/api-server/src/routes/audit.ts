import { Router } from "express";
import { eq, and, desc, count, gte, lte } from "drizzle-orm";
import { db, auditLogsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/v1/audit", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "50"));
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.userId) conditions.push(eq(auditLogsTable.userId, String(req.query.userId)));
  if (req.query.action) conditions.push(eq(auditLogsTable.action, String(req.query.action)));
  if (req.query.resource) conditions.push(eq(auditLogsTable.resource, String(req.query.resource)));
  if (req.query.from) conditions.push(gte(auditLogsTable.createdAt, new Date(String(req.query.from))));
  if (req.query.to) conditions.push(lte(auditLogsTable.createdAt, new Date(String(req.query.to))));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [data, totalRows] = await Promise.all([
    db.select().from(auditLogsTable).where(whereClause).orderBy(desc(auditLogsTable.createdAt)).limit(limit).offset(offset),
    db.select({ cnt: count() }).from(auditLogsTable).where(whereClause),
  ]);

  res.json({
    data: data.map(l => ({
      id: l.id, userId: l.userId, userName: l.userName, action: l.action,
      resource: l.resource, resourceId: l.resourceId ?? null, result: l.result,
      ipAddress: l.ipAddress, details: l.details ?? null, createdAt: l.createdAt?.toISOString(),
    })),
    total: Number(totalRows[0]?.cnt ?? 0), page, limit,
  });
});

export default router;
