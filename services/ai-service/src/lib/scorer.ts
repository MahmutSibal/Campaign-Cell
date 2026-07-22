export interface SubscriberProfile {
  monthlySpend: number;
  dataUsageGb: number;
  voiceMinutes: number;
  churnRisk: number;
  valueScore: number;
  acceptedCampaigns: number;
  rejectedCampaigns: number;
  segment: string;
  tariff: string;
}

export interface CampaignProfile {
  type: string;
  discount: number;
  segment: string;
}

export function scoreSubscriberForCampaign(
  subscriber: SubscriberProfile,
  campaign: CampaignProfile
): { recommendationScore: number; conversionProbability: number; reasoning: string } {
  // Feature 1: Segment match (weight 0.30)
  const segmentMatch =
    subscriber.segment === campaign.segment ? 1.0 :
    subscriber.segment === 'BELIRSIZ' ? 0.5 : 0.3;

  // Feature 2: Churn factor — SADAKAT campaigns prioritize churners (weight 0.20)
  const churnFactor =
    campaign.type === 'SADAKAT'
      ? Math.min(subscriber.churnRisk * 1.2, 1.0)
      : Math.max(1.0 - subscriber.churnRisk * 0.4, 0.1);

  // Feature 3: Subscriber value score (weight 0.20)
  const valueFactor = subscriber.valueScore;

  // Feature 4: Discount appeal (weight 0.15)
  const discountAppeal = Math.min((campaign.discount / 100) * 1.1, 1.0);

  // Feature 5: Usage fit by campaign type (weight 0.15)
  let usageFactor: number;
  if (campaign.type === 'EK_PAKET') {
    usageFactor = Math.min(subscriber.dataUsageGb / 40, 1.0);
  } else if (campaign.type === 'TARIFE_YUKSELTME') {
    usageFactor = Math.min(subscriber.monthlySpend / 300, 1.0);
  } else if (campaign.type === 'CIHAZ_FIRSATI') {
    usageFactor = subscriber.monthlySpend > 150 ? 0.8 : 0.4;
  } else {
    usageFactor = 0.6;
  }

  // History adjustment multipliers
  const historyPenalty =
    subscriber.rejectedCampaigns > 5 ? 0.70 :
    subscriber.rejectedCampaigns > 2 ? 0.85 : 1.0;
  const historyBonus = subscriber.acceptedCampaigns > 3 ? 1.10 : 1.0;

  const rawScore =
    segmentMatch   * 0.30 +
    churnFactor    * 0.20 +
    valueFactor    * 0.20 +
    discountAppeal * 0.15 +
    usageFactor    * 0.15;

  const recommendationScore = Math.min(1.0, Math.max(0.0, rawScore * historyPenalty * historyBonus));
  const conversionProbability = Math.min(1.0,
    recommendationScore * (1 - subscriber.churnRisk * 0.25) * (subscriber.valueScore * 0.40 + 0.60)
  );

  // Generate human-readable reasoning from actual values
  const parts: string[] = [];
  if (segmentMatch > 0.8) parts.push(`Segment uyumu mükemmel (${subscriber.segment})`);
  else if (segmentMatch < 0.4) parts.push(`Segment uyumsuzluğu (abone: ${subscriber.segment}, kampanya: ${campaign.segment})`);
  if (subscriber.churnRisk > 0.6 && campaign.type === 'SADAKAT') parts.push(`Yüksek kayıp riski (%${(subscriber.churnRisk * 100).toFixed(0)}) - sadakat kampanyası uygun`);
  if (subscriber.dataUsageGb > 30 && campaign.type === 'EK_PAKET') parts.push(`Yüksek veri kullanımı: ${subscriber.dataUsageGb}GB/ay`);
  if (campaign.discount >= 30) parts.push(`Cazip indirim: %${campaign.discount}`);
  if (subscriber.valueScore > 0.7) parts.push(`Yüksek değerli abone (skor: ${subscriber.valueScore.toFixed(2)})`);
  if (subscriber.rejectedCampaigns > 3) parts.push(`Önceki red geçmişi (${subscriber.rejectedCampaigns} ret) dikkate alındı`);
  if (subscriber.acceptedCampaigns > 3) parts.push(`Yüksek kabul geçmişi (${subscriber.acceptedCampaigns} kabul) - olumlu sinyal`);
  if (parts.length === 0) parts.push(`Genel öneri skoru: %${(recommendationScore * 100).toFixed(0)}`);

  return {
    recommendationScore: parseFloat(recommendationScore.toFixed(4)),
    conversionProbability: parseFloat(conversionProbability.toFixed(4)),
    reasoning: parts.join('. ') + '.',
  };
}

export function classifySegment(subscriber: SubscriberProfile): { segment: string; priority: string } {
  if (subscriber.churnRisk > 0.85) return { segment: 'RISKLI_KAYIP', priority: 'KRITIK' };
  if (subscriber.churnRisk > 0.55) return { segment: 'RISKLI_KAYIP', priority: 'YUKSEK' };
  if (subscriber.monthlySpend > 250 && subscriber.valueScore > 0.70) return { segment: 'YUKSEK_DEGER', priority: 'ORTA' };
  if (subscriber.monthlySpend < 50 && subscriber.dataUsageGb < 5 && subscriber.voiceMinutes < 100) return { segment: 'PASIF', priority: 'DUSUK' };
  if (subscriber.acceptedCampaigns === 0 && subscriber.rejectedCampaigns === 0) return { segment: 'YENI_ABONE', priority: 'DUSUK' };
  return { segment: 'BELIRSIZ', priority: 'DUSUK' };
}

export interface ExpertProfile {
  expertId: string;
  expertName: string;
  specializations: string[];
  activeCases: number;
  maxCapacity: number;
  avgConversionLift: number;
  completedCases: number;
}

export function scoreExpertForAssignment(expert: ExpertProfile, caseSegment: string): number {
  if (expert.activeCases >= expert.maxCapacity) return -1;
  const uzmanlikEslesme = expert.specializations.includes(caseSegment) ? 1.0 : 0.0;
  const boslukOrani = 1.0 - expert.activeCases / expert.maxCapacity;
  const performans = Math.min(expert.avgConversionLift * 5, 1.0);
  return uzmanlikEslesme * 0.5 + boslukOrani * 0.3 + performans * 0.2;
}

export function selectBestExpert(experts: ExpertProfile[], caseSegment: string): ExpertProfile | null {
  let best: ExpertProfile | null = null;
  let bestScore = -1;
  for (const expert of experts) {
    const score = scoreExpertForAssignment(expert, caseSegment);
    if (score > bestScore) { bestScore = score; best = expert; }
  }
  return best;
}
