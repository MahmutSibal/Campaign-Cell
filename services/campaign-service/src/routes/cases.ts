import { Router, Request, Response } from 'express';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { optimizationCasesTable, caseNotesTable } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { publishEvent } from '../lib/redis.js';
import { getExpertAssignment } from '../lib/aiClient.js';

const router = Router();

function getIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

const CRITICAL_STATUSES = ['TAMAMLANDI', 'YAYINDA', 'ARSIVLENDI'];
const SEGMENT_TYPES = ['YUKSEK_DEGER', 'RISKLI_KAYIP', 'YENI_ABONE', 'PASIF', 'BELIRSIZ'];
const PRIORITY_LEVELS = ['DUSUK', 'ORTA', 'YUKSEK', 'KRITIK'];
const PRIORITY_RANK: Record<string, number> = { DUSUK: 0, ORTA: 1, YUKSEK: 2, KRITIK: 3 };

// SLA deadlines in milliseconds
const SLA_DURATIONS: Record<string, number> = {
  KRITIK: 2 * 60 * 60 * 1000,
  YUKSEK: 8 * 60 * 60 * 1000,
  ORTA: 24 * 60 * 60 * 1000,
  DUSUK: 72 * 60 * 60 * 1000,
};

type TransitionRule = { to: string; roles: string[] | 'assigned_expert' };
const TRANSITIONS: Record<string, TransitionRule[]> = {
  YENI: [{ to: 'ATANDI', roles: ['SUPERVISOR', 'ADMIN'] }],
  ATANDI: [{ to: 'OPTIMIZE_EDILIYOR', roles: 'assigned_expert' }],
  OPTIMIZE_EDILIYOR: [
    { to: 'TEST_EDILIYOR', roles: 'assigned_expert' },
    { to: 'TAMAMLANDI', roles: 'assigned_expert' },
  ],
  TEST_EDILIYOR: [{ to: 'OPTIMIZE_EDILIYOR', roles: ['CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'] }],
  TAMAMLANDI: [{ to: 'YAYINDA', roles: ['SUPERVISOR', 'ADMIN'] }],
  YAYINDA: [{ to: 'ARSIVLENDI', roles: ['SUPERVISOR', 'ADMIN'] }],
};

function getSlaStatus(caseRow: {
  slaDeadline: Date | null;
  status: string | null;
  slaBreached: boolean | null;
}): 'ok' | 'warning' | 'breached' {
  const terminalStatuses = ['TAMAMLANDI', 'YAYINDA', 'ARSIVLENDI'];
  if (!caseRow.slaDeadline || terminalStatuses.includes(caseRow.status ?? '')) return 'ok';
  if (caseRow.slaBreached) return 'breached';

  const now = Date.now();
  const deadline = new Date(caseRow.slaDeadline).getTime();
  const twoHours = 2 * 60 * 60 * 1000;

  if (now > deadline) return 'breached';
  if (deadline - now < twoHours) return 'warning';
  return 'ok';
}

function canTransition(
  fromStatus: string,
  toStatus: string,
  userRole: string,
  userId: string,
  caseRow: { assignedExpertId: string | null },
): boolean {
  const rules = TRANSITIONS[fromStatus];
  if (!rules) return false;

  const rule = rules.find((r) => r.to === toStatus);
  if (!rule) return false;

  if (rule.roles === 'assigned_expert') {
    return caseRow.assignedExpertId === userId;
  }
  return (rule.roles as string[]).includes(userRole);
}

// GET /v1/cases
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'))));
    const offset = (page - 1) * limit;
    const status = req.query['status'] as string | undefined;
    const priority = req.query['priority'] as string | undefined;

    const conditions = [];

    if (req.user?.role === 'CAMPAIGN_EXPERT') {
      conditions.push(eq(optimizationCasesTable.assignedExpertId, req.user.id));
    }
    if (status) {
      conditions.push(eq(optimizationCasesTable.status, status));
    }
    if (priority) {
      conditions.push(eq(optimizationCasesTable.priority, priority));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, cases] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(optimizationCasesTable).where(whereClause),
      db
        .select()
        .from(optimizationCasesTable)
        .where(whereClause)
        .orderBy(sql`created_at DESC`)
        .limit(limit)
        .offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const casesWithSla = cases.map((c) => ({
      ...c,
      slaStatus: getSlaStatus({ slaDeadline: c.slaDeadline, status: c.status, slaBreached: c.slaBreached }),
    }));

    res.json({ success: true, data: casesWithSla, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch cases' });
  }
});

