/**
 * 出差申请工作流服务 (Business Trip Pre-Approval Service)
 * Mega-Sprint 8 Epic 1
 *
 * 功能：
 * 1. 提交出差申请（触发审批工作流）
 * 2. 总监审批（APPROVED / REJECTED）
 * 3. 查询出差申请列表
 * 4. 报销强校验：TRAVEL 类型报销必须关联 APPROVED 状态的出差申请
 */
import { eq, desc, and, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  businessTrips,
  expenseClaims,
  expenseClaimsExtension,
  type InsertBusinessTrip,
  type InsertExpenseClaimExtension,
} from "../drizzle/schema";

// ============================================================
// 工具函数
// ============================================================
function generateTripNo(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `TRIP${ts}${rand}`;
}

// ============================================================
// 提交出差申请
// ============================================================
export async function submitBusinessTrip(params: {
  applicantId: number;
  applicantName: string;
  destination: string;
  visitedCustomers?: string; // JSON string of customer names/IDs
  plannedWork: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  estimatedAccommodation?: number;
  estimatedMeals?: number;
  estimatedTransport?: number;
  coTravelerId?: number;
  coTravelerName?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const tripNo = generateTripNo();
  const estimatedTotal =
    (params.estimatedAccommodation ?? 0) +
    (params.estimatedMeals ?? 0) +
    (params.estimatedTransport ?? 0);

  const insertData: InsertBusinessTrip = {
    tripNo,
    applicantId: params.applicantId,
    applicantName: params.applicantName,
    destination: params.destination,
    visitedCustomers: params.visitedCustomers,
    plannedWork: params.plannedWork,
    startDate: params.startDate as unknown as Date,
    endDate: params.endDate as unknown as Date,
    estimatedAccommodation: String(params.estimatedAccommodation ?? 0),
    estimatedMeals: String(params.estimatedMeals ?? 0),
    estimatedTransport: String(params.estimatedTransport ?? 0),
    estimatedTotal: String(estimatedTotal),
    coTravelerId: params.coTravelerId,
    coTravelerName: params.coTravelerName,
    status: "PENDING",
  };

  await db.insert(businessTrips).values(insertData);
  const [trip] = await db
    .select()
    .from(businessTrips)
    .where(eq(businessTrips.tripNo, tripNo))
    .limit(1);

  console.log(`[BusinessTrip] 出差申请提交: ${tripNo}, 申请人: ${params.applicantName}, 目的地: ${params.destination}, 预估费用: ¥${estimatedTotal}`);
  return trip;
}

// ============================================================
// 审批出差申请（总监审批）
// ============================================================
export async function reviewBusinessTrip(params: {
  tripId: number;
  approverId: number;
  approverName: string;
  approved: boolean;
  approvalRemark?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [existing] = await db
    .select()
    .from(businessTrips)
    .where(eq(businessTrips.id, params.tripId))
    .limit(1);

  if (!existing) throw new Error(`出差申请 #${params.tripId} 不存在`);
  if (existing.status !== "PENDING") {
    throw new Error(`出差申请 #${params.tripId} 状态为 ${existing.status}，无法再次审批`);
  }

  const newStatus = params.approved ? "APPROVED" : "REJECTED";
  await db
    .update(businessTrips)
    .set({
      status: newStatus,
      approverId: params.approverId,
      approverName: params.approverName,
      approvalRemark: params.approvalRemark,
      approvedAt: new Date(),
    })
    .where(eq(businessTrips.id, params.tripId));

  const [updated] = await db
    .select()
    .from(businessTrips)
    .where(eq(businessTrips.id, params.tripId))
    .limit(1);

  console.log(`[BusinessTrip] 审批完成: ${existing.tripNo}, 结果: ${newStatus}, 审批人: ${params.approverName}`);
  return updated;
}

// ============================================================
// 查询出差申请列表
// ============================================================
export async function listBusinessTrips(params?: {
  applicantId?: number;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const conditions = [];
  if (params?.applicantId) {
    conditions.push(eq(businessTrips.applicantId, params.applicantId));
  }
  if (params?.status) {
    conditions.push(eq(businessTrips.status, params.status));
  }

  const query = db
    .select()
    .from(businessTrips)
    .orderBy(desc(businessTrips.createdAt))
    .limit(params?.limit ?? 50);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

// ============================================================
// 报销强校验：TRAVEL 类型必须关联 APPROVED 的出差申请
// ============================================================
export async function validateTravelExpenseClaim(params: {
  expenseType: string;
  businessTripId?: number;
}): Promise<{ valid: boolean; error?: string; trip?: typeof businessTrips.$inferSelect }> {
  // 非差旅类型无需校验
  if (params.expenseType !== "TRAVEL") {
    return { valid: true };
  }

  // TRAVEL 类型必须提供 businessTripId
  if (!params.businessTripId) {
    return {
      valid: false,
      error: "差旅报销必须关联一个已审批通过的出差申请单（businessTripId 不能为空）",
    };
  }

  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [trip] = await db
    .select()
    .from(businessTrips)
    .where(eq(businessTrips.id, params.businessTripId))
    .limit(1);

  if (!trip) {
    return {
      valid: false,
      error: `出差申请 #${params.businessTripId} 不存在`,
    };
  }

  if (trip.status !== "APPROVED") {
    return {
      valid: false,
      error: `出差申请 #${params.businessTripId}（${trip.tripNo}）状态为 ${trip.status}，必须为 APPROVED 才能提交差旅报销`,
    };
  }

  return { valid: true, trip };
}

// ============================================================
// 提交带出差申请关联的报销单（带风控校验）
// ============================================================
export async function submitTravelExpenseClaim(params: {
  submittedBy: number;
  submittedByName: string;
  associatedCustomerId?: number;
  associatedCustomerName?: string;
  expenseType: "TRAVEL" | "ENTERTAINMENT" | "LOGISTICS_SUBSIDY" | "OTHER";
  amount: number;
  description: string;
  invoiceImageUrl?: string;
  invoiceImageKey?: string;
  expenseDate: string;
  businessTripId?: number; // TRAVEL 类型必填
}) {
  // 风控校验
  const validation = await validateTravelExpenseClaim({
    expenseType: params.expenseType,
    businessTripId: params.businessTripId,
  });

  if (!validation.valid) {
    const err = new Error(validation.error!) as Error & { code: string };
    err.code = "TRAVEL_EXPENSE_BLOCKED";
    throw err;
  }

  // 调用原有 submitExpenseClaim 逻辑
  const { submitExpenseClaim } = await import("./expense-service");
  const claim = await submitExpenseClaim({
    submittedBy: params.submittedBy,
    submittedByName: params.submittedByName,
    associatedCustomerId: params.associatedCustomerId,
    associatedCustomerName: params.associatedCustomerName,
    expenseType: params.expenseType,
    amount: params.amount,
    description: params.description,
    invoiceImageUrl: params.invoiceImageUrl,
    invoiceImageKey: params.invoiceImageKey,
    expenseDate: params.expenseDate,
  });

  // 创建扩展记录（关联出差申请）
  const db = await getDb();
  if (db && params.businessTripId && validation.trip) {
    const extData: InsertExpenseClaimExtension = {
      expenseClaimId: claim.id,
      businessTripId: params.businessTripId,
      businessTripNo: validation.trip.tripNo,
      isPaid: false,
    };
    await db.insert(expenseClaimsExtension).values(extData);
    console.log(`[BusinessTrip] 报销单 ${claim.claimNo} 已关联出差申请 ${validation.trip.tripNo}`);
  }

  return claim;
}

// ============================================================
// 财务审核通过（变更为 PAID 状态）
// ============================================================
export async function financeApproveClaim(params: {
  claimId: number;
  paidBy: number;
  paidByName: string;
  financeRemark?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const [existing] = await db
    .select()
    .from(expenseClaims)
    .where(eq(expenseClaims.id, params.claimId))
    .limit(1);

  if (!existing) throw new Error(`报销单 #${params.claimId} 不存在`);
  if (existing.status !== "APPROVED") {
    throw new Error(`报销单 #${params.claimId} 状态为 ${existing.status}，必须先通过部门审批才能财务打款`);
  }

  // 更新扩展表（标记为已打款）
  const [ext] = await db
    .select()
    .from(expenseClaimsExtension)
    .where(eq(expenseClaimsExtension.expenseClaimId, params.claimId))
    .limit(1);

  if (ext) {
    await db
      .update(expenseClaimsExtension)
      .set({
        isPaid: true,
        paidAt: new Date(),
        paidBy: params.paidBy,
        paidByName: params.paidByName,
        financeRemark: params.financeRemark,
      })
      .where(eq(expenseClaimsExtension.expenseClaimId, params.claimId));
  } else {
    // 如果没有扩展记录（非差旅类报销），创建一条
    await db.insert(expenseClaimsExtension).values({
      expenseClaimId: params.claimId,
      isPaid: true,
      paidAt: new Date(),
      paidBy: params.paidBy,
      paidByName: params.paidByName,
      financeRemark: params.financeRemark,
    });
  }

  console.log(`[Finance] 报销单 #${params.claimId}（${existing.claimNo}）已财务打款，金额: ¥${existing.amount}`);
  return {
    success: true,
    claimNo: existing.claimNo,
    amount: existing.amount,
    paidBy: params.paidByName,
    paidAt: new Date(),
  };
}

// ============================================================
// 查询报销单（含出差申请关联详情）
// ============================================================
export async function listExpenseClaimsWithTrip(params?: {
  status?: string;
  submittedBy?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const claims = await db
    .select()
    .from(expenseClaims)
    .orderBy(desc(expenseClaims.createdAt))
    .limit(params?.limit ?? 50);

  // 批量查询扩展信息
  const claimIds = claims.map((c) => c.id);
  let extensions: (typeof expenseClaimsExtension.$inferSelect)[] = [];
  if (claimIds.length > 0) {
    extensions = await db
      .select()
      .from(expenseClaimsExtension)
      .where(inArray(expenseClaimsExtension.expenseClaimId, claimIds));
  }

  const extMap = new Map(extensions.map((e) => [e.expenseClaimId, e]));

  // 批量查询出差申请
  const tripIds = extensions
    .filter((e) => e.businessTripId)
    .map((e) => e.businessTripId!);
  let trips: (typeof businessTrips.$inferSelect)[] = [];
  if (tripIds.length > 0) {
    trips = await db
      .select()
      .from(businessTrips)
      .where(inArray(businessTrips.id, tripIds));
  }
  const tripMap = new Map(trips.map((t) => [t.id, t]));

  return claims.map((claim) => {
    const ext = extMap.get(claim.id);
    const trip = ext?.businessTripId ? tripMap.get(ext.businessTripId) : undefined;
    return {
      ...claim,
      isPaid: ext?.isPaid ?? false,
      paidAt: ext?.paidAt,
      paidByName: ext?.paidByName,
      financeRemark: ext?.financeRemark,
      businessTrip: trip
        ? {
            id: trip.id,
            tripNo: trip.tripNo,
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            estimatedTotal: trip.estimatedTotal,
            status: trip.status,
          }
        : null,
    };
  });
}
