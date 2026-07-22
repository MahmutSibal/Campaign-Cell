import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  text,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'SUBSCRIBER',
  'CAMPAIGN_EXPERT',
  'SUPERVISOR',
  'ADMIN',
]);

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  // Nullable: GSM+OTP self-registered SUBSCRIBER accounts may not supply an email.
  email: varchar('email', { length: 255 }).unique(),
  gsmNumber: varchar('gsm_number', { length: 20 }).unique(),
  role: userRoleEnum('role').notNull().default('SUBSCRIBER'),
  expertise: text('expertise').array().default([]),
  region: text('region').array().default([]),
  passwordHash: varchar('password_hash', { length: 255 }),
  isLocked: boolean('is_locked').default(false),
  loginAttempts: integer('login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  createdAt: timestamp('created_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
});

export const refreshTokensTable = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => usersTable.id),
  token: varchar('token', { length: 512 }).unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const auditLogsTable = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  userName: varchar('user_name', { length: 255 }),
  action: varchar('action', { length: 255 }).notNull(),
  resource: varchar('resource', { length: 255 }),
  resourceId: varchar('resource_id', { length: 255 }),
  result: varchar('result', { length: 50 }).default('SUCCESS'),
  ipAddress: varchar('ip_address', { length: 255 }),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type NewRefreshToken = typeof refreshTokensTable.$inferInsert;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type NewAuditLog = typeof auditLogsTable.$inferInsert;
