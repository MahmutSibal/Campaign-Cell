import { Router, Response } from 'express';
import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { predictionsTable, expertProfilesTable } from '../db/schema';
import { AuthRequest, requireAuth, requireRole } from '../middleware/requireAuth';
import { scoreSubscriberForCampaign, classifySegment, selectBestExpert, SubscriberProfile, CampaignProfile } from '../lib/scorer';
import { predictSegmentML, predictConversionML, isModelAvailable, getModelMetadata } from '../ml/mlModel';

const router = Router();

function derivePriority(segment: string, churnRisk: number): string {
  if (segment === 'RISKLI_KAYIP') return churnRisk > 0.85 ? 'KRITIK' : 'YUKSEK';
  if (segment === 'YUKSEK_DEGER') return 'ORTA';
  return 'DUSUK';
}

// Primary scoring path: the scikit-learn models trained in
// services/ai-service/training/ (see AI_APPROACH.md). Falls back to the
// deterministic rule-based formula only if the exported weights are
// missing/unreadable, so the service degrades gracefully rather than
// crashing — it should never actually trigger since the weights are
// committed to the repo.
function scoreWithModel(sp: SubscriberProfile, cp: CampaignProfile) {
  if (isModelAvailable()) {
    const segResult = predictSegmentML(sp)!;
    const conversionProbability = predictConversionML({
      ...sp,
      discount: cp.discount,
      subscriberSegment: sp.segment,
      campaignSegment: cp.segment,
      campaignType: cp.type,
    })!;
    const priority = derivePriority(segResult.segment, sp.churnRisk);
    // recommendationScore blends the model's conversion probability with its
    // own confidence in the subscriber's segment — a confident match on a
    // likely-to-convert subscriber should rank above a low-confidence one.
    const recommendationScore = parseFloat(
      Math.min(1, conversionProbability * 0.75 + segResult.confidence * 0.25).toFixed(4),
    );
    const topProbs = Object.entries(segResult.probabilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([seg, p]) => `${seg} %${(p * 100).toFixed(0)}`)
      .join(', ');
    return {
      recommendationScore,
      conversionProbability,
      segment: segResult.segment,
      priority,
      reasoning: `ML model tahmini: ${topProbs} (güven %${(segResult.confidence * 100).toFixed(0)}), dönüşüm olasılığı %${(conversionProbability * 100).toFixed(0)}.`,
      method: 'ml_model' as const,
    };
  }

  const score = scoreSubscriberForCampaign(sp, cp);
  const classification = classifySegment(sp);
  return {
    recommendationScore: score.recommendationScore,
    conversionProbability: score.conversionProbability,
    segment: classification.segment,
    priority: classification.priority,
    reasoning: score.reasoning,
    method: 'rule_based' as const,
  };
}

// POST /v1/ai/recommend
router.post('/recommend', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { subscriberId, campaignId, subscriberProfile, campaignProfile } = req.body;
  if (!subscriberProfile || !campaignProfile) {
    res.status(400).json({ success: false, error: 'subscriberProfile and campaignProfile required' }); return;
  }
  const sp: SubscriberProfile = subscriberProfile;
  const cp: CampaignProfile = campaignProfile;
  const result = scoreWithModel(sp, cp);

  const [pred] = await db.insert(predictionsTable).values({
    campaignId: campaignId || null,
    subscriberId: subscriberId || null,
    recommendationScore: String(result.recommendationScore),
    conversionProbability: String(result.conversionProbability),
    segment: result.segment,
    priority: result.priority,
    reasoning: result.reasoning,
  }).returning();

  res.json({ success: true, data: {
    predictionId: pred.id,
    recommendationScore: result.recommendationScore,
    conversionProbability: result.conversionProbability,
    segment: result.segment,
    priority: result.priority,
    reasoning: result.reasoning,
    method: result.method,
  }});
});

// POST /v1/ai/predict (alias)
router.post('/predict', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { subscriberProfile, campaignProfile, subscriberId, campaignId } = req.body;
  if (!subscriberProfile || !campaignProfile) { res.status(400).json({ success: false, error: 'subscriberProfile and campaignProfile required' }); return; }
  const result = scoreWithModel(subscriberProfile, campaignProfile);
  await db.insert(predictionsTable).values({ campaignId, subscriberId, recommendationScore: String(result.recommendationScore), conversionProbability: String(result.conversionProbability), segment: result.segment, priority: result.priority, reasoning: result.reasoning });
  res.json({ success: true, data: result });
});

