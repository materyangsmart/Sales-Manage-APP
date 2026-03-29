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
  role: mysqlEnum("role", ["user", "admin", "sales", "fulfillment", "finance", "auditor"]).default("user").notNull(),
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
  customerId: int("customer_id").notNull().unique(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  creditScore: int("credit_score").default(60).notNull(),
  creditLevel: mysqlEnum("credit_level", ["S", "A", "B", "C", "D"]).default("C").notNull(),
  totalOrders: int("total_orders").default(0).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  paymentRate: decimal("payment_rate", { precision: 5, scale: 2 }).default("0").notNull(),
  overdueCount: int("overdue_count").default(0).notNull(),
  maxOverdueDays: int("max_overdue_days").default(0).notNull(),
  lastOrderDate: date("last_order_date"),
  autoApproveEnabled: boolean("auto_approve_enabled").default(false).notNull(),
  autoApproveLimit: decimal("auto_approve_limit", { precision: 10, scale: 2 }).default("0").notNull(),
  lastCalculatedAt: timestamp("last_calculated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
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

// ============================================================
// RC4 V1.0 GA Tables
// ============================================================

// RC4 Epic 1: 库存表 (inventory)
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  totalStock: int("total_stock").default(0).notNull(),         // 物理库存 (Physical Stock)
  reservedStock: int("reserved_stock").default(0).notNull(),   // 预扣减锁定量
  availableStock: int("available_stock").default(0).notNull(), // = total - reserved
  pendingDelivery: int("pending_delivery").default(0).notNull(),   // 待交付量 (Pending Delivery)
  lockedCapacity: int("locked_capacity").default(0).notNull(),     // 锁定配额 (Locked Capacity) - 大客户预留
  dailyIdleCapacity: int("daily_idle_capacity").default(0).notNull(), // 剩余闲置产能 (Idle Capacity)
  lowStockThreshold: int("low_stock_threshold").default(10).notNull(),
  warehouseCode: varchar("warehouse_code", { length: 50 }).default("WH-001").notNull(),
  unit: varchar("unit", { length: 20 }).default("包").notNull(),
  lastRestockedAt: timestamp("last_restocked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

// RC4 Epic 1: 出入库流水表 (inventory_log)
export const inventoryLog = mysqlTable("inventory_log", {
  id: int("id").autoincrement().primaryKey(),
  inventoryId: int("inventory_id").notNull(),
  productId: int("product_id").notNull(),
  type: mysqlEnum("type", ["INBOUND", "OUTBOUND", "RESERVE", "RELEASE", "ADJUST"]).notNull(),
  quantity: int("quantity").notNull(), // 正数入库，负数出库
  beforeStock: int("before_stock").notNull(),
  afterStock: int("after_stock").notNull(),
  orderId: int("order_id"),
  batchNo: varchar("batch_no", { length: 50 }),
  operatorId: int("operator_id"),
  operatorName: varchar("operator_name", { length: 255 }),
  remark: text("remark"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type InventoryLogEntry = typeof inventoryLog.$inferSelect;
export type InsertInventoryLog = typeof inventoryLog.$inferInsert;

// RC4 Epic 2: 月结对账单 (billing_statements)
export const billingStatements = mysqlTable("billing_statements", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  period: varchar("period", { length: 7 }).notNull(), // YYYY-MM
  totalOrders: int("total_orders").default(0).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  outstandingAmount: decimal("outstanding_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  dueDate: date("due_date").notNull(),
  status: mysqlEnum("status", ["GENERATED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"]).default("GENERATED").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BillingStatement = typeof billingStatements.$inferSelect;
export type InsertBillingStatement = typeof billingStatements.$inferInsert;

// RC4 Epic 2: 信用超限特批记录 (credit_override_approvals)
export const creditOverrideApprovals = mysqlTable("credit_override_approvals", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id"),
  customerId: int("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  orderAmount: decimal("order_amount", { precision: 15, scale: 2 }).notNull(),
  currentUsedCredit: decimal("current_used_credit", { precision: 15, scale: 2 }).notNull(),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).notNull(),
  exceededAmount: decimal("exceeded_amount", { precision: 15, scale: 2 }).notNull(),
  requestedBy: int("requested_by"),
  requestedByName: varchar("requested_by_name", { length: 255 }),
  approvedBy: int("approved_by"),
  approvedByName: varchar("approved_by_name", { length: 255 }),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED"]).default("PENDING").notNull(),
  reason: text("reason"),
  approvalRemark: text("approval_remark"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CreditOverrideApproval = typeof creditOverrideApprovals.$inferSelect;
export type InsertCreditOverrideApproval = typeof creditOverrideApprovals.$inferInsert;

// ============================================================
// Mega-Sprint 7 新增表
// ============================================================

// MS7 Epic 2: 售后工单表 (after_sales_tickets)
export const afterSalesTickets = mysqlTable("after_sales_tickets", {
  id: int("id").autoincrement().primaryKey(),
  ticketNo: varchar("ticket_no", { length: 50 }).notNull().unique(),
  orderId: int("order_id").notNull(),
  orderNo: varchar("order_no", { length: 50 }).notNull(),
  customerId: int("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  reportedBy: int("reported_by"),
  reportedByName: varchar("reported_by_name", { length: 255 }),
  issueType: mysqlEnum("issue_type", ["DAMAGE", "QUALITY", "SHORT_DELIVERY", "WRONG_ITEM", "OTHER"]).notNull(),
  description: text("description").notNull(),
  evidenceImages: text("evidence_images"),
  claimAmount: decimal("claim_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  status: mysqlEnum("status", ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "REPLACEMENT_ISSUED"]).default("PENDING").notNull(),
  reviewedBy: int("reviewed_by"),
  reviewedByName: varchar("reviewed_by_name", { length: 255 }),
  reviewRemark: text("review_remark"),
  reviewedAt: timestamp("reviewed_at"),
  replacementOrderId: int("replacement_order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AfterSalesTicket = typeof afterSalesTickets.$inferSelect;
export type InsertAfterSalesTicket = typeof afterSalesTickets.$inferInsert;

// MS7 Epic 2: 补发订单表 (replacement_orders)
export const replacementOrders = mysqlTable("replacement_orders", {
  id: int("id").autoincrement().primaryKey(),
  replacementNo: varchar("replacement_no", { length: 50 }).notNull().unique(),
  originalOrderId: int("original_order_id").notNull(),
  originalOrderNo: varchar("original_order_no", { length: 50 }).notNull(),
  afterSalesTicketId: int("after_sales_ticket_id").notNull(),
  customerId: int("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  productId: int("product_id").notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  isCountedInRevenue: boolean("is_counted_in_revenue").default(false).notNull(),
  isCountedInAR: boolean("is_counted_in_ar").default(false).notNull(),
  status: mysqlEnum("status", ["PENDING", "SHIPPED", "COMPLETED"]).default("PENDING").notNull(),
  shippedAt: timestamp("shipped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ReplacementOrder = typeof replacementOrders.$inferSelect;
export type InsertReplacementOrder = typeof replacementOrders.$inferInsert;

// MS7 Epic 3: 费用报销单表 (expense_claims)
export const expenseClaims = mysqlTable("expense_claims", {
  id: int("id").autoincrement().primaryKey(),
  claimNo: varchar("claim_no", { length: 50 }).notNull().unique(),
  submittedBy: int("submitted_by").notNull(),
  submittedByName: varchar("submitted_by_name", { length: 255 }).notNull(),
  associatedCustomerId: int("associated_customer_id"),
  associatedCustomerName: varchar("associated_customer_name", { length: 255 }),
  expenseType: mysqlEnum("expense_type", ["TRAVEL", "ENTERTAINMENT", "LOGISTICS_SUBSIDY", "OTHER"]).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  description: text("description").notNull(),
  invoiceImageUrl: varchar("invoice_image_url", { length: 1024 }),
  invoiceImageKey: varchar("invoice_image_key", { length: 512 }),
  expenseDate: date("expense_date").notNull(),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED"]).default("PENDING").notNull(),
  approvedBy: int("approved_by"),
  approvedByName: varchar("approved_by_name", { length: 255 }),
  approvalRemark: text("approval_remark"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ExpenseClaim = typeof expenseClaims.$inferSelect;
export type InsertExpenseClaim = typeof expenseClaims.$inferInsert;

// MS7 Epic 4: 月度销售目标表 (sales_targets)
export const salesTargets = mysqlTable("sales_targets", {
  id: int("id").autoincrement().primaryKey(),
  salesRepId: int("sales_rep_id").notNull(),
  salesRepName: varchar("sales_rep_name", { length: 255 }).notNull(),
  regionName: varchar("region_name", { length: 100 }),
  period: varchar("period", { length: 7 }).notNull(),
  revenueTarget: decimal("revenue_target", { precision: 15, scale: 2 }).notNull(),
  collectionTarget: decimal("collection_target", { precision: 15, scale: 2 }).notNull(),
  newCustomerTarget: int("new_customer_target").notNull(),
  revenueActual: decimal("revenue_actual", { precision: 15, scale: 2 }).default("0"),
  collectionActual: decimal("collection_actual", { precision: 15, scale: 2 }).default("0"),
  newCustomerActual: int("new_customer_actual").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SalesTarget = typeof salesTargets.$inferSelect;
export type InsertSalesTarget = typeof salesTargets.$inferInsert;

// ============================================================
// Mega-Sprint 8 新增表与字段扩展
// ============================================================

// MS8 Epic 1: 出差申请表 (business_trips)
export const businessTrips = mysqlTable("business_trips", {
  id: int("id").autoincrement().primaryKey(),
  tripNo: varchar("trip_no", { length: 50 }).notNull().unique(),
  applicantId: int("applicant_id").notNull(),
  applicantName: varchar("applicant_name", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 500 }).notNull(),
  visitedCustomers: text("visited_customers"), // JSON array of customer IDs
  plannedWork: text("planned_work").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  estimatedAccommodation: decimal("estimated_accommodation", { precision: 15, scale: 2 }).default("0").notNull(),
  estimatedMeals: decimal("estimated_meals", { precision: 15, scale: 2 }).default("0").notNull(),
  estimatedTransport: decimal("estimated_transport", { precision: 15, scale: 2 }).default("0").notNull(),
  estimatedTotal: decimal("estimated_total", { precision: 15, scale: 2 }).default("0").notNull(),
  coTravelerId: int("co_traveler_id"), // 同行人 ID，用于财务核对避免重复报销酒店
  coTravelerName: varchar("co_traveler_name", { length: 255 }),
  status: mysqlEnum("status", ["PENDING", "APPROVED", "REJECTED", "COMPLETED"]).default("PENDING").notNull(),
  approverId: int("approver_id"),
  approverName: varchar("approver_name", { length: 255 }),
  approvalRemark: text("approval_remark"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type BusinessTrip = typeof businessTrips.$inferSelect;
export type InsertBusinessTrip = typeof businessTrips.$inferInsert;

// MS8 Epic 1: 扩展 expense_claims 表（新增 business_trip_id 强关联 + PAID 状态）
// 注意：由于 Drizzle 不支持 ALTER TABLE 修改 enum，我们创建一个新的扩展记录表
// 实际上通过 SQL 直接添加字段到 expense_claims 表
export const expenseClaimsExtension = mysqlTable("expense_claims_extension", {
  id: int("id").autoincrement().primaryKey(),
  expenseClaimId: int("expense_claim_id").notNull().unique(), // 1:1 关联 expense_claims
  businessTripId: int("business_trip_id"), // 关联出差申请（TRAVEL 类型必填）
  businessTripNo: varchar("business_trip_no", { length: 50 }),
  paidAt: timestamp("paid_at"), // 财务打款时间
  paidBy: int("paid_by"), // 财务审核人 ID
  paidByName: varchar("paid_by_name", { length: 255 }),
  financeRemark: text("finance_remark"),
  isPaid: boolean("is_paid").default(false).notNull(), // 是否已打款
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ExpenseClaimExtension = typeof expenseClaimsExtension.$inferSelect;
export type InsertExpenseClaimExtension = typeof expenseClaimsExtension.$inferInsert;

// MS8 Epic 3: 客户管理成本费率扩展表 (customer_cost_config)
export const customerCostConfig = mysqlTable("customer_cost_config", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id").notNull().unique(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  managementCostRate: decimal("management_cost_rate", { precision: 5, scale: 4 }).default("0.0100").notNull(), // 默认 1%，商超 5%
  overdueInterestRate: decimal("overdue_interest_rate", { precision: 5, scale: 4 }).default("0.0600").notNull(), // 年化 6%
  customerType: mysqlEnum("customer_type", ["WET_MARKET", "WHOLESALE_B", "SUPERMARKET", "ECOMMERCE", "OTHER"]).default("OTHER").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CustomerCostConfig = typeof customerCostConfig.$inferSelect;
export type InsertCustomerCostConfig = typeof customerCostConfig.$inferInsert;

// ============================================================
// MS9 Epic 1: BOM/MRP 物料需求引擎
// ============================================================

// 原材料主档 (materials)
export const materials = mysqlTable("materials", {
  id: int("id").autoincrement().primaryKey(),
  materialCode: varchar("material_code", { length: 64 }).notNull().unique(),
  materialName: varchar("material_name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  stockQty: decimal("stock_qty", { precision: 12, scale: 3 }).default("0.000").notNull(),
  safetyStock: decimal("safety_stock", { precision: 12, scale: 3 }).default("0.000").notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }).default("0.0000").notNull(),
  supplierId: int("supplier_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Material = typeof materials.$inferSelect;
export type InsertMaterial = typeof materials.$inferInsert;

// 物料清单 (bom_items)
export const bomItems = mysqlTable("bom_items", {
  id: int("id").autoincrement().primaryKey(),
  productCode: varchar("product_code", { length: 64 }).notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  materialId: int("material_id").notNull(),
  materialName: varchar("material_name", { length: 255 }).notNull(),
  qtyPerUnit: decimal("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  wasteRate: decimal("waste_rate", { precision: 5, scale: 4 }).default("0.0000").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type BomItem = typeof bomItems.$inferSelect;
export type InsertBomItem = typeof bomItems.$inferInsert;

// 采购订单 (purchase_orders)
export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  poNo: varchar("po_no", { length: 64 }).notNull().unique(),
  supplierId: int("supplier_id"),
  supplierName: varchar("supplier_name", { length: 255 }),
  materialId: int("material_id").notNull(),
  materialName: varchar("material_name", { length: 255 }).notNull(),
  requiredQty: decimal("required_qty", { precision: 12, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }).default("0.0000").notNull(),
  totalAmount: decimal("total_amount", { precision: 14, scale: 2 }).default("0.00").notNull(),
  status: mysqlEnum("status", ["DRAFT", "SUBMITTED", "APPROVED", "RECEIVED", "CANCELLED"]).default("DRAFT").notNull(),
  triggerSource: varchar("trigger_source", { length: 255 }),
  expectedDelivery: date("expected_delivery"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

// ============================================================
// MS9 Epic 2: SRM 供应商闭环与客诉穿透
// ============================================================

// 供应商主档 (suppliers)
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  supplierCode: varchar("supplier_code", { length: 64 }).notNull().unique(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  contactPerson: varchar("contact_person", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  qualityRating: decimal("quality_rating", { precision: 3, scale: 1 }).default("5.0"),
  status: mysqlEnum("status", ["ACTIVE", "SUSPENDED", "BLACKLISTED"]).default("ACTIVE").notNull(),
  totalPenaltyAmount: decimal("total_penalty_amount", { precision: 14, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// 原料入库批次 (material_receipts)
export const materialReceipts = mysqlTable("material_receipts", {
  id: int("id").autoincrement().primaryKey(),
  receiptNo: varchar("receipt_no", { length: 64 }).notNull().unique(),
  supplierId: int("supplier_id").notNull(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  materialId: int("material_id").notNull(),
  materialName: varchar("material_name", { length: 255 }).notNull(),
  batchNo: varchar("batch_no", { length: 128 }).notNull(),
  productionDate: date("production_date"),
  expiryDate: date("expiry_date"),
  receivedQty: decimal("received_qty", { precision: 12, scale: 3 }).notNull(),
  unit: varchar("unit", { length: 32 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }).notNull(),
  qualityStatus: mysqlEnum("quality_status", ["PASS", "PENDING", "REJECTED"]).default("PENDING").notNull(),
  inspectionNotes: text("inspection_notes"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MaterialReceipt = typeof materialReceipts.$inferSelect;
export type InsertMaterialReceipt = typeof materialReceipts.$inferInsert;

// 供应商扣款单 (supplier_penalties)
export const supplierPenalties = mysqlTable("supplier_penalties", {
  id: int("id").autoincrement().primaryKey(),
  penaltyNo: varchar("penalty_no", { length: 64 }).notNull().unique(),
  supplierId: int("supplier_id").notNull(),
  supplierName: varchar("supplier_name", { length: 255 }).notNull(),
  materialReceiptId: int("material_receipt_id").notNull(),
  afterSalesTicketId: int("after_sales_ticket_id").notNull(),
  batchNo: varchar("batch_no", { length: 128 }).notNull(),
  penaltyReason: text("penalty_reason").notNull(),
  penaltyAmount: decimal("penalty_amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["DRAFT", "CONFIRMED", "PAID", "DISPUTED"]).default("DRAFT").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SupplierPenalty = typeof supplierPenalties.$inferSelect;
export type InsertSupplierPenalty = typeof supplierPenalties.$inferInsert;

// ============================================================
// Mega-Sprint 10 新增表 (GTM 增长引擎)
// ============================================================

// MS10 Epic 2: 推荐裂变记录表 (referral_records)
export const referralRecords = mysqlTable("referral_records", {
  id: int("id").autoincrement().primaryKey(),
  referrerId: int("referrer_id").notNull(),
  referrerName: varchar("referrer_name", { length: 255 }).notNull(),
  refereeId: int("referee_id").notNull(),
  refereeName: varchar("referee_name", { length: 255 }).notNull(),
  referralCode: varchar("referral_code", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["PENDING", "REWARDED", "EXPIRED"]).default("PENDING").notNull(),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("50.00").notNull(),
  firstOrderId: int("first_order_id"),
  rewardedAt: timestamp("rewarded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ReferralRecord = typeof referralRecords.$inferSelect;
export type InsertReferralRecord = typeof referralRecords.$inferInsert;

// MS10 Epic 2+3: 客户档案扩展表 (customer_profiles)
export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  salesId: int("sales_id"),
  salesName: varchar("sales_name", { length: 255 }),
  regionDirectorId: int("region_director_id"),
  regionDirectorName: varchar("region_director_name", { length: 255 }),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).default("0").notNull(),
  creditUsed: decimal("credit_used", { precision: 15, scale: 2 }).default("0").notNull(),
  lastOrderAt: timestamp("last_order_at"),
  avgRepurchaseDays: decimal("avg_repurchase_days", { precision: 6, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = typeof customerProfiles.$inferInsert;

// MS10 Epic 3: 流失预警记录表 (churn_alerts)
export const churnAlerts = mysqlTable("churn_alerts", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  salesId: int("sales_id"),
  salesName: varchar("sales_name", { length: 255 }),
  regionDirectorId: int("region_director_id"),
  daysSinceLastOrder: decimal("days_since_last_order", { precision: 6, scale: 1 }).notNull(),
  avgRepurchaseDays: decimal("avg_repurchase_days", { precision: 6, scale: 2 }).notNull(),
  thresholdDays: decimal("threshold_days", { precision: 6, scale: 2 }).notNull(),
  riskLevel: mysqlEnum("risk_level", ["HIGH", "MEDIUM", "LOW"]).default("HIGH").notNull(),
  notificationSent: boolean("notification_sent").default(false).notNull(),
  notificationContent: text("notification_content"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ChurnAlert = typeof churnAlerts.$inferSelect;
export type InsertChurnAlert = typeof churnAlerts.$inferInsert;

// MS10 Epic 1: 订单来源补贴记录表 (order_discounts)
export const orderDiscounts = mysqlTable("order_discounts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  discountType: varchar("discount_type", { length: 64 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  discountReason: varchar("discount_reason", { length: 255 }).notNull(),
  orderSource: varchar("order_source", { length: 50 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrderDiscount = typeof orderDiscounts.$inferSelect;
export type InsertOrderDiscount = typeof orderDiscounts.$inferInsert;

// MS10 Epic 1: 订单主表扩展 (order_source_log) - 记录订单来源和提成乘数
export const orderSourceLog = mysqlTable("order_source_log", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull().unique(),
  orderNo: varchar("order_no", { length: 64 }).notNull(),
  source: mysqlEnum("source", ["WECHAT_H5", "PORTAL", "SALES_PORTAL", "WEBSITE", "MANUAL"]).default("WEBSITE").notNull(),
  commissionMultiplier: decimal("commission_multiplier", { precision: 4, scale: 2 }).default("1.00").notNull(),
  discountApplied: boolean("discount_applied").default(false).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  salesId: int("sales_id"),
  customerId: int("customer_id"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  grossProfit: decimal("gross_profit", { precision: 15, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrderSourceLog = typeof orderSourceLog.$inferSelect;
export type InsertOrderSourceLog = typeof orderSourceLog.$inferInsert;

// ============================================================
// MS11 Epic 1: 反作弊引擎表
// ============================================================

// 设备/IP 指纹记录表 (order_fingerprints)
export const orderFingerprints = mysqlTable("order_fingerprints", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull().unique(),
  orderNo: varchar("order_no", { length: 64 }).notNull(),
  source: varchar("source", { length: 50 }).notNull(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull(),
  userAgent: varchar("user_agent", { length: 512 }),
  deviceId: varchar("device_id", { length: 255 }),
  salesId: int("sales_id"),
  customerId: int("customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type OrderFingerprint = typeof orderFingerprints.$inferSelect;
export type InsertOrderFingerprint = typeof orderFingerprints.$inferInsert;

// 销售员登录 IP 记录表 (sales_login_ips)
export const salesLoginIps = mysqlTable("sales_login_ips", {
  id: int("id").autoincrement().primaryKey(),
  salesId: int("sales_id").notNull(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull(),
  loginAt: timestamp("login_at").defaultNow().notNull(),
});
export type SalesLoginIp = typeof salesLoginIps.$inferSelect;
export type InsertSalesLoginIp = typeof salesLoginIps.$inferInsert;

// 作弊告警记录表 (fraud_alerts)
export const fraudAlerts = mysqlTable("fraud_alerts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("order_id").notNull(),
  orderNo: varchar("order_no", { length: 64 }).notNull(),
  fraudType: mysqlEnum("fraud_type", ["IP_OVERLAP", "IP_BURST", "DEVICE_OVERLAP"]).notNull(),
  fraudDetail: text("fraud_detail").notNull(),
  originalMultiplier: decimal("original_multiplier", { precision: 4, scale: 2 }).notNull(),
  penaltyMultiplier: decimal("penalty_multiplier", { precision: 4, scale: 2 }).default("0.50").notNull(),
  discountRevoked: boolean("discount_revoked").default(true).notNull(),
  salesId: int("sales_id"),
  customerId: int("customer_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FraudAlert = typeof fraudAlerts.$inferSelect;
export type InsertFraudAlert = typeof fraudAlerts.$inferInsert;

// ============================================================
// MS11 Epic 2: ROI 里程碑裂变奖励表
// ============================================================

// 被推荐人累计付款追踪表 (referee_payment_milestones)
export const refereePaymentMilestones = mysqlTable("referee_payment_milestones", {
  id: int("id").autoincrement().primaryKey(),
  refereeId: int("referee_id").notNull().unique(),
  refereeName: varchar("referee_name", { length: 255 }).notNull(),
  referrerId: int("referrer_id").notNull(),
  totalPaidAmount: decimal("total_paid_amount", { precision: 15, scale: 2 }).default("0").notNull(),
  milestoneReached: boolean("milestone_reached").default(false).notNull(),
  milestoneAmount: decimal("milestone_amount", { precision: 10, scale: 2 }).default("500.00").notNull(),
  rewardTriggeredAt: timestamp("reward_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type RefereePaymentMilestone = typeof refereePaymentMilestones.$inferSelect;
export type InsertRefereePaymentMilestone = typeof refereePaymentMilestones.$inferInsert;

// ============================================================
// MS11 Epic 3: 流失挽回弹药库表
// ============================================================

// 挽回券表 (winback_coupons)
export const winbackCoupons = mysqlTable("winback_coupons", {
  id: int("id").autoincrement().primaryKey(),
  churnAlertId: int("churn_alert_id").notNull(),
  customerId: int("customer_id").notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  salesId: int("sales_id").notNull(),
  couponCode: varchar("coupon_code", { length: 64 }).notNull().unique(),
  discountRate: decimal("discount_rate", { precision: 4, scale: 2 }).default("0.85").notNull(),
  status: mysqlEnum("status", ["ACTIVE", "USED", "EXPIRED"]).default("ACTIVE").notNull(),
  usedOrderId: int("used_order_id"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WinbackCoupon = typeof winbackCoupons.$inferSelect;
export type InsertWinbackCoupon = typeof winbackCoupons.$inferInsert;
