import { pgTable, text, timestamp, integer, uuid, numeric } from "drizzle-orm/pg-core";

export const gamificationProfilesTable = pgTable("gamification_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  totalPoints: integer("total_points").notNull().default(0),
  level: text("level").notNull().default("BRONZE"), // BRONZE | SILVER | GOLD | PLATINUM
  completedCases: integer("completed_cases").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type GamificationProfile = typeof gamificationProfilesTable.$inferSelect;

export const pointsTransactionsTable = pgTable("points_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  caseId: uuid("case_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PointsTransaction = typeof pointsTransactionsTable.$inferSelect;

export const badgesTable = pgTable("badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  requirement: text("requirement").notNull(),
});

export type Badge = typeof badgesTable.$inferSelect;

export const userBadgesTable = pgTable("user_badges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  badgeId: uuid("badge_id").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserBadge = typeof userBadgesTable.$inferSelect;