// GET /v1/cases/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const [caseRow] = await db
      .select()
      .from(optimizationCasesTable)
      .where(eq(optimizationCasesTable.id, id));

    if (!caseRow) {
      res.status(404).json({ success: false, error: 'Case not found' });
      return;
    }

    if (req.user?.role === 'CAMPAIGN_EXPERT' && caseRow.assignedExpertId !== req.user.id) {
      publishEvent('audit.log', {
        userId: req.user.id,
        userName: req.user.name,
        action: 'UNAUTHORIZED_ACCESS',
        resource: req.originalUrl,
        resourceId: id,
        result: 'FAILURE',
        ipAddress: getIp(req),
        details: 'Expert attempted to access a case not assigned to them (IDOR)',
      });
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const notes = await db
      .select()
      .from(caseNotesTable)
      .where(eq(caseNotesTable.caseId, id))
      .orderBy(sql`created_at ASC`);

    res.json({
      success: true,
      data: {
        ...caseRow,
        slaStatus: getSlaStatus({ slaDeadline: caseRow.slaDeadline, status: caseRow.status, slaBreached: caseRow.slaBreached }),
        notes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch case' });
  }
});

// PATCH /v1/cases/:id
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const body = req.body as { status?: string; optimizationNote?: string; segment?: string; priority?: string };

    const [caseRow] = await db
      .select()
      .from(optimizationCasesTable)
      .where(eq(optimizationCasesTable.id, id));

    if (!caseRow) {
      res.status(404).json({ success: false, error: 'Case not found' });
      return;
    }

    // Segment: değiştirilebilir by assigned expert veya supervisor/admin (case 4.3)
    if (body.segment && body.segment !== caseRow.segment) {
      if (!SEGMENT_TYPES.includes(body.segment)) {
        res.status(400).json({ success: false, error: `Invalid segment. Must be one of: ${SEGMENT_TYPES.join(', ')}` });
        return;
      }
      const isAssignedExpert = req.user?.role === 'CAMPAIGN_EXPERT' && caseRow.assignedExpertId === req.user.id;
      const isManager = req.user?.role === 'SUPERVISOR' || req.user?.role === 'ADMIN';
      if (!isAssignedExpert && !isManager) {
        res.status(403).json({ success: false, error: 'Only the assigned expert or a manager can change the segment' });
        return;
      }
    }

    // Öncelik: sadece yönetici manuel değiştirebilir (case 4.3)
    if (body.priority && body.priority !== caseRow.priority) {
      if (!PRIORITY_LEVELS.includes(body.priority)) {
        res.status(400).json({ success: false, error: `Invalid priority. Must be one of: ${PRIORITY_LEVELS.join(', ')}` });
        return;
      }
      if (req.user?.role !== 'SUPERVISOR' && req.user?.role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Only a manager can change priority' });
        return;
      }
    }

    if (body.status && body.status !== caseRow.status) {
      const from = caseRow.status ?? 'YENI';
      const allowed = canTransition(
        from,
        body.status,
        req.user?.role ?? '',
        req.user?.id ?? '',
        { assignedExpertId: caseRow.assignedExpertId },
      );

      if (!allowed) {
        res.status(422).json({ success: false, error: `Invalid state transition: ${from} → ${body.status}` });
        return;
      }

      if (body.status === 'TAMAMLANDI' && !body.optimizationNote && !caseRow.optimizationNote) {
        res.status(400).json({ success: false, error: 'optimizationNote is required to complete a case' });
        return;
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status) updateData['status'] = body.status;
    if (body.optimizationNote) updateData['optimizationNote'] = body.optimizationNote;
    if (body.segment && body.segment !== caseRow.segment) {
      updateData['segment'] = body.segment;
      // RISKLI_KAYIP segmenti minimum YUKSEK öncelik alır (case 4.3), yönetici daha yükseğini isteyebilir
      const requestedPriority = body.priority ?? caseRow.priority ?? 'ORTA';
      if (body.segment === 'RISKLI_KAYIP' && PRIORITY_RANK[requestedPriority] < PRIORITY_RANK['YUKSEK']) {
        updateData['priority'] = 'YUKSEK';
      }
    }
    if (body.priority && !updateData['priority']) updateData['priority'] = body.priority;

    const [updated] = await db
      .update(optimizationCasesTable)
      .set(updateData)
      .where(eq(optimizationCasesTable.id, id))
      .returning();

    if (body.segment && body.segment !== caseRow.segment) {
      publishEvent('segment.override', {
        caseId: id,
        oldSegment: caseRow.segment,
        newSegment: body.segment,
        overriddenBy: req.user?.id,
        overriddenByName: req.user?.name,
      });
    }

    if (body.status && body.status !== caseRow.status && CRITICAL_STATUSES.includes(body.status)) {
      publishEvent('audit.log', {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'CASE_STATUS_CHANGED',
        resource: 'optimization_cases',
        resourceId: id,
        result: 'SUCCESS',
        ipAddress: getIp(req),
        details: `${caseRow.status} -> ${body.status} (case ${caseRow.caseCode})`,
      });
    }

    if (updated?.slaDeadline && new Date() > new Date(updated.slaDeadline) && !updated.slaBreached) {
      await db
        .update(optimizationCasesTable)
        .set({ slaBreached: true })
        .where(eq(optimizationCasesTable.id, id));

      await publishEvent('campaign.sla_breached', {
        caseId: id,
        caseCode: updated.caseCode,
        segment: updated.segment,
        priority: updated.priority,
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update case' });
  }
});

// POST /v1/cases/:id/assign
router.post(
  '/:id/assign',
  requireAuth,
  requireRole('SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params['id']);
      const body = req.body as { expertId?: string; expertName?: string; auto?: boolean };

      const [caseRow] = await db
        .select()
        .from(optimizationCasesTable)
        .where(eq(optimizationCasesTable.id, id));

      if (!caseRow) {
        res.status(404).json({ success: false, error: 'Case not found' });
        return;
      }

      let resolvedExpertId = body.expertId;
      let resolvedExpertName = body.expertName;

      if (body.auto) {
        const assignment = await getExpertAssignment(
          id,
          caseRow.segment ?? 'BELIRSIZ',
          caseRow.priority ?? 'ORTA',
        );
        if (assignment) {
          resolvedExpertId = assignment.expertId;
          resolvedExpertName = assignment.expertName;
        } else {
          res.status(503).json({ success: false, error: 'Auto assignment failed: AI service unavailable' });
          return;
        }
      }

      if (!resolvedExpertId || !resolvedExpertName) {
        res.status(400).json({ success: false, error: 'expertId and expertName are required (or use auto: true)' });
        return;
      }

      const [updated] = await db
        .update(optimizationCasesTable)
        .set({
          assignedExpertId: resolvedExpertId,
          assignedExpertName: resolvedExpertName,
          status: 'ATANDI',
          updatedAt: new Date(),
        })
        .where(eq(optimizationCasesTable.id, id))
        .returning();

      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to assign case' });
    }
  },
);

// POST /v1/cases/:id/complete
router.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const body = req.body as { optimizationNote?: string };

    if (!body.optimizationNote || body.optimizationNote.trim().length === 0) {
      res.status(400).json({ success: false, error: 'optimizationNote is required' });
      return;
    }

    const [caseRow] = await db
      .select()
      .from(optimizationCasesTable)
      .where(eq(optimizationCasesTable.id, id));

    if (!caseRow) {
      res.status(404).json({ success: false, error: 'Case not found' });
      return;
    }

    if (caseRow.assignedExpertId !== req.user?.id) {
      publishEvent('audit.log', {
        userId: req.user?.id,
        userName: req.user?.name,
        action: 'UNAUTHORIZED_ACCESS',
        resource: req.originalUrl,
        resourceId: id,
        result: 'FAILURE',
        ipAddress: getIp(req),
        details: 'Non-assigned user attempted to complete a case',
      });
      res.status(403).json({ success: false, error: 'Only the assigned expert can complete this case' });
      return;
    }

    if (caseRow.status !== 'OPTIMIZE_EDILIYOR') {
      res.status(422).json({ success: false, error: `Invalid state transition: ${caseRow.status} → TAMAMLANDI` });
      return;
    }

    const [updated] = await db
      .update(optimizationCasesTable)
      .set({
        status: 'TAMAMLANDI',
        optimizationNote: body.optimizationNote,
        updatedAt: new Date(),
      })
      .where(eq(optimizationCasesTable.id, id))
      .returning();

    publishEvent('audit.log', {
      userId: req.user?.id,
      userName: req.user?.name,
      action: 'CASE_STATUS_CHANGED',
      resource: 'optimization_cases',
      resourceId: id,
      result: 'SUCCESS',
      ipAddress: getIp(req),
      details: `${caseRow.status} -> TAMAMLANDI (case ${caseRow.caseCode})`,
    });

    const createdAt = new Date(caseRow.createdAt ?? Date.now()).getTime();
    const durationMinutes = Math.round((Date.now() - createdAt) / 60000);

    // Deterministic conversion lift based on case id
    const idHash = parseInt(id.replace(/-/g, '').slice(0, 8), 16);
    const conversionLift = 0.05 + (idHash % 1000) / 4000;

    await publishEvent('campaign.optimized', {
      caseId: id,
      expertId: req.user?.id,
      expertName: req.user?.name,
      segment: caseRow.segment,
      priority: caseRow.priority,
      conversionLift,
      durationMinutes,
      caseCode: caseRow.caseCode,
    });

    res.json({ success: true, data: updated, meta: { durationMinutes, conversionLift } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to complete case' });
  }
});

// POST /v1/cases/:id/notes
router.post('/:id/notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const body = req.body as { content?: string };

    if (!body.content || body.content.trim().length === 0) {
      res.status(400).json({ success: false, error: 'content is required' });
      return;
    }

    const [caseRow] = await db
      .select()
      .from(optimizationCasesTable)
      .where(eq(optimizationCasesTable.id, id));

    if (!caseRow) {
      res.status(404).json({ success: false, error: 'Case not found' });
      return;
    }

    const [note] = await db
      .insert(caseNotesTable)
      .values({
        caseId: id,
        authorId: req.user?.id,
        authorName: req.user?.name,
        content: body.content.trim(),
      })
      .returning();

    res.status(201).json({ success: true, data: note });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to add note' });
  }
});

export default router;
