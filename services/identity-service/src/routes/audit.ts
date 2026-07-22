import { Router, type Request, type Response } from 'express';
import { eq, desc, count, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogsTable } from '../db/schema.js';
import { requireRole } from '../middleware/requireAuth.js';

const router = Router();

// GET /v1/audit — list audit logs (ADMIN only)
router.get('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10)));
    const offset = (page - 1) * limit;

    const { action, userId } = req.query as { action?: string; userId?: string };

    const conditions = [];
    if (action) conditions.push(eq(auditLogsTable.action, action));
    if (userId) conditions.push(eq(auditLogsTable.userId, userId));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, totalResult] = await Promise.all([
      db
        .select()
        .from(auditLogsTable)
        .where(whereClause)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(auditLogsTable).where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error('List audit logs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
