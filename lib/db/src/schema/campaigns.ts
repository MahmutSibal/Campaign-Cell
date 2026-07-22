import { pgTable, text, timestamp, numeric, boolean, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // EK_PAKET | TARIFE_YUKSELTME | CIHAZ_FIRSATI | SADAKAT
  status: text("status").notNull().default("DRAFT"),
  segment: text("segment").notNull().default("BELIRSIZ"),
  priority: text("priority").notNull().default("MEDIUM"),
  discount: numeric("discount", { precision: 5, scale: 2 }).notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  recommendationScore: numeric("recommendation_score", { precision: 4, scale: 3 }),
  conversionProbability: numeric("conversion_probability", { precision: 4, scale: 3 }),
  aiReasoning: text("ai_reasoning"),
  isAiAnalyzed: boolean("is_ai_analyzed").notNull().default(false),
  conversionRate: numeric("conversion_rate", { precision: 5, scale: 4 }),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;

export const optimizationCasesTable = pgTable("optimization_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseCode: text("case_code").notNull().unique(),
  campaignId: uuid("campaign_id").notNull(),
  status: text("status").notNull().default("CREATED"),
  priority: text("priority").notNull().default("MEDIUM"),
  segment: text("segment").notNull().default("BELIRSIZ"),
  assignedExpertId: uuid("assigned_expert_id"),
  aiScore: numeric("ai_score", { precision: 4, scale: 3 }),
  conversionProbability: numeric("conversion_probability", { precision: 4, scale: 3 }),
  aiReasoning: text("ai_reasoning"),
  optimizationNote: text("optimization_note"),
  slaDeadline: timestamp("sla_deadline", { withTimezone: true }).notNull(),
  slaBreached: boolean("sla_breached").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type OptimizationCase = typeof optimizationCasesTable.$inferSelect;

export const caseNotesTable = pgTable("case_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull(),
  authorId: uuid("author_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaseNote = typeof caseNotesTable.$inferSelect;

export const experimentsTable = pgTable("experiments", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull(),
  caseId: uuid("case_id"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("RUNNING"),
  variantAName: text("variant_a_name").notNull().default("Variant A"),
  variantADiscount: numeric("variant_a_discount", { precision: 5, scale: 2 }).notNull(),
  variantAImpressions: integer("variant_a_impressions").notNull().default(0),
  variantAConversions: integer("variant_a_conversions").notNull().default(0),
  variantBName: text("variant_b_name").notNull().default("Variant B"),
  variantBDiscount: numeric("variant_b_discount", { precision: 5, scale: 2 }).notNull(),
  variantBImpressions: integer("variant_b_impressions").notNull().default(0),
  variantBConversions: integer("variant_b_conversions").notNull().default(0),
  winner: text("winner"),
  conclusion: text("conclusion"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  concludedAt: timestamp("concluded_at", { withTimezone: true }),
});

export type Experiment = typeof experimentsTable.$inferSelect;
