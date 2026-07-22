import { pgTable, text, timestamp, boolean, uuid, numeric } from "drizzle-orm/pg-core";

export const predictionsTable = pgTable("predictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull(),
  subscriberId: uuid("subscriber_id").notNull(),
  recommendationScore: numeric("recommendation_score", { precision: 4, scale: 3 }).notNull(),
  conversionProbability: numeric("conversion_probability", { precision: 4, scale: 3 }).notNull(),
  segment: text("segment").notNull(),
  priority: text("priority").notNull(),
  reasoning: text("reasoning").notNull(),
  isAiMisclassified: boolean("is_ai_misclassified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Prediction = typeof predictionsTable.$inferSelect;
