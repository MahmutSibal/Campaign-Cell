import pino from 'pino';
const logger = pino({ transport: { target: 'pino-pretty' } });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:3003';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || '';

export interface AiScoreResult {
  recommendationScore: number;
  conversionProbability: number;
  segment: string;
  priority: string;
  reasoning: string;
}

export async function scoreCampaignForSubscriber(
  subscriberProfile: object,
  campaignProfile: object
): Promise<AiScoreResult> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/v1/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Token': SERVICE_TOKEN },
      body: JSON.stringify({ subscriberProfile, campaignProfile }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`AI service responded ${res.status}`);
    const data = await res.json() as any;
    return data.data || data;
  } catch (err) {
    logger.warn({ err }, 'AI service unavailable - using fallback');
    return {
      recommendationScore: 0.5,
      conversionProbability: 0.5,
      segment: 'BELIRSIZ',
      priority: 'ORTA',
      reasoning: 'AI servisi erişilemiyor - manuel inceleme gerekiyor',
    };
  }
}

export async function getExpertAssignment(
  caseId: string,
  segment: string,
  priority: string
): Promise<{ expertId: string; expertName: string } | null> {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/v1/ai/expert-assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-Token': SERVICE_TOKEN },
      body: JSON.stringify({ caseId, segment, priority }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const d = data.data || data;
    if (!d.expertId) return null;
    return { expertId: d.expertId, expertName: d.expertName };
  } catch {
    return null;
  }
}
