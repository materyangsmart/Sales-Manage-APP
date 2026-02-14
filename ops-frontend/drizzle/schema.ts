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
// Note: This table was created by backend TypeORM, so field names use camelCase
export const salesCommissionRules = mysqlTable("sales_commission_rules", {
  id: int("id").autoincrement().primaryKey(),
  version: varchar("version", { length: 20 }).notNull(), // Backend uses 'version', not 'rule_version'
  category: mysqlEnum("category", ["WET_MARKET", "WHOLESALE_B", "SUPERMARKET", "ECOMMERCE", "DEFAULT"]).default("DEFAULT").notNull(),
  effectiveFrom: timestamp("effectiveFrom").notNull(), // Backend uses 'effectiveFrom', not 'effective_date'
  ruleJson: text("ruleJson").notNull(), // Backend uses 'ruleJson' (camelCase)
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SalesCommissionRule = typeof salesCommissionRules.$inferSelect;
export type InsertSalesCommissionRule = typeof salesCommissionRules.$inferInsert;