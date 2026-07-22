import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { experimentsTable, optimizationCasesTable } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

const router = Router();

const createExperimentSchema = z.object({
  campaignId: z.string().min(1, 'campaignId is required'),
  caseId: z.string().optional(),
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  variantAName: z.string().optional().default('Control'),
  variantADiscount: z.number().min(0).max(100).optional().default(0),
  variantBName: z.string().optional().default('Variant B'),
  variantBDiscount: z.number().min(0).max(100).optional().default(0),
});

const concludeExperimentSchema = z.object({
  conclusion: z.string().optional(),
});

// GET /v1/experiments
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'))));
    const offset = (page - 1) * limit;

    const [countResult, data] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(experimentsTable),
      db.select().from(experimentsTable).orderBy(sql`created_at DESC`).limit(limit).offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ success: true, data, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch experiments' });
  }
});

// GET /v1/experiments/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const [experiment] = await db
      .select()
      .from(experimentsTable)
      .where(eq(experimentsTable.id, id));

    if (!experiment) {
      res.status(404).json({ success: false, error: 'Experiment not found' });
      return;
    }

    res.json({ success: true, data: experiment });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch experiment' });
  }
});

// POST /v1/experiments
router.post(
  '/',
  requireAuth,
  requireRole('CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createExperimentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
        return;
      }
      const body = parsed.data;

      const [experiment] = await db
        .insert(experimentsTable)
        .values({
          campaignId: body.campaignId,
          caseId: body.caseId,
          name: body.name,
          description: body.description,
          status: 'RUNNING',
          variantAName: body.variantAName,
          variantADiscount: body.variantADiscount,
          variantBName: body.variantBName,
          variantBDiscount: body.variantBDiscount,
        })
        .returning();

      // If caseId provided, update case status to TEST_EDILIYOR
      if (body.caseId) {
        const [caseRow] = await db
          .select()
          .from(optimizationCasesTable)
          .where(eq(optimizationCasesTable.id, body.caseId));

        if (caseRow) {
          const validFromStatuses = ['ATANDI', 'OPTIMIZE_EDILIYOR'];
          if (validFromStatuses.includes(caseRow.status ?? '')) {
            await db
              .update(optimizationCasesTable)
              .set({ status: 'TEST_EDILIYOR', updatedAt: new Date() })
              .where(eq(optimizationCasesTable.id, body.caseId));
          }
        }
      }

      res.status(201).json({ success: true, data: experiment });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to create experiment' });
    }
  },
);

// POST /v1/experiments/:id/conclude
router.post(
  '/:id/conclude',
  requireAuth,
  requireRole('CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params['id']);
      const parsed = concludeExperimentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: 'Validation failed', details: parsed.error.flatten() });
        return;
      }

      const [experiment] = await db
        .select()
        .from(experimentsTable)
        .where(eq(experimentsTable.id, id));

      if (!experiment) {
        res.status(404).json({ success: false, error: 'Experiment not found' });
        return;
      }

      if (experiment.status === 'CONCLUDED') {
        res.status(400).json({ success: false, error: 'Experiment is already concluded' });
        return;
      }

      const aImpressions = experiment.variantAImpressions ?? 0;
      const aConversions = experiment.variantAConversions ?? 0;
      const bImpressions = experiment.variantBImpressions ?? 0;
      const bConversions = experiment.variantBConversions ?? 0;

      const aRate = aImpressions > 0 ? aConversions / aImpressions : 0;
      const bRate = bImpressions > 0 ? bConversions / bImpressions : 0;

      const winner = aRate >= bRate ? 'A' : 'B';

      const [updated] = await db
        .update(experimentsTable)
        .set({
          winner,
          status: 'CONCLUDED',
          conclusion: parsed.data.conclusion ?? null,
          concludedAt: new Date(),
        })
        .where(eq(experimentsTable.id, id))
        .returning();

      // If associated case exists and is TEST_EDILIYOR, revert to OPTIMIZE_EDILIYOR
      if (experiment.caseId) {
        const [caseRow] = await db
          .select()
          .from(optimizationCasesTable)
          .where(eq(optimizationCasesTable.id, experiment.caseId));

        if (caseRow && caseRow.status === 'TEST_EDILIYOR') {
          await db
            .update(optimizationCasesTable)
            .set({ status: 'OPTIMIZE_EDILIYOR', updatedAt: new Date() })
            .where(eq(optimizationCasesTable.id, experiment.caseId));
        }
      }

      res.json({
        success: true,
        data: updated,
        meta: { variantARate: aRate, variantBRate: bRate, winner },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to conclude experiment' });
    }
  },
);

export default router;
