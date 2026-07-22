import { Router, Request, Response } from 'express';
import { eq, sql, and, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  subscribersTable,
  subscriberOffersTable,
  campaignsTable,
} from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { publishEvent } from '../lib/redis.js';

const router = Router();

// GET /v1/subscribers
router.get(
  '/',
  requireAuth,
  requireRole('CAMPAIGN_EXPERT', 'SUPERVISOR', 'ADMIN'),
  async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')));
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'))));
      const offset = (page - 1) * limit;
      const segment = req.query['segment'] as string | undefined;

      const conditions = segment ? [eq(subscribersTable.segment, segment)] : [];
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, data] = await Promise.all([
        db.select({ count: sql<number>`COUNT(*)` }).from(subscribersTable).where(whereClause),
        db.select().from(subscribersTable).where(whereClause).orderBy(sql`created_at DESC`).limit(limit).offset(offset),
      ]);

      const total = Number(countResult[0]?.count ?? 0);
      res.json({ success: true, data, total, page, limit });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to fetch subscribers' });
    }
  },
);

async function findSubscriber(id: string) {
  // Try UUID match, then userId match, then GSM number match. The GSM fallback
  // exists because identity-service (the source of truth for a logged-in
  // subscriber's identity) and campaign-service (which owns usage/segment
  // data) are separate databases with no foreign key between them —
  // `subscribers.user_id` is only populated when a subscriber profile is
  // explicitly linked. Matching on gsm_number, which both services share, lets
  // an already-provisioned campaign-service subscriber profile resolve
  // correctly even when that link hasn't been made yet.
  const [byId] = await db
    .select()
    .from(subscribersTable)
    .where(sql`id::text = ${id} OR user_id = ${id} OR gsm_number = ${id}`)
    .limit(1);
  return byId;
}

const GSM_PATTERN = /^0\d{10}$/;

// Used only by the subscriber-self-service read routes below. A subscriber
// who just self-registered via identity-service's GSM+OTP flow exists there
// but has no campaign-service profile yet (no seeded usage/segment data) —
// rather than 404 on their very first visit to "My Offers", lazily
// provision a neutral-default profile so the page loads (with zero offers,
// since no campaign has scored them yet) instead of erroring.
async function findOrCreateSubscriber(id: string) {
  const existing = await findSubscriber(id);
  if (existing) return existing;
  if (!GSM_PATTERN.test(id)) return null;

  const [created] = await db
    .insert(subscribersTable)
    .values({ name: `Abone ${id.slice(-4)}`, gsmNumber: id })
    .onConflictDoNothing()
    .returning();
  return created ?? (await findSubscriber(id));
}

// GET /v1/subscribers/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const subscriber = await findOrCreateSubscriber(id);

    if (!subscriber) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }

    const offers = await db
      .select({
        offer: subscriberOffersTable,
        campaign: campaignsTable,
      })
      .from(subscriberOffersTable)
      .leftJoin(campaignsTable, sql`${subscriberOffersTable.campaignId} = ${campaignsTable.id}::text`)
      .where(eq(subscriberOffersTable.subscriberId, subscriber.id));

    res.json({
      success: true,
      data: {
        subscriber,
        campaigns: offers.map((o) => ({ ...o.offer, campaign: o.campaign })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch subscriber' });
  }
});

// GET /v1/subscribers/:id/campaigns
router.get('/:id/campaigns', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const subscriber = await findOrCreateSubscriber(id);

    if (!subscriber) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }

    const offers = await db
      .select({
        offer: subscriberOffersTable,
        campaign: campaignsTable,
      })
      .from(subscriberOffersTable)
      .leftJoin(campaignsTable, sql`${subscriberOffersTable.campaignId} = ${campaignsTable.id}::text`)
      .where(eq(subscriberOffersTable.subscriberId, subscriber.id));

    res.json({ success: true, data: offers.map((o) => ({ ...o.offer, campaign: o.campaign })) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscriber campaigns' });
  }
});

