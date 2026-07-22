import { pgTable, uuid, varchar, boolean, integer, timestamp, text, numeric } from 'drizzle-orm/pg-core';

export const predictionsTable = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: varchar('campaign_id', { length: 255 }),
  subscriberId: varchar('subscriber_id', { length: 255 }),
  recommendationScore: numeric('recommendation_score', { precision: 5, scale: 4 }),
  conversionProbability: numeric('conversion_probability', { precision: 5, scale: 4 }),
  segment: varchar('segment', { length: 50 }),
  priority: varchar('priority', { length: 20 }),
  reasoning: text('reasoning'),
  isAiMisclassified: boolean('is_ai_misclassified').default(false),
  correctedSegment: varchar('corrected_segment', { length: 50 }),
  correctedBy: varchar('corrected_by', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expertProfilesTable = pgTable('expert_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  expertId: varchar('expert_id', { length: 255 }).unique().notNull(),
  expertName: varchar('expert_name', { length: 255 }),
  specializations: text('specializations').default('[]'),
  activeCases: integer('active_cases').default(0),
  maxCapacity: integer('max_capacity').default(10),
  avgConversionLift: numeric('avg_conversion_lift', { precision: 5, scale: 4 }).default('0'),
  completedCases: integer('completed_cases').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type Prediction = typeof predictionsTable.$inferSelect;
export type ExpertProfile = typeof expertProfilesTable.$inferSelect;
