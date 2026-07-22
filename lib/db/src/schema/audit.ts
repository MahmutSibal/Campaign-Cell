import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: uuid("resource_id"),
  result: text("result").notNull().default("SUCCESS"), // SUCCESS | FAILURE
  ipAddress: text("ip_address").notNull().default("::1"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