// POST /v1/subscribers/:id/offers/:campaignId/accept
router.post('/:id/offers/:campaignId/accept', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const campaignId = String(req.params['campaignId']);

    const subscriber = await findSubscriber(id);
    if (!subscriber) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }

    const [offer] = await db
      .select()
      .from(subscriberOffersTable)
      .where(
        and(
          eq(subscriberOffersTable.subscriberId, subscriber.id),
          sql`${subscriberOffersTable.campaignId} = ${campaignId}`,
          eq(subscriberOffersTable.status, 'PENDING'),
        ),
      );

    if (!offer) {
      res.status(404).json({ success: false, error: 'Pending offer not found' });
      return;
    }

    const [updated] = await db
      .update(subscriberOffersTable)
      .set({ status: 'ACCEPTED' })
      .where(eq(subscriberOffersTable.id, offer.id))
      .returning();

    await db
      .update(subscribersTable)
      .set({ acceptedCampaigns: sql`${subscribersTable.acceptedCampaigns} + 1` })
      .where(eq(subscribersTable.id, subscriber.id));

    await publishEvent('offer.accepted', {
      subscriberId: subscriber.id,
      campaignId,
      offerId: offer.id,
      expertId: req.user?.id,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to accept offer' });
  }
});

// POST /v1/subscribers/:id/offers/:campaignId/reject
router.post('/:id/offers/:campaignId/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const campaignId = String(req.params['campaignId']);
    const body = req.body as { reason?: string };

    if (!body.reason || body.reason.trim().length === 0) {
      res.status(400).json({ success: false, error: 'reason is required' });
      return;
    }

    const subscriber = await findSubscriber(id);
    if (!subscriber) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }

    const [offer] = await db
      .select()
      .from(subscriberOffersTable)
      .where(
        and(
          eq(subscriberOffersTable.subscriberId, subscriber.id),
          sql`${subscriberOffersTable.campaignId} = ${campaignId}`,
          eq(subscriberOffersTable.status, 'PENDING'),
        ),
      );

    if (!offer) {
      res.status(404).json({ success: false, error: 'Pending offer not found' });
      return;
    }

    const [updated] = await db
      .update(subscriberOffersTable)
      .set({ status: 'REJECTED', rejectionReason: body.reason.trim() })
      .where(eq(subscriberOffersTable.id, offer.id))
      .returning();

    await db
      .update(subscribersTable)
      .set({ rejectedCampaigns: sql`${subscribersTable.rejectedCampaigns} + 1` })
      .where(eq(subscribersTable.id, subscriber.id));

    await publishEvent('offer.rejected', {
      subscriberId: subscriber.id,
      campaignId,
      offerId: offer.id,
      reason: body.reason.trim(),
      expertId: req.user?.id,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reject offer' });
  }
});

// POST /v1/subscribers/:id/offers/:campaignId/rate
router.post('/:id/offers/:campaignId/rate', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const campaignId = String(req.params['campaignId']);
    const body = req.body as { rating?: number };

    if (body.rating === undefined || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      res.status(400).json({ success: false, error: 'rating must be an integer between 1 and 5' });
      return;
    }

    const subscriber = await findSubscriber(id);
    if (!subscriber) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }

    const [offer] = await db
      .select()
      .from(subscriberOffersTable)
      .where(
        and(
          eq(subscriberOffersTable.subscriberId, subscriber.id),
          sql`${subscriberOffersTable.campaignId} = ${campaignId}`,
          eq(subscriberOffersTable.status, 'ACCEPTED'),
        ),
      );

    if (!offer) {
      res.status(404).json({ success: false, error: 'Accepted offer not found - can only rate accepted offers' });
      return;
    }

    const [updated] = await db
      .update(subscriberOffersTable)
      .set({ status: 'RATED', rating: body.rating })
      .where(eq(subscriberOffersTable.id, offer.id))
      .returning();

    await publishEvent('offer.rated', {
      subscriberId: subscriber.id,
      campaignId,
      offerId: offer.id,
      rating: body.rating,
      expertId: req.user?.id,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to rate offer' });
  }
});

export default router;
