import { describe, it, expect } from 'vitest';
import {
  scoreSubscriberForCampaign,
  classifySegment,
  scoreExpertForAssignment,
  selectBestExpert,
  type SubscriberProfile,
  type CampaignProfile,
  type ExpertProfile,
} from './scorer.js';

const baseSubscriber: SubscriberProfile = {
  monthlySpend: 120,
  dataUsageGb: 15,
  voiceMinutes: 200,
  churnRisk: 0.3,
  valueScore: 0.6,
  acceptedCampaigns: 2,
  rejectedCampaigns: 1,
  segment: 'YUKSEK_DEGER',
  tariff: 'standart',
};

const baseCampaign: CampaignProfile = {
  type: 'EK_PAKET',
  discount: 20,
  segment: 'YUKSEK_DEGER',
};

describe('scoreSubscriberForCampaign', () => {
  it('returns score between 0 and 1', () => {
    const result = scoreSubscriberForCampaign(baseSubscriber, baseCampaign);
    expect(result.recommendationScore).toBeGreaterThanOrEqual(0);
    expect(result.recommendationScore).toBeLessThanOrEqual(1);
    expect(result.conversionProbability).toBeGreaterThanOrEqual(0);
    expect(result.conversionProbability).toBeLessThanOrEqual(1);
  });

  it('scores segment match higher than mismatch', () => {
    const matched = scoreSubscriberForCampaign(baseSubscriber, baseCampaign);
    const mismatched = scoreSubscriberForCampaign(baseSubscriber, { ...baseCampaign, segment: 'PASIF' });
    expect(matched.recommendationScore).toBeGreaterThan(mismatched.recommendationScore);
  });

  it('penalises high rejection history', () => {
    const normal = scoreSubscriberForCampaign(baseSubscriber, baseCampaign);
    const rejected = scoreSubscriberForCampaign({ ...baseSubscriber, rejectedCampaigns: 10 }, baseCampaign);
    expect(normal.recommendationScore).toBeGreaterThan(rejected.recommendationScore);
  });

  it('boosts SADAKAT campaigns for high churn risk', () => {
    const highChurn: SubscriberProfile = { ...baseSubscriber, churnRisk: 0.9 };
    const sadakat = scoreSubscriberForCampaign(highChurn, { ...baseCampaign, type: 'SADAKAT' });
    const ekPaket  = scoreSubscriberForCampaign(highChurn, { ...baseCampaign, type: 'EK_PAKET' });
    expect(sadakat.recommendationScore).toBeGreaterThan(ekPaket.recommendationScore);
  });

  it('includes human-readable reasoning', () => {
    const result = scoreSubscriberForCampaign(baseSubscriber, baseCampaign);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });
});

describe('classifySegment', () => {
  it('classifies high churn risk as RISKLI_KAYIP', () => {
    const result = classifySegment({ ...baseSubscriber, churnRisk: 0.9 });
    expect(result.segment).toBe('RISKLI_KAYIP');
    expect(result.priority).toBe('KRITIK');
  });

  it('classifies moderate churn risk as RISKLI_KAYIP YUKSEK', () => {
    const result = classifySegment({ ...baseSubscriber, churnRisk: 0.65 });
    expect(result.segment).toBe('RISKLI_KAYIP');
    expect(result.priority).toBe('YUKSEK');
  });

  it('classifies high spend + high value as YUKSEK_DEGER', () => {
    const result = classifySegment({ ...baseSubscriber, monthlySpend: 300, valueScore: 0.85, churnRisk: 0.1 });
    expect(result.segment).toBe('YUKSEK_DEGER');
  });

  it('classifies inactive subscribers as PASIF', () => {
    const result = classifySegment({ ...baseSubscriber, monthlySpend: 30, dataUsageGb: 2, voiceMinutes: 50, churnRisk: 0.2 });
    expect(result.segment).toBe('PASIF');
  });

  it('classifies new subscribers with no campaign history as YENI_ABONE', () => {
    const result = classifySegment({ ...baseSubscriber, acceptedCampaigns: 0, rejectedCampaigns: 0, churnRisk: 0.1 });
    expect(result.segment).toBe('YENI_ABONE');
  });
});

describe('scoreExpertForAssignment', () => {
  const expert: ExpertProfile = {
    expertId: 'exp-1',
    expertName: 'Ahmet',
    specializations: ['RISKLI_KAYIP'],
    activeCases: 3,
    maxCapacity: 10,
    avgConversionLift: 0.15,
    completedCases: 20,
  };

  it('returns -1 when expert is at capacity', () => {
    expect(scoreExpertForAssignment({ ...expert, activeCases: 10 }, 'RISKLI_KAYIP')).toBe(-1);
  });

  it('scores higher when specialization matches', () => {
    const matched   = scoreExpertForAssignment(expert, 'RISKLI_KAYIP');
    const unmatched = scoreExpertForAssignment(expert, 'PASIF');
    expect(matched).toBeGreaterThan(unmatched);
  });

  it('result is between 0 and 1', () => {
    const score = scoreExpertForAssignment(expert, 'RISKLI_KAYIP');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('selectBestExpert', () => {
  it('returns null for empty list', () => {
    expect(selectBestExpert([], 'RISKLI_KAYIP')).toBeNull();
  });

  it('returns null when all experts are at capacity', () => {
    const full: ExpertProfile = { expertId: 'e', expertName: 'X', specializations: [], activeCases: 10, maxCapacity: 10, avgConversionLift: 0, completedCases: 0 };
    expect(selectBestExpert([full], 'RISKLI_KAYIP')).toBeNull();
  });

  it('selects expert with matching specialization over non-matching', () => {
    const matching: ExpertProfile    = { expertId: 'e1', expertName: 'A', specializations: ['RISKLI_KAYIP'], activeCases: 5, maxCapacity: 10, avgConversionLift: 0.1, completedCases: 10 };
    const nonMatching: ExpertProfile = { expertId: 'e2', expertName: 'B', specializations: ['PASIF'], activeCases: 1, maxCapacity: 10, avgConversionLift: 0.2, completedCases: 20 };
    expect(selectBestExpert([matching, nonMatching], 'RISKLI_KAYIP')?.expertId).toBe('e1');
  });
});
