import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, boolean } from "drizzle-orm/mysql-core";

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

// Quality feedback table for customer reviews
export const qualityFeedback = mysqlTable("quality_feedback", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  batchNo: varchar("batchNo", { length: 50 }),
  customerName: varchar("customerName", { length: 100 }),
  rating: int("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  images: text("images"), // JSON array of image URLs
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QualityFeedback = typeof qualityFeedback.$inferSelect;
export type InsertQualityFeedback = typeof qualityFeedback.$inferInsert;
// ============================================================
// P22-P25 Governance Tables
// ============================================================

// P22: Price anomalies table for price monitoring
export const priceAnomalies = mysqlTable("price_anomalies", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  productId: int("productId").notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  regionAvgPrice: decimal("regionAvgPrice", { precision: 10, scale: 2 }).notNull(),
  deviationPercent: decimal("deviationPercent", { precision: 5, scale: 2 }).notNull(),
  salesRepId: int("salesRepId").notNull(),
  salesRepName: varchar("salesRepName", { length: 255 }).notNull(),
  specialReason: text("specialReason"),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED"]).default("PENDING").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PriceAnomaly = typeof priceAnomalies.$inferSelect;
export type InsertPriceAnomaly = typeof priceAnomalies.$inferInsert;

// P22: Settlement audit table for payment behavior monitoring
export const settlementAudit = mysqlTable("settlement_audit", {
  id: int("id").autoincrement().primaryKey(),
  paymentId: int("paymentId").notNull(),
  invoiceId: int("invoiceId").notNull(),
  applyAmount: decimal("applyAmount", { precision: 10, scale: 2 }).notNull(),
  salesRepId: int("salesRepId").notNull(),
  salesRepName: varchar("salesRepName", { length: 255 }).notNull(),
  applyTime: timestamp("applyTime").notNull(),
  commissionDeadline: timestamp("commissionDeadline").notNull(),
  timeToDeadline: int("timeToDeadline").notNull(),
  isSuspicious: boolean("isSuspicious").default(false).notNull(),
  suspiciousReason: text("suspiciousReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SettlementAudit = typeof settlementAudit.$inferSelect;
export type InsertSettlementAudit = typeof settlementAudit.$inferInsert;

// P23: Customer credit scores table
export const customerCreditScores = mysqlTable("customer_credit_scores", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull().unique(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  creditScore: int("creditScore").default(60).notNull(),
  creditLevel: mysqlEnum("creditLevel", ["S", "A", "B", "C", "D"]).default("C").notNull(),
  totalOrders: int("totalOrders").default(0).notNull(),
  totalAmount: decimal("totalAmount", { precision: 15, scale: 2 }).default("0").notNull(),
  paidAmount: decimal("paidAmount", { precision: 15, scale: 2 }).default("0").notNull(),
  paymentRate: decimal("paymentRate", { precision: 5, scale: 2 }).default("0").notNull(),
  overdueCount: int("overdueCount").default(0).notNull(),
  maxOverdueDays: int("maxOverdueDays").default(0).notNull(),
  lastOrderDate: date("lastOrderDate"),
  autoApproveEnabled: boolean("autoApproveEnabled").default(false).notNull(),
  autoApproveLimit: decimal("autoApproveLimit", { precision: 10, scale: 2 }).default("0").notNull(),
  lastCalculatedAt: timestamp("lastCalculatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CustomerCreditScore = typeof customerCreditScores.$inferSelect;
export type InsertCustomerCreditScore = typeof customerCreditScores.$inferInsert;

// P23: Auto approval logs table
export const autoApprovalLogs = mysqlTable("auto_approval_logs", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  orderAmount: decimal("orderAmount", { precision: 10, scale: 2 }).notNull(),
  creditScore: int("creditScore").notNull(),
  creditLevel: varchar("creditLevel", { length: 10 }).notNull(),
  paymentRate: decimal("paymentRate", { precision: 5, scale: 2 }).notNull(),
  autoApproveLimit: decimal("autoApproveLimit", { precision: 10, scale: 2 }).notNull(),
  decision: mysqlEnum("decision", ["APPROVED", "REJECTED", "MANUAL"]).notNull(),
  decisionReason: text("decisionReason").notNull(),
  processingTimeMs: int("processingTimeMs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AutoApprovalLog = typeof autoApprovalLogs.$inferSelect;
export type InsertAutoApprovalLog = typeof autoApprovalLogs.$inferInsert;

// P24: Role permissions table
export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  roleName: varchar("roleName", { length: 50 }).notNull(),
  permissionKey: varchar("permissionKey", { length: 100 }).notNull(),
  permissionName: varchar("permissionName", { length: 255 }).notNull(),
  permissionType: mysqlEnum("permissionType", ["READ", "WRITE", "DELETE", "APPROVE"]).notNull(),
  resourceType: varchar("resourceType", { length: 50 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// P24: Permission change logs table
export const permissionChangeLogs = mysqlTable("permission_change_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  oldRole: varchar("oldRole", { length: 50 }),
  newRole: varchar("newRole", { length: 50 }).notNull(),
  oldPermissions: text("oldPermissions"),
  newPermissions: text("newPermissions").notNull(),
  changedBy: int("changedBy").notNull(),
  changedByName: varchar("changedByName", { length: 255 }).notNull(),
  changeReason: text("changeReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PermissionChangeLog = typeof permissionChangeLogs.$inferSelect;
export type InsertPermissionChangeLog = typeof permissionChangeLogs.$inferInsert;

// P25: Batch trace table for production tracking
export const batchTrace = mysqlTable("batch_trace", {
  id: int("id").autoincrement().primaryKey(),
  batchNo: varchar("batchNo", { length: 50 }).notNull().unique(),
  productionDate: date("productionDate").notNull(),
  soybeanBatch: varchar("soybeanBatch", { length: 50 }).notNull(),
  soybeanSupplier: varchar("soybeanSupplier", { length: 255 }).notNull(),
  soybeanWeight: decimal("soybeanWeight", { precision: 10, scale: 2 }).notNull(),
  waterQualityReport: varchar("waterQualityReport", { length: 255 }),
  productOutput: decimal("productOutput", { precision: 10, scale: 2 }).notNull(),
  yieldRate: decimal("yieldRate", { precision: 5, scale: 2 }).notNull(),
  workshopTemp: decimal("workshopTemp", { precision: 5, scale: 2 }),
  sterilizationParams: varchar("sterilizationParams", { length: 255 }),
  inspectorId: int("inspectorId").notNull(),
  inspectorName: varchar("inspectorName", { length: 255 }).notNull(),
  qualityStatus: mysqlEnum("qualityStatus", ["PASS", "FAIL"]).default("PASS").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BatchTrace = typeof batchTrace.$inferSelect;
export type InsertBatchTrace = typeof batchTrace.$inferInsert;

// P25: Quality complaints table
export const qualityComplaints = mysqlTable("quality_complaints", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  batchNo: varchar("batchNo", { length: 50 }),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }),
  complaintType: mysqlEnum("complaintType", ["QUALITY", "SERVICE", "DELIVERY", "OTHER"]).notNull(),
  complaintContent: text("complaintContent").notNull(),
  complaintImages: text("complaintImages"),
  driverId: int("driverId"),
  driverName: varchar("driverName", { length: 255 }),
  salesRepId: int("salesRepId"),
  salesRepName: varchar("salesRepName", { length: 255 }),
  status: mysqlEnum("status", ["PENDING", "PROCESSING", "RESOLVED", "CLOSED"]).default("PENDING").notNull(),
  assignedTo: int("assignedTo"),
  assignedToName: varchar("assignedToName", { length: 255 }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QualityComplaint = typeof qualityComplaints.$inferSelect;
export type InsertQualityComplaint = typeof qualityComplaints.$inferInsert;

// P24: Commission rules v2 table
export const commissionRulesV2 = mysqlTable("commission_rules_v2", {
  id: int("id").autoincrement().primaryKey(),
  ruleName: varchar("ruleName", { length: 255 }).notNull(),
  ruleType: mysqlEnum("ruleType", ["SALES_AMOUNT", "PAYMENT_RATE", "BAD_DEBT_DEDUCTION"]).notNull(),
  ruleFormula: text("ruleFormula").notNull(),
  ruleParams: text("ruleParams"),
  effectiveFrom: date("effectiveFrom").notNull(),
  effectiveTo: date("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CommissionRuleV2 = typeof commissionRulesV2.$inferSelect;
export type InsertCommissionRuleV2 = typeof commissionRulesV2.$inferInsert;
