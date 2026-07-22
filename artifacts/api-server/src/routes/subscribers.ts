import { Router } from "express";
import { eq, and, desc, count, ilike } from "drizzle-orm";
import { db, subscribersTable, subscriberOffersTable, campaignsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

// List subscribers
router.get("/v1/subscribers", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.segment) conditions.push(eq(subscribersTable.segment, String(req.query.segment)));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [data, totalRows] = await Promise.all([
    db.select().from(subscribersTable).where(whereClause).orderBy(desc(subscribersTable.createdAt)).limit(limit).offset(offset),
    db.select({ cnt: count() }).from(subscribersTable).where(whereClause),
  ]);

  res.json({ data: data.map(formatSubscriber), total: Number(totalRows[0]?.cnt ?? 0), page, limit });
});

// Get subscriber
router.get("/v1/subscribers/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [sub] = await db.select().from(subscribersTable).where(eq(subscribersTable.id, id)).limit(1);
  if (!sub) { res.status(404).json({ error: "Subscriber not found" }); return; }

  const offers = await db.select({
    offer: subscriberOffersTable,
    campaign: {
      id: campaignsTable.id,
      name: campaignsTable.name,
      type: campaignsTable.type,
      discount: campaignsTable.discount,
      endDate: campaignsTable.endDate,
    }
  }).from(subscriberOffersTable)
    .leftJoin(campaignsTable, eq(subscriberOffersTable.campaignId, campaignsTable.id))
    .where(eq(subscriberOffersTable.subscriberId, id))
    .orderBy(desc(subscriberOffersTable.recommendationScore));

  res.json({
    subscriber: formatSubscriber(sub),
    campaigns: offers.map(o => ({
      id: o.offer.id,
      campaignId: o.offer.campaignId,
      name: o.campaign?.name ?? "Unknown",
      type: o.campaign?.type ?? "EK_PAKET",
      discount: parseFloat(o.campaign?.discount ?? "0"),
      validUntil: o.campaign?.endDate ?? null,
      recommendationScore: parseFloat(o.offer.recommendationScore),
      conversionProbability: parseFloat(o.offer.conversionProbability),
      aiReasoning: o.offer.aiReasoning,
      status: o.offer.status,
      rating: o.offer.rating ?? null,
      rejectionReason: o.offer.rejectionReason ?? null,
    })),
  });
});

// Get subscriber campaigns
router.get("/v1/subscribers/:id/campaigns", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const offers = await db.select({
    offer: subscriberOffersTable,
    campaign: {
      id: campaignsTable.id,
      name: campaignsTable.name,
      type: campaignsTable.type,
      discount: campaignsTable.discount,
      endDate: campaignsTable.endDate,
    }
  }).from(subscriberOffersTable)
    .leftJoin(campaignsTable, eq(subscriberOffersTable.campaignId, campaignsTable.id))
    .where(eq(subscriberOffersTable.subscriberId, id))
    .orderBy(desc(subscriberOffersTable.recommendationScore));

  res.json({
    data: offers.map(o => ({
      id: o.offer.id,
      campaignId: o.offer.campaignId,
      name: o.campaign?.name ?? "Unknown",
      type: o.campaign?.type ?? "EK_PAKET",
      discount: parseFloat(o.campaign?.discount ?? "0"),
      validUntil: o.campaign?.endDate ?? null,
      recommendationScore: parseFloat(o.offer.recommendationScore),
      conversionProbability: parseFloat(o.offer.conversionProbability),
      aiReasoning: o.offer.aiReasoning,
      status: o.offer.status,
      rating: o.offer.rating ?? null,
      rejectionReason: o.offer.rejectionReason ?? null,
    })),
  });
});

// Accept offer
router.post("/v1/subscribers/:id/offers/:campaignId/accept", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { id, campaignId } = req.params;
  await db.update(subscriberOffersTable)
    .set({ status: "ACCEPTED" })
    .where(and(eq(subscriberOffersTable.subscriberId, id), eq(subscriberOffersTable.campaignId, campaignId)));
  await db.update(subscribersTable).set({ acceptedCampaigns: 1 }).where(eq(subscribersTable.id, id));
  res.json({ success: true, message: "Offer accepted" });
});

// Reject offer
router.post("/v1/subscribers/:id/offers/:campaignId/reject", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { id, campaignId } = req.params;
  const { reason } = req.body;
  await db.update(subscriberOffersTable)
    .set({ status: "REJECTED", rejectionReason: reason ?? null })
    .where(and(eq(subscriberOffersTable.subscriberId, id), eq(subscriberOffersTable.campaignId, campaignId)));
  res.json({ success: true, message: "Offer rejected" });
});

// Rate offer
router.post("/v1/subscribers/:id/offers/:campaignId/rate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { id, campaignId } = req.params;
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: "Rating must be between 1 and 5" }); return; }
  await db.update(subscriberOffersTable)
    .set({ status: "RATED", rating })
    .where(and(eq(subscriberOffersTable.subscriberId, id), eq(subscriberOffersTable.campaignId, campaignId)));
  res.json({ success: true, message: "Rating submitted" });
});

function formatSubscriber(s: typeof subscribersTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    gsmNumber: s.gsmNumber,
    segment: s.segment,
    tariff: s.tariff,
    monthlySpend: parseFloat(s.monthlySpend),
    dataUsageGb: parseFloat(s.dataUsageGb),
    voiceMinutes: s.voiceMinutes,
    churnRisk: parseFloat(s.churnRisk),
    valueScore: parseFloat(s.valueScore),
    acceptedCampaigns: s.acceptedCampaigns,
    rejectedCampaigns: s.rejectedCampaigns,
    createdAt: s.createdAt?.toISOString(),
  };
}

export default router;
