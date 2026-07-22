import { pgTable, uuid, varchar, integer, timestamp, text, numeric } from 'drizzle-orm/pg-core';

export const gamificationProfilesTable = pgTable('gamification_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).unique().notNull(),
  userName: varchar('user_name', { length: 255 }),
  totalPoints: integer('total_points').default(0),
  level: varchar('level', { length: 20 }).default('BRONZ'),
  completedCases: integer('completed_cases').default(0),
  fastCompletions: integer('fast_completions').default(0),
  conversionTargetHits: integer('conversion_target_hits').default(0),
  churnCasesResolved: integer('churn_cases_resolved').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const pointsTransactionsTable = pgTable('points_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  points: integer('points').notNull(),
  reason: varchar('reason', { length: 255 }),
  caseId: varchar('case_id', { length: 255 }),
  segment: varchar('segment', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const badgesTable = pgTable('badges', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).unique(),
  description: text('description'),
  icon: varchar('icon', { length: 50 }),
  requirement: text('requirement'),
});

export const userBadgesTable = pgTable('user_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  badgeId: varchar('badge_id', { length: 50 }).notNull(),
  earnedAt: timestamp('earned_at').defaultNow(),
});

export type GameProfile = typeof gamificationProfilesTable.$inferSelect;
export type PointsTransaction = typeof pointsTransactionsTable.$inferSelect;
export type Badge = typeof badgesTable.$inferSelect;
