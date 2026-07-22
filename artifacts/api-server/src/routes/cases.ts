import { Router } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, optimizationCasesTable, caseNotesTable, campaignsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

// List cases
router.get("/v1/cases", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const page = parseInt(String(req.query.page || "1"));
  const limit = parseInt(String(req.query.limit || "20"));
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.status) conditions.push(eq(optimizationCasesTable.status, String(req.query.status)));
  if (req.query.priority) conditions.push(eq(optimizationCasesTable.priority, String(req.query.priority)));
  if (req.query.assignedTo) conditions.push(eq(optimizationCasesTable.assignedExpertId, String(req.query.assignedTo)));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const [cases, totalRows] = await Promise.all([
    db.select().from(optimizationCasesTable).where(whereClause).orderBy(desc(optimizationCasesTable.createdAt)).limit(limit).offset(offset),
    db.select({ cnt: count() }).from(optimizationCasesTable).where(whereClause),
  ]);

  const caseIds = cases.map(c => c.id);
  const allNotes = caseIds.length ? await db.select().from(caseNotesTable).where(
    caseIds.length === 1 ? eq(caseNotesTable.caseId, caseIds[0]) : undefined
  ).orderBy(caseNotesTable.createdAt) : [];

  const campaignIds = [...new Set(cases.map(c => c.campaignId))];
  const campaigns = campaignIds.length ? await db.select({ id: campaignsTable.id, name: campaignsTable.name }).from(campaignsTable) : [];
  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c.name]));

  const expertIds = [...new Set(cases.filter(c => c.assignedExpertId).map(c => c.assignedExpertId!))];
  const experts = expertIds.length ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable) : [];
  const expertMap = Object.fromEntries(experts.map(e => [e.id, e.name]));

  const data = cases.map(c => formatCase(c, allNotes.filter(n => n.caseId === c.id), campaignMap[c.campaignId], expertMap[c.assignedExpertId ?? ""]));
  res.json({ data, total: Number(totalRows[0]?.cnt ?? 0), page, limit });
});

// Get case
router.get("/v1/cases/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [c] = await db.select().from(optimizationCasesTable).where(eq(optimizationCasesTable.id, id)).limit(1);
  if (!c) { res.status(404).json({ error: "Case not found" }); return; }

  const notes = await db.select().from(caseNotesTable).where(eq(caseNotesTable.caseId, id)).orderBy(caseNotesTable.createdAt);
  const [campaign] = await db.select({ name: campaignsTable.name }).from(campaignsTable).where(eq(campaignsTable.id, c.campaignId)).limit(1);
  const expertName = c.assignedExpertId ? (await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, c.assignedExpertId)).limit(1))[0]?.name : undefined;

  res.json(formatCase(c, notes, campaign?.name, expertName));
});

// Update case
router.patch("/v1/cases/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, priority, segment } = req.body;
  const update: Record<string, unknown> = {};
  if (status !== undefined) update.status = status;
  if (priority !== undefined) update.priority = priority;
  if (segment !== undefined) update.segment = segment;

  const [c] = await db.update(optimizationCasesTable).set(update).where(eq(optimizationCasesTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Case not found" }); return; }
  const notes = await db.select().from(caseNotesTable).where(eq(caseNotesTable.caseId, id)).orderBy(caseNotesTable.createdAt);
  res.json(formatCase(c, notes));
});

// Assign case
router.post("/v1/cases/:id/assign", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { expertId } = req.body;
  if (!expertId) { res.status(400).json({ error: "expertId required" }); return; }

  const [expert] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, expertId)).limit(1);
  const [c] = await db.update(optimizationCasesTable).set({
    assignedExpertId: expertId,
    status: "ASSIGNED",
  }).where(eq(optimizationCasesTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Case not found" }); return; }
  const notes = await db.select().from(caseNotesTable).where(eq(caseNotesTable.caseId, id)).orderBy(caseNotesTable.createdAt);
  res.json(formatCase(c, notes, undefined, expert?.name));
});

// Complete case
router.post("/v1/cases/:id/complete", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { optimizationNote } = req.body;
  if (!optimizationNote) { res.status(400).json({ error: "optimizationNote is required to complete a case" }); return; }

  const [c] = await db.update(optimizationCasesTable).set({
    status: "OPTIMIZED",
    optimizationNote,
  }).where(eq(optimizationCasesTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Case not found" }); return; }

  // Award points
  const { gamificationProfilesTable, pointsTransactionsTable } = await import("@workspace/db");
  const slaTime = c.slaDeadline ? new Date(c.slaDeadline).getTime() : null;
  const isFast = slaTime ? (Date.now() < slaTime - 2 * 3600 * 1000) : false;
  const basePoints = 10 + (isFast ? 5 : 0);

  if (c.assignedExpertId) {
    const [profile] = await db.select().from(gamificationProfilesTable).where(eq(gamificationProfilesTable.userId, c.assignedExpertId)).limit(1);
    if (profile) {
      const newPoints = profile.totalPoints + basePoints;
      const newLevel = newPoints >= 500 ? "PLATINUM" : newPoints >= 200 ? "GOLD" : newPoints >= 75 ? "SILVER" : "BRONZE";
      await Promise.all([
        db.update(gamificationProfilesTable).set({ totalPoints: newPoints, level: newLevel, completedCases: profile.completedCases + 1 }).where(eq(gamificationProfilesTable.userId, c.assignedExpertId)),
        db.insert(pointsTransactionsTable).values({ userId: c.assignedExpertId, points: basePoints, reason: isFast ? "Fast Optimization Completed (+5 bonus)" : "Optimization Completed", caseId: id }),
      ]);
    }
  }

  const notes = await db.select().from(caseNotesTable).where(eq(caseNotesTable.caseId, id)).orderBy(caseNotesTable.createdAt);
  res.json(formatCase(c, notes));
});

// Add note
router.post("/v1/cases/:id/notes", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const caseId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { content } = req.body;
  if (!content) { res.status(400).json({ error: "content required" }); return; }

  const [note] = await db.insert(caseNotesTable).values({
    caseId,
    authorId: req.user!.id,
    authorName: req.user!.name,
    content,
  }).returning();

  res.status(201).json({ id: note.id, caseId: note.caseId, authorId: note.authorId, authorName: note.authorName, content: note.content, createdAt: note.createdAt?.toISOString() });
});

function formatCase(c: typeof optimizationCasesTable.$inferSelect, notes: typeof caseNotesTable.$inferSelect[] = [], campaignName?: string, expertName?: string) {
  return {
    id: c.id,
    caseCode: c.caseCode,
    campaignId: c.campaignId,
    campaignName: campaignName ?? null,
    status: c.status,
    priority: c.priority,
    segment: c.segment,
    assignedExpertId: c.assignedExpertId ?? null,
    assignedExpertName: expertName ?? null,
    aiScore: c.aiScore ? parseFloat(c.aiScore) : null,
    conversionProbability: c.conversionProbability ? parseFloat(c.conversionProbability) : null,
    aiReasoning: c.aiReasoning ?? null,
    optimizationNote: c.optimizationNote ?? null,
    slaDeadline: c.slaDeadline?.toISOString(),
    slaBreached: c.slaBreached,
    notes: notes.map(n => ({ id: n.id, caseId: n.caseId, authorId: n.authorId, authorName: n.authorName, content: n.content, createdAt: n.createdAt?.toISOString() })),
    createdAt: c.createdAt?.toISOString(),
    updatedAt: c.updatedAt?.toISOString(),
  };
}

export default router;