// GET /v1/ai/model-info — trained ML model transparency (accuracy, training set size)
router.get('/model-info', requireAuth, async (_req: AuthRequest, res: Response): Promise<void> => {
  const metadata = getModelMetadata();
  res.json({ success: true, data: metadata ?? { available: false, note: 'Model weights not found — using rule-based fallback' } });
});

// GET /v1/ai/predictions
router.get('/predictions', requireRole('SUPERVISOR', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(String(req.query.page || '1'));
  const limit = Math.min(parseInt(String(req.query.limit || '50')), 200);
  const preds = await db.select().from(predictionsTable).orderBy(desc(predictionsTable.createdAt)).limit(limit).offset((page - 1) * limit);
  res.json({ success: true, data: preds, page, limit });
});

// GET /v1/ai/accuracy
router.get('/accuracy', requireRole('SUPERVISOR', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const allPreds = await db.select().from(predictionsTable);
  const total = allPreds.length;
  const misclassified = allPreds.filter(p => p.isAiMisclassified).length;
  const correct = total - misclassified;
  const overallAccuracy = total > 0 ? correct / total : 0;

  // Per-segment accuracy
  const segmentMap: Record<string, { total: number; misclassified: number }> = {};
  for (const p of allPreds) {
    const seg = p.segment || 'BELIRSIZ';
    if (!segmentMap[seg]) segmentMap[seg] = { total: 0, misclassified: 0 };
    segmentMap[seg].total++;
    if (p.isAiMisclassified) segmentMap[seg].misclassified++;
  }
  const bySegment = Object.entries(segmentMap).map(([segment, data]) => ({
    segment,
    total: data.total,
    correct: data.total - data.misclassified,
    misclassified: data.misclassified,
    accuracy: data.total > 0 ? parseFloat(((data.total - data.misclassified) / data.total).toFixed(4)) : 0,
  }));

  res.json({ success: true, data: { overallAccuracy: parseFloat(overallAccuracy.toFixed(4)), totalPredictions: total, correctPredictions: correct, misclassified, bySegment } });
});

// POST /v1/ai/expert-assignment
router.post('/expert-assignment', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId, segment, priority } = req.body;
  if (!segment) { res.status(400).json({ success: false, error: 'segment required' }); return; }

  const profiles = await db.select().from(expertProfilesTable);
  const experts = profiles.map(p => ({
    expertId: p.expertId,
    expertName: p.expertName || '',
    specializations: JSON.parse(p.specializations || '[]'),
    activeCases: p.activeCases || 0,
    maxCapacity: p.maxCapacity || 10,
    avgConversionLift: parseFloat(String(p.avgConversionLift || '0')),
    completedCases: p.completedCases || 0,
  }));

  const best = selectBestExpert(experts, segment);
  if (!best) {
    res.json({ success: true, data: { expertId: null, expertName: null, message: 'Uygun uzman bulunamadı, vaka kuyruğa alındı' } });
    return;
  }

  // Increment active cases
  await db.update(expertProfilesTable).set({ activeCases: (best.activeCases + 1) }).where(eq(expertProfilesTable.expertId, best.expertId));

  res.json({ success: true, data: { expertId: best.expertId, expertName: best.expertName, score: best.activeCases < best.maxCapacity ? 'assigned' : 'queued' } });
});

// PATCH /v1/ai/segment-override
router.patch('/segment-override', requireRole('CAMPAIGN_EXPERT', 'SUPERVISOR'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { predictionId, newSegment } = req.body;
  if (!predictionId || !newSegment) { res.status(400).json({ success: false, error: 'predictionId and newSegment required' }); return; }
  const [pred] = await db.update(predictionsTable).set({ isAiMisclassified: true, correctedSegment: newSegment, correctedBy: req.user!.id }).where(eq(predictionsTable.id, predictionId)).returning();
  if (!pred) { res.status(404).json({ success: false, error: 'Prediction not found' }); return; }
  res.json({ success: true, data: pred });
});

export default router;
