import { Router, Request, Response } from 'express';
import { eq, sql, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import {
  campaignsTable,
  subscribersTable,
  subscriberOffersTable,
  optimizationCasesTable,
} from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { scoreCampaignForSubscriber } from '../lib/aiClient.js';

const router = Router();

const ALLOWED_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['EK_PAKET', 'TARIFE_YUKSELTME', 'CIHAZ_FIRSATI', 'SADAKAT']),
  segment: z.string().min(1, 'Segment is required'),
  priority: z.enum(['KRITIK', 'YUKSEK', 'ORTA', 'DUSUK']).optional().default('ORTA'),
  discount: z.number().min(0).max(100).optional().default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  segment: z.string().optional(),
  priority: z.string().optional(),
  discount: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET /v1/campaigns
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'))));
    const offset = (page - 1) * limit;
    const status = req.query['status'] as string | undefined;
    const segment = req.query['segment'] as string | undefined;

    const conditions = [];
    if (status && ALLOWED_STATUSES.includes(status)) {
      conditions.push(eq(campaignsTable.status, status));
    }
    if (segment) {
      conditions.push(eq(campaignsTable.segment, segment));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, data] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` }).from(campaignsTable).where(whereClause),
      db.select().from(campaignsTable).where(whereClause).orderBy(sql`created_at DESC`).limit(limit).offset(offset),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({ data, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /v1/campaigns/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));

    if (!campaign) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }
    res.json({ data: campaign });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// POST /v1/campaigns
router.post(
  '/',
  requireAuth,
  requireRole('CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const parsed = createCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        return;
      }
      const body = parsed.data;

      // Generate campaign code
      const [countResult] = await db.select({ count: sql<number>`COUNT(*)` }).from(campaignsTable);
      const count = Number(countResult?.count ?? 0);
      const campaignCode = 'CMP-2026-' + String(count + 1).padStart(6, '0');

      const [campaign] = await db
        .insert(campaignsTable)
        .values({
          name: body.name,
          description: body.description,
          type: body.type,
          segment: body.segment,
          priority: body.priority,
          discount: body.discount,
          startDate: body.startDate ? new Date(body.startDate) : undefined,
          endDate: body.endDate ? new Date(body.endDate) : undefined,
          campaignCode,
          createdBy: req.user?.id,
          status: 'DRAFT',
          isAiAnalyzed: false,
        })
        .returning();

      if (!campaign) {
        res.status(500).json({ error: 'Failed to create campaign' });
        return;
      }

      // Get matching subscribers (up to 200)
      const subscribers = await db
        .select()
        .from(subscribersTable)
        .where(body.segment !== 'BELIRSIZ' ? eq(subscribersTable.segment, body.segment) : sql`1=1`)
        .limit(200);

      let aiAvailable = true;
      let offersCreated = 0;

      if (subscribers.length > 0) {
        const campaignProfile = {
          id: campaign.id,
          name: body.name,
          type: body.type,
          segment: body.segment,
          discount: body.discount,
          priority: body.priority,
        };

        for (const subscriber of subscribers) {
          const subscriberProfile = {
            id: subscriber.id,
            segment: subscriber.segment,
            monthlySpend: subscriber.monthlySpend,
            dataUsageGb: subscriber.dataUsageGb,
            voiceMinutes: subscriber.voiceMinutes,
            churnRisk: subscriber.churnRisk,
            valueScore: subscriber.valueScore,
            tariff: subscriber.tariff,
          };

          const score = await scoreCampaignForSubscriber(subscriberProfile, campaignProfile);

          if (score.reasoning === 'AI service unavailable - manual review needed') {
            aiAvailable = false;
          }

          if (score.recommendationScore > 0.60) {
            await db.insert(subscriberOffersTable).values({
              subscriberId: subscriber.id,
              campaignId: campaign.id,
              status: 'PENDING',
              recommendationScore: String(score.recommendationScore),
              conversionProbability: String(score.conversionProbability),
              aiReasoning: score.reasoning,
            });
            offersCreated++;
          }
        }
      }

      if (!aiAvailable) {
        const [caseCountResult] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(optimizationCasesTable);
        const caseCount = Number(caseCountResult?.count ?? 0);
        const caseCode = 'CASE-' + String(caseCount + 1).padStart(6, '0');

        await db.insert(optimizationCasesTable).values({
          caseCode,
          campaignId: campaign.id,
          status: 'YENI',
          segment: 'BELIRSIZ',
          priority: 'ORTA',
          aiReasoning: 'AI service unavailable - manual review needed',
          slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        await db
          .update(campaignsTable)
          .set({ isAiAnalyzed: false, updatedAt: new Date() })
          .where(eq(campaignsTable.id, campaign.id));
      } else if (subscribers.length > 0) {
        await db
          .update(campaignsTable)
          .set({ isAiAnalyzed: true, updatedAt: new Date() })
          .where(eq(campaignsTable.id, campaign.id));
      }

      const [updatedCampaign] = await db
        .select()
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaign.id));

      res.status(201).json({
        success: true,
        data: updatedCampaign,
        meta: { offersCreated, aiAvailable },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  },
);

// PATCH /v1/campaigns/:id
router.patch(
  '/:id',
  requireAuth,
  requireRole('CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params['id']);
      const parsed = updateCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
        return;
      }
      const body = parsed.data;

      const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
      if (!existing) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updateData['name'] = body.name;
      if (body.description !== undefined) updateData['description'] = body.description;
      if (body.segment !== undefined) updateData['segment'] = body.segment;
      if (body.priority !== undefined) updateData['priority'] = body.priority;
      if (body.discount !== undefined) updateData['discount'] = body.discount;
      if (body.startDate !== undefined) updateData['startDate'] = new Date(body.startDate);
      if (body.endDate !== undefined) updateData['endDate'] = new Date(body.endDate);

      const [updated] = await db
        .update(campaignsTable)
        .set(updateData)
        .where(eq(campaignsTable.id, id))
        .returning();

      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  },
);

// POST /v1/campaigns/:id/publish
router.post(
  '/:id/publish',
  requireAuth,
  requireRole('SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params['id']);
      const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
      if (!existing) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      const [updated] = await db
        .update(campaignsTable)
        .set({ status: 'PUBLISHED', updatedAt: new Date() })
        .where(eq(campaignsTable.id, id))
        .returning();

      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ error: 'Failed to publish campaign' });
    }
  },
);

// POST /v1/campaigns/:id/archive
router.post(
  '/:id/archive',
  requireAuth,
  requireRole('SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params['id']);
      const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
      if (!existing) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      const [updated] = await db
        .update(campaignsTable)
        .set({ status: 'ARCHIVED', updatedAt: new Date() })
        .where(eq(campaignsTable.id, id))
        .returning();

      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ error: 'Failed to archive campaign' });
    }
  },
);

// DELETE /v1/campaigns/:id
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params['id']);
      const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
      if (!existing) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
      }

      await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
      res.json({ success: true, message: 'Campaign deleted' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  },
);

export default router;
