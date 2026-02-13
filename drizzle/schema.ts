import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Sales commission rules table
export const salesCommissionRules = mysqlTable("sales_commission_rules", {
  id: int("id").autoincrement().primaryKey(),
  ruleVersion: varchar("rule_version", { length: 50 }).notNull(),
  baseRate: varchar("base_rate", { length: 20 }).notNull(), // Stored as string to avoid decimal precision issues
  newCustomerBonus: varchar("new_customer_bonus", { length: 20 }).notNull(), // Stored as string
  effectiveDate: varchar("effective_date", { length: 10 }).notNull(), // ISO date string (YYYY-MM-DD)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SalesCommissionRule = typeof salesCommissionRules.$inferSelect;
export type InsertSalesCommissionRule = typeof salesCommissionRules.$inferInsert;