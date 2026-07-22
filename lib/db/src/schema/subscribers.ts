import { pgTable, text, timestamp, numeric, integer, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscribersTable = pgTable("subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  name: text("name").notNull(),
  gsmNumber: text("gsm_number").notNull().unique(),
  segment: text("segment").notNull().default("BELIRSIZ"),
  tariff: text("tariff").notNull(),
  monthlySpend: numeric("monthly_spend", { precision: 8, scale: 2 }).notNull(),
  dataUsageGb: numeric("data_usage_gb", { precision: 6, scale: 2 }).notNull(),
  voiceMinutes: integer("voice_minutes").notNull().default(0),
  churnRisk: numeric("churn_risk", { precision: 4, scale: 3 }).notNull().default("0"),
  valueScore: numeric("value_score", { precision: 4, scale: 3 }).notNull().default("0"),
  acceptedCampaigns: integer("accepted_campaigns").notNull().default(0),
  rejectedCampaigns: integer("rejected_campaigns").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSubscriberSchema = createInsertSchema(subscribersTable).omit({ id: true, createdAt: true });
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribersTable.$inferSelect;

export const subscriberOffersTable = pgTable("subscriber_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriberId: uuid("subscriber_id").notNull(),
  campaignId: uuid("campaign_id").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | ACCEPTED | REJECTED | RATED
  recommendationScore: numeric("recommendation_score", { precision: 4, scale: 3 }).notNull(),
  conversionProbability: numeric("conversion_probability", { precision: 4, scale: 3 }).notNull(),
  aiReasoning: text("ai_reasoning").notNull().default(""),
  rating: integer("rating"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SubscriberOffer = typeof subscriberOffersTable.$inferSelect;
