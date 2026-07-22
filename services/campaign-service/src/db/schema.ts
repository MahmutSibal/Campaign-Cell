import { pgTable, uuid, varchar, boolean, integer, timestamp, text, numeric } from 'drizzle-orm/pg-core';

export const campaignsTable = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('DRAFT'),
  segment: varchar('segment', { length: 50 }),
  priority: varchar('priority', { length: 20 }).default('ORTA'),
  discount: integer('discount').default(0),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  recommendationScore: numeric('recommendation_score', { precision: 5, scale: 4 }),
  conversionProbability: numeric('conversion_probability', { precision: 5, scale: 4 }),
  aiReasoning: text('ai_reasoning'),
  isAiAnalyzed: boolean('is_ai_analyzed').default(false),
  conversionRate: numeric('conversion_rate', { precision: 5, scale: 4 }),
  createdBy: varchar('created_by', { length: 255 }),
  campaignCode: varchar('campaign_code', { length: 50 }).unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const optimizationCasesTable = pgTable('optimization_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseCode: varchar('case_code', { length: 50 }).unique(),
  campaignId: varchar('campaign_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('YENI'),
  priority: varchar('priority', { length: 20 }).default('ORTA'),
  segment: varchar('segment', { length: 50 }),
  assignedExpertId: varchar('assigned_expert_id', { length: 255 }),
  assignedExpertName: varchar('assigned_expert_name', { length: 255 }),
  aiScore: numeric('ai_score', { precision: 5, scale: 4 }),
  conversionProbability: numeric('conversion_probability', { precision: 5, scale: 4 }),
  aiReasoning: text('ai_reasoning'),
  optimizationNote: text('optimization_note'),
  slaDeadline: timestamp('sla_deadline'),
  slaBreached: boolean('sla_breached').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const caseNotesTable = pgTable('case_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: varchar('case_id', { length: 255 }),
  authorId: varchar('author_id', { length: 255 }),
  authorName: varchar('author_name', { length: 255 }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const experimentsTable = pgTable('experiments', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: varchar('campaign_id', { length: 255 }),
  caseId: varchar('case_id', { length: 255 }),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('RUNNING'),
  variantAName: varchar('variant_a_name', { length: 100 }).default('Control'),
  variantADiscount: integer('variant_a_discount').default(0),
  variantAImpressions: integer('variant_a_impressions').default(0),
  variantAConversions: integer('variant_a_conversions').default(0),
  variantBName: varchar('variant_b_name', { length: 100 }).default('Variant B'),
  variantBDiscount: integer('variant_b_discount').default(0),
  variantBImpressions: integer('variant_b_impressions').default(0),
  variantBConversions: integer('variant_b_conversions').default(0),
  winner: varchar('winner', { length: 10 }),
  conclusion: text('conclusion'),
  concludedAt: timestamp('concluded_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subscribersTable = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  gsmNumber: varchar('gsm_number', { length: 20 }).unique(),
  segment: varchar('segment', { length: 50 }).default('BELIRSIZ'),
  tariff: varchar('tariff', { length: 100 }),
  monthlySpend: numeric('monthly_spend', { precision: 10, scale: 2 }).default('0'),
  dataUsageGb: numeric('data_usage_gb', { precision: 8, scale: 2 }).default('0'),
  voiceMinutes: integer('voice_minutes').default(0),
  churnRisk: numeric('churn_risk', { precision: 5, scale: 4 }).default('0'),
  valueScore: numeric('value_score', { precision: 5, scale: 4 }).default('0.5'),
  acceptedCampaigns: integer('accepted_campaigns').default(0),
  rejectedCampaigns: integer('rejected_campaigns').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const subscriberOffersTable = pgTable('subscriber_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriberId: varchar('subscriber_id', { length: 255 }),
  campaignId: varchar('campaign_id', { length: 255 }),
  status: varchar('status', { length: 20 }).default('PENDING'),
  segment: varchar('segment', { length: 50 }),
  priority: varchar('priority', { length: 20 }),
  recommendationScore: numeric('recommendation_score', { precision: 5, scale: 4 }),
  conversionProbability: numeric('conversion_probability', { precision: 5, scale: 4 }),
  aiReasoning: text('ai_reasoning'),
  rating: integer('rating'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Campaign = typeof campaignsTable.$inferSelect;
export type OptimizationCase = typeof optimizationCasesTable.$inferSelect;
export type Subscriber = typeof subscribersTable.$inferSelect;
export type SubscriberOffer = typeof subscriberOffersTable.$inferSelect;
