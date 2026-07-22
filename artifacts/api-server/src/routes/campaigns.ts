import { Router } from "express";
import { eq, and, desc, sql, ilike, count } from "drizzle-orm";
import { db, campaignsTable, optimizationCasesTable, caseNotesTable, subscriberOffersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

function buildAiAnalysis(campaign: { type: string; segment?: string | null; discount: string }) {
  const segments = ["YUKSEK_DEGER", "RISKLI_KAYIP", "YENI_ABONE", "PASIF"];
  const seg = segments[Math.floor(Math.random() * segments.length)];
  const score = (0.55 + Math.random() * 0.45).toFixed(3);
  const prob = (0.45 + Math.random() * 0.50).toFixed(3);
  const priority = parseFloat(score) > 0.80 ? "HIGH" : parseFloat(score) > 0.65 ? "MEDIUM" : "LOW";
  const reasoning = `Bu kampanya için ${seg} segmentindeki abonelerin son 60 günlük kullanım profili ve geçmiş kampanya davranışları analiz edildi. ${parseFloat(score) > 0.75 ? "Yüksek" : "Orta"} uyumluluk skoru tespit edildi.`;
  return { segment: seg, recommendationScore: score, conversionProbability: prob, priority, reasoning };
}

// List campaigns
router.get("/v1/campaigns", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(campaignsTable.status, String(req.query.status)));
  if (req.query.segment) conditions.push(eq(campaignsTable.segment, String(req.query.segment)));
  if (req.query.type) conditions.push(eq(campaignsTable.type, String(req.query.type)));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [data, totalRows] = await Promise.all([
    db.select().from(campaignsTable).where(whereClause).orderBy(desc(campaignsTable.createdAt)).limit(limit).offset(offset),
    db.select({ cnt: count() }).from(campaignsTable).where(whereClause),
  ]);

  res.json({ data: data.map(formatCampaign), total: Number(totalRows[0]?.cnt ?? 0), page, limit });
});

// Create campaign
router.post("/v1/campaigns", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, description, type, segment, discount, startDate, endDate } = req.body;
  if (!name || !type || discount === undefined || !startDate || !endDate) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  const [campaign] = await db.insert(campaignsTable).values({
    name, description, type,
    segment: segment || "BELIRSIZ",
    discount: String(discount),
    startDate, endDate,
    createdBy: req.user!.id,
  }).returning();

  res.status(201).json(formatCampaign(campaign));
});

// Get campaign
router.get("/v1/campaigns/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(formatCampaign(campaign));
});

// Update campaign
router.patch("/v1/campaigns/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, description, segment, priority, discount } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (segment !== undefined) update.segment = segment;
  if (priority !== undefined) update.priority = priority;
  if (discount !== undefined) update.discount = String(discount);

  const [campaign] = await db.update(campaignsTable).set(update).where(eq(campaignsTable.id, id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(formatCampaign(campaign));
});

// Delete campaign
router.delete("/v1/campaigns/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.json({ success: true, message: "Campaign deleted" });
});

// AI Analyze
router.post("/v1/campaigns/:id/analyze", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  try {
    // Simulated AI analysis (real ML would call external service)
    await new Promise(r => setTimeout(r, 800)); // Simulate processing
    const ai = buildAiAnalysis(campaign);
    const [updated] = await db.update(campaignsTable).set({
      segment: ai.segment,
      recommendationScore: ai.recommendationScore,
      conversionProbability: ai.conversionProbability,
      priority: ai.priority,
      aiReasoning: ai.reasoning,
      isAiAnalyzed: true,
      status: "ACTIVE",
    }).where(eq(campaignsTable.id, id)).returning();

    res.json({ success: true, aiAvailable: true, message: null, campaign: formatCampaign(updated) });
  } catch {
    // AI fallback
    const [updated] = await db.update(campaignsTable).set({
      segment: "BELIRSIZ",
      priority: "MEDIUM",
      status: "MANUAL_OPTIMIZATION_REQUIRED",
    }).where(eq(campaignsTable.id, id)).returning();

    res.json({
      success: true,
      aiAvailable: false,
      message: "AI Optimization Service is currently unavailable. Campaign created successfully and queued for manual optimization.",
      campaign: formatCampaign(updated),
    });
  }
});

// Publish
router.post("/v1/campaigns/:id/publish", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [campaign] = await db.update(campaignsTable).set({ status: "PUBLISHED" }).where(eq(campaignsTable.id, id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(formatCampaign(campaign));
});

// Archive
router.post("/v1/campaigns/:id/archive", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [campaign] = await db.update(campaignsTable).set({ status: "ARCHIVED" }).where(eq(campaignsTable.id, id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(formatCampaign(campaign));
});

function formatCampaign(c: typeof campaignsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    type: c.type,
    status: c.status,
    segment: c.segment,
    priority: c.priority,
    discount: parseFloat(c.discount),
    startDate: c.startDate,
    endDate: c.endDate,
    recommendationScore: c.recommendationScore ? parseFloat(c.recommendationScore) : null,
    conversionProbability: c.conversionProbability ? parseFloat(c.conversionProbability) : null,
    aiReasoning: c.aiReasoning ?? null,
    isAiAnalyzed: c.isAiAnalyzed,
    conversionRate: c.conversionRate ? parseFloat(c.conversionRate) : null,
    createdAt: c.createdAt?.toISOString(),
    updatedAt: c.updatedAt?.toISOString(),
  };
}

export default router;
