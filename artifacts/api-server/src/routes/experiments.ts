import { Router } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, experimentsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

router.get("/v1/experiments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.campaignId) conditions.push(eq(experimentsTable.campaignId, String(req.query.campaignId)));
  if (req.query.status) conditions.push(eq(experimentsTable.status, String(req.query.status)));
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [data, totalRows] = await Promise.all([
    db.select().from(experimentsTable).where(whereClause).orderBy(desc(experimentsTable.createdAt)).limit(50),
    db.select({ cnt: count() }).from(experimentsTable).where(whereClause),
  ]);
  res.json({ data: data.map(formatExperiment), total: Number(totalRows[0]?.cnt ?? 0) });
});

router.post("/v1/experiments", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { campaignId, caseId, name, description, variantADiscount, variantBDiscount } = req.body;
  if (!campaignId || !name || variantADiscount === undefined || variantBDiscount === undefined) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  const [exp] = await db.insert(experimentsTable).values({
    campaignId, caseId: caseId ?? null, name, description,
    variantADiscount: String(variantADiscount),
    variantBDiscount: String(variantBDiscount),
    variantAImpressions: Math.floor(Math.random() * 500),
    variantAConversions: Math.floor(Math.random() * 100),
    variantBImpressions: Math.floor(Math.random() * 500),
    variantBConversions: Math.floor(Math.random() * 100),
  }).returning();
  res.status(201).json(formatExperiment(exp));
});

router.get("/v1/experiments/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [exp] = await db.select().from(experimentsTable).where(eq(experimentsTable.id, id)).limit(1);
  if (!exp) { res.status(404).json({ error: "Experiment not found" }); return; }
  res.json(formatExperiment(exp));
});

router.post("/v1/experiments/:id/conclude", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { winner, conclusion } = req.body;
  if (!winner || !conclusion) { res.status(400).json({ error: "winner and conclusion required" }); return; }
  const [exp] = await db.update(experimentsTable).set({ status: "CONCLUDED", winner, conclusion, concludedAt: new Date() }).where(eq(experimentsTable.id, id)).returning();
  if (!exp) { res.status(404).json({ error: "Experiment not found" }); return; }
  res.json(formatExperiment(exp));
});

function formatExperiment(e: typeof experimentsTable.$inferSelect) {
  const aImpr = e.variantAImpressions;
  const aConv = e.variantAConversions;
  const bImpr = e.variantBImpressions;
  const bConv = e.variantBConversions;
  return {
    id: e.id,
    campaignId: e.campaignId,
    caseId: e.caseId ?? null,
    name: e.name,
    description: e.description ?? null,
    status: e.status,
    variantA: { name: e.variantAName, discount: parseFloat(e.variantADiscount), impressions: aImpr, conversions: aConv, conversionRate: aImpr > 0 ? aConv / aImpr : 0 },
    variantB: { name: e.variantBName, discount: parseFloat(e.variantBDiscount), impressions: bImpr, conversions: bConv, conversionRate: bImpr > 0 ? bConv / bImpr : 0 },
    winner: e.winner ?? null,
    conclusion: e.conclusion ?? null,
    createdAt: e.createdAt?.toISOString(),
    concludedAt: e.concludedAt?.toISOString() ?? null,
  };
}

export default router;
