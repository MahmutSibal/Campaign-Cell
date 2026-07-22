import fs from 'fs';
import path from 'path';

// Pure-TS inference for the scikit-learn Logistic Regression models trained
// in services/ai-service/training/train_model.py. No Python runtime, no
// ONNX — just the exact StandardScaler + linear-model math (standardize,
// then softmax/sigmoid over coef·x + intercept), reproduced from the
// exported weights so training and inference can never drift apart.
//
// See services/ai-service/training/ and AI_APPROACH.md for the training
// process, data generation, and accuracy numbers.

interface SegmentModelWeights {
  featureNames: string[];
  mean: number[];
  scale: number[];
  classes: string[];
  coef: number[][]; // [nClasses][nFeatures]
  intercept: number[]; // [nClasses]
  testAccuracy: number;
  nTrain: number;
  nTest: number;
}

interface ConversionModelWeights {
  featureNames: string[];
  mean: number[];
  scale: number[];
  coef: number[]; // [nFeatures]
  intercept: number;
  testAccuracy: number;
  nTrain: number;
  nTest: number;
  campaignTypes: string[];
}

interface ModelWeights {
  segmentModel: SegmentModelWeights;
  conversionModel: ConversionModelWeights;
  trainedAt: string;
}

let weights: ModelWeights | null = null;
let loadError: string | null = null;

function loadWeights(): ModelWeights | null {
  if (weights || loadError) return weights;
  try {
    const filePath = path.join(__dirname, 'model_weights.json');
    weights = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ModelWeights;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  return weights;
}

export function isModelAvailable(): boolean {
  return loadWeights() !== null;
}

export function getModelMetadata() {
  const w = loadWeights();
  if (!w) return null;
  return {
    trainedAt: w.trainedAt,
    segmentAccuracy: w.segmentModel.testAccuracy,
    conversionAccuracy: w.conversionModel.testAccuracy,
    segmentTrainSamples: w.segmentModel.nTrain,
    conversionTrainSamples: w.conversionModel.nTrain,
  };
}

function standardize(values: number[], mean: number[], scale: number[]): number[] {
  return values.map((v, i) => (v - mean[i]) / (scale[i] || 1));
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export interface SegmentFeatures {
  monthlySpend: number;
  dataUsageGb: number;
  voiceMinutes: number;
  churnRisk: number;
  valueScore: number;
  acceptedCampaigns: number;
  rejectedCampaigns: number;
}

export function predictSegmentML(
  f: SegmentFeatures,
): { segment: string; confidence: number; probabilities: Record<string, number> } | null {
  const w = loadWeights();
  if (!w) return null;
  const m = w.segmentModel;

  const isNewSubscriber = f.acceptedCampaigns === 0 && f.rejectedCampaigns === 0 ? 1 : 0;
  const isLowUsage = f.monthlySpend < 60 && f.dataUsageGb < 10 ? 1 : 0;

  const raw = [
    f.monthlySpend, f.dataUsageGb, f.voiceMinutes, f.churnRisk, f.valueScore,
    f.acceptedCampaigns, f.rejectedCampaigns, isNewSubscriber, isLowUsage,
  ];
  const x = standardize(raw, m.mean, m.scale);
  const logits = m.coef.map((classCoef, i) => dot(classCoef, x) + m.intercept[i]);
  const probs = softmax(logits);

  const probabilities: Record<string, number> = {};
  m.classes.forEach((c, i) => { probabilities[c] = parseFloat(probs[i].toFixed(4)); });

  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  return {
    segment: m.classes[bestIdx],
    confidence: parseFloat(probs[bestIdx].toFixed(4)),
    probabilities,
  };
}

export interface ConversionFeatures {
  monthlySpend: number;
  dataUsageGb: number;
  voiceMinutes: number;
  churnRisk: number;
  valueScore: number;
  acceptedCampaigns: number;
  rejectedCampaigns: number;
  discount: number;
  subscriberSegment: string;
  campaignSegment: string;
  campaignType: string;
}

export function predictConversionML(f: ConversionFeatures): number | null {
  const w = loadWeights();
  if (!w) return null;
  const m = w.conversionModel;

  const segmentMatch =
    f.subscriberSegment === f.campaignSegment ? 1.0 : f.subscriberSegment === 'BELIRSIZ' ? 0.5 : 0.0;
  const typeOneHot = m.campaignTypes.map((t) => (f.campaignType === t ? 1 : 0));

  const raw = [
    f.monthlySpend, f.dataUsageGb, f.voiceMinutes, f.churnRisk, f.valueScore,
    f.acceptedCampaigns, f.rejectedCampaigns, f.discount, segmentMatch,
    ...typeOneHot,
  ];
  const x = standardize(raw, m.mean, m.scale);
  const logit = dot(m.coef, x) + m.intercept;
  return parseFloat(sigmoid(logit).toFixed(4));
}
