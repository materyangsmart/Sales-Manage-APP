import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, boolean, uniqueIndex } from "drizzle-orm/mysql-core";

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
  /** IM 平台唯一标识（企业微信 unionid / 钉钉 unionid） */
  imUnionid: varchar("im_unionid", { length: 128 }),
  /** IM 平台类型：WECOM（企业微信）或 DINGTALK（钉钉） */
  imProvider: mysqlEnum("im_provider", ["WECOM", "DINGTALK"]),
}, (table) => ({
  imUnionidIdx: uniqueIndex("idx_users_im_unionid").on(table.imUnionid),
}));

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
  batchNo: varchar("batch_no", { length: 50 }).notNull().unique(),
  productionDate: date("production_date").notNull(),
  soybeanBatch: varchar("soybean_batch", { length: 50 }).notNull(),
  soybeanSupplier: varchar("soybean_supplier", { length: 255 }).notNull(),
  soybeanWeight: decimal("soybean_weight", { precision: 10, scale: 2 }).notNull(),
  waterQualityReport: varchar("water_quality_report", { length: 255 }),
  productOutput: decimal("product_output", { precision: 10, scale: 2 }).notNull(),
  yieldRate: decimal("yield_rate", { precision: 5, scale: 2 }).notNull(),
  workshopTemp: decimal("workshop_temp", { precision: 5, scale: 2 }),
  sterilizationParams: varchar("sterilization_params", { length: 255 }),
  inspectorId: int("inspector_id").notNull(),
  inspectorName: varchar("inspector_name", { length: 255 }).notNull(),
  qualityStatus: mysqlEnum("quality_status", ["PASS", "FAIL"]).default("PASS").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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

// RC1 Epic 1: 月度提成明细表 (sales_commissions)
export const salesCommissions = mysqlTable("sales_commissions", {
  id: int("id").autoincrement().primaryKey(),
  salesId: int("salesId").notNull(),
  salesName: varchar("salesName", { length: 255 }).notNull(),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM 格式
  grossProfit: decimal("grossProfit", { precision: 15, scale: 2 }).notNull().default("0"),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).notNull().default("0"), // 0.0800 = 8%
  commissionAmount: decimal("commissionAmount", { precision: 15, scale: 2 }).notNull().default("0"),
  ruleId: int("ruleId"), // 关联 commission_rules_v2.id
  status: mysqlEnum("status", ["PENDING", "CONFIRMED", "PAID"]).default("PENDING").notNull(),
  settledAt: timestamp("settledAt"),
  settledBy: int("settledBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SalesCommission = typeof salesCommissions.$inferSelect;
export type InsertSalesCommission = typeof salesCommissions.$inferInsert;

// RC1 Epic 1: 打款凭证表 (payment_receipts)
export const paymentReceipts = mysqlTable("payment_receipts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paidAt: timestamp("paidAt").notNull(),
  receiptUrl: varchar("receiptUrl", { length: 1024 }), // 凭证图片/PDF URL
  remark: text("remark"),
  submittedBy: int("submittedBy").notNull(),
  submittedByName: varchar("submittedByName", { length: 255 }).notNull(),
  verifiedBy: int("verifiedBy"),
  verifiedByName: varchar("verifiedByName", { length: 255 }),
  verifiedAt: timestamp("verifiedAt"),
  status: mysqlEnum("status", ["PENDING", "VERIFIED", "REJECTED"]).default("PENDING").notNull(),
  rejectReason: text("rejectReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PaymentReceipt = typeof paymentReceipts.$inferSelect;
export type InsertPaymentReceipt = typeof paymentReceipts.$inferInsert;

// RC3 Epic 1: 意向线索表 (leads) - Open API 网关
 export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 100 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 20 }).notNull(),
  contactEmail: varchar("contact_email", { length: 320 }),
  businessType: mysqlEnum("business_type", ["WET_MARKET", "SUPERMARKET", "WHOLESALE", "ECOMMERCE", "RESTAURANT", "OTHER"]).default("OTHER").notNull(),
  estimatedMonthlyVolume: varchar("estimated_monthly_volume", { length: 50 }),
  region: varchar("region", { length: 100 }),
  message: text("message"),
  source: varchar("source", { length: 50 }).default("WEBSITE").notNull(),
  status: mysqlEnum("status", ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"]).default("NEW").notNull(),
  assignedTo: int("assigned_to"),
  assignedToName: varchar("assigned_to_name", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// RC3 Epic 1: 商品目录表 (product_catalog) - Open API 商品查询
export const productCatalog = mysqlTable("product_catalog", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["THIN", "MEDIUM", "THICK"]).notNull(),
  specification: varchar("specification", { length: 100 }).notNull(), // e.g. "160g", "500g", "5000g"
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 20 }).default("包").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 1024 }),
  isActive: boolean("is_active").default(true).notNull(),
  minOrderQuantity: int("min_order_quantity").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ProductCatalog = typeof productCatalog.$inferSelect;
export type InsertProductCatalog = typeof productCatalog.$inferInsert;
