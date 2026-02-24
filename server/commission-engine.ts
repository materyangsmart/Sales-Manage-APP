/**
 * Commission Calculation Engine
 * 
 * 实现PPT中定义的分层提成公式
 */

import { ordersAPI, invoicesAPI, paymentsAPI, customersAPI } from "./backend-api";

export interface CommissionInput {
  orgId: number;
  startDate: string; // ISO 8601
  endDate: string;
  ruleVersion: string;
  customerCategory?: 'WET_MARKET' | 'WHOLESALE_B' | 'SUPERMARKET' | 'ECOMMERCE' | 'DEFAULT';
}

export interface CommissionRule {
  ruleVersion: string;
  category: string;
  baseRate: number;
  newCustomerBonus: number;
  ruleJson: {
    collectionWeight?: number; // 回款权重（地推型/批发型）
    marginWeight?: number; // 毛利权重（商超型）
    paymentDueDays?: number; // 账期天数
    newCustomerBonus?: number; // 新客户奖励基数
  };
}

export interface KpiStats {
  totalShippedAmount: number; // 发货总额（分）
  fulfilledOrderCount: number; // 已履行订单数
  newCustomerCount: number; // 新增客户数
  totalMargin: number; // 毛利总额（分）
  validPaymentAmount: number; // 账期内收款额（分）
  overduePaymentAmount: number; // 超账期收款额（分）
  validOrderCount: number; // 账期内回款的订单数
  overdueOrderCount: number; // 超账期回款的订单数
}

export interface CommissionBreakdown {
  baseCommission: number; // 基础提成（分）
  marginCommission: number; // 毛利提成（分）
  collectionCommission: number; // 回款提成（分）
  newCustomerCommission: number; // 新客户奖励（分）
  totalCommission: number; // 总提成（分）
}

export interface CommissionResult {
  success: boolean;
  data: {
    period: {
      startDate: string;
      endDate: string;
    };
    kpi: KpiStats;
    commission: CommissionBreakdown;
    ruleVersion: string;
    category: string;
    rule: CommissionRule;
  };
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 核心提成计算引擎
 */
export async function calculateCommission(
  input: CommissionInput,
  rule: CommissionRule
): Promise<CommissionResult> {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  
  // 步骤1：获取期间内已履行的订单
  const fulfilledOrdersResponse = await ordersAPI.list({
    orgId: input.orgId,
    status: 'FULFILLED', // Backend使用大写枚举值
    page: 1,
    pageSize: 10000,
  });
  
  // 检查响应格式
  const ordersData = fulfilledOrdersResponse.items || fulfilledOrdersResponse.data || [];
  
  // 过滤期间内的订单
  const ordersInPeriod = ordersData.filter((order: any) => {
    if (!order.fulfilledAt) return false;
    
    const fulfilledAt = new Date(order.fulfilledAt);
    const inPeriod = fulfilledAt >= startDate && fulfilledAt <= endDate;
    
    // 如果指定了客户类型且不是"全部类型"，只统计该类型的订单
    if (input.customerCategory && input.customerCategory !== 'DEFAULT' && order.customer?.category !== input.customerCategory) {
      return false;
    }
    
    return inPeriod;
  });
  
  console.log(`[Commission Engine] Found ${ordersInPeriod.length} fulfilled orders in period`);
  
  // 步骤2：获取所有发票（用于获取毛利数据）
  const invoicesResponse = await invoicesAPI.list({
    orgId: input.orgId,
    page: 1,
    pageSize: 10000,
  });
  
  // 建立orderId -> invoice的映射
  const orderInvoiceMap = new Map<number, any>();
  invoicesResponse.items.forEach((invoice: any) => {
    if (invoice.orderId) {
      orderInvoiceMap.set(invoice.orderId, invoice);
    }
  });
  
  // 步骤3：获取所有收款记录
  const paymentsResponse = await paymentsAPI.list({
    orgId: input.orgId,
    page: 1,
    pageSize: 10000,
  });
  
  // 建立customerId -> payments的映射
  const customerPaymentsMap = new Map<number, any[]>();
  paymentsResponse.items.forEach((payment: any) => {
    if (payment.customerId) {
      if (!customerPaymentsMap.has(payment.customerId)) {
        customerPaymentsMap.set(payment.customerId, []);
      }
      customerPaymentsMap.get(payment.customerId)!.push(payment);
    }
  });
  
  // 步骤4：计算KPI指标
  let totalShippedAmount = 0;
  let totalMargin = 0;
  let validPaymentAmount = 0;
  let overduePaymentAmount = 0;
  let validOrderCount = 0;
  let overdueOrderCount = 0;
  
  const paymentDueDays = rule.ruleJson.paymentDueDays || 30;
  
  ordersInPeriod.forEach((order: any) => {
    const orderAmount = parseFloat(order.totalAmount || '0');
    totalShippedAmount += orderAmount;
    
    // 获取订单的发票（用于毛利数据）
    const invoice = orderInvoiceMap.get(order.id);
    if (invoice && invoice.grossMargin) {
      totalMargin += parseFloat(invoice.grossMargin);
    }
    
    // 检查该订单的回款情况
    const customerPayments = customerPaymentsMap.get(order.customerId) || [];
    const fulfilledAt = new Date(order.fulfilledAt);
    
    // 查找该订单对应的收款记录（通过金额匹配或时间匹配）
    let orderPayment = null;
    let minDaysDiff = Infinity;
    
    for (const payment of customerPayments) {
      if (payment.status === 'APPLIED' && payment.paymentDate) {
        const paymentDate = new Date(payment.paymentDate);
        const daysDiff = daysBetween(fulfilledAt, paymentDate);
        
        // 选择时间最接近的收款记录
        if (daysDiff < minDaysDiff) {
          minDaysDiff = daysDiff;
          orderPayment = payment;
        }
      }
    }
    
    if (orderPayment) {
      const paymentAmount = parseFloat(orderPayment.amount || '0');
      
      if (minDaysDiff <= paymentDueDays) {
        // 账期内回款
        validPaymentAmount += paymentAmount;
        validOrderCount++;
        console.log(`[Commission Engine] Order ${order.orderNo}: paid in ${minDaysDiff} days (within ${paymentDueDays} days) ✓`);
      } else {
        // 超账期回款
        overduePaymentAmount += paymentAmount;
        overdueOrderCount++;
        console.log(`[Commission Engine] Order ${order.orderNo}: paid in ${minDaysDiff} days (overdue by ${minDaysDiff - paymentDueDays} days) ✗`);
      }
    } else {
      console.log(`[Commission Engine] Order ${order.orderNo}: no payment found`);
    }
  });
  
  // 步骤5：获取新增客户数（优雅降级）
  let newCustomerCount = 0;
  try {
    const newCustomersResponse = await customersAPI.list({
      orgId: input.orgId,
      createdAfter: input.startDate,
      page: 1,
      pageSize: 10000,
    });
    
    newCustomerCount = newCustomersResponse.data.filter((customer: any) => {
      const createdAt = new Date(customer.createdAt);
      const inPeriod = createdAt >= startDate && createdAt <= endDate;
      
      // 如果指定了客户类型且不是"全部类型"，只统计该类型的客户
      if (input.customerCategory && input.customerCategory !== 'DEFAULT' && customer.category !== input.customerCategory) {
        return false;
      }
      
      return inPeriod;
    }).length;
    
    console.log(`[Commission Engine] Found ${newCustomerCount} new customers in period`);
  } catch (error) {
    console.warn(`[Commission Engine] Failed to fetch new customers (API not available), defaulting to 0`);
    console.warn(`[Commission Engine] Error:`, error instanceof Error ? error.message : String(error));
    newCustomerCount = 0;
  }
  
  // 步骤6：根据客户类型应用不同的计算公式
  let baseCommission = 0;
  let marginCommission = 0;
  let collectionCommission = 0;
  let newCustomerCommission = 0;
  
  const category = rule.category;
  
  switch (category) {
    case 'WET_MARKET':
    case 'WHOLESALE_B':
      // 地推型/批发型：严格执行账期扣减
      // 只有账期内回款的订单才计入提成基数
      baseCommission = validPaymentAmount * rule.baseRate;
      collectionCommission = validPaymentAmount * (rule.ruleJson.collectionWeight || 0);
      newCustomerCommission = newCustomerCount * rule.newCustomerBonus;
      
      console.log(`[Commission Engine] ${category}: baseCommission = ${validPaymentAmount} * ${rule.baseRate} = ${baseCommission}`);
      console.log(`[Commission Engine] ${category}: collectionCommission = ${validPaymentAmount} * ${rule.ruleJson.collectionWeight} = ${collectionCommission}`);
      break;
      
    case 'SUPERMARKET':
      // 商超型：毛利加权提成
      // 底薪60% + 毛利权重
      baseCommission = totalShippedAmount * rule.baseRate * 0.6;
      marginCommission = totalMargin * (rule.ruleJson.marginWeight || 0);
      newCustomerCommission = newCustomerCount * rule.newCustomerBonus;
      
      console.log(`[Commission Engine] ${category}: baseCommission = ${totalShippedAmount} * ${rule.baseRate} * 0.6 = ${baseCommission}`);
      console.log(`[Commission Engine] ${category}: marginCommission = ${totalMargin} * ${rule.ruleJson.marginWeight} = ${marginCommission}`);
      break;
      
    case 'ECOMMERCE':
      // 电商型：新客户奖励1.5倍
      baseCommission = totalShippedAmount * rule.baseRate;
      collectionCommission = validPaymentAmount * (rule.ruleJson.collectionWeight || 0);
      newCustomerCommission = newCustomerCount * rule.newCustomerBonus * 1.5;
      
      console.log(`[Commission Engine] ${category}: baseCommission = ${totalShippedAmount} * ${rule.baseRate} = ${baseCommission}`);
      console.log(`[Commission Engine] ${category}: newCustomerCommission = ${newCustomerCount} * ${rule.newCustomerBonus} * 1.5 = ${newCustomerCommission}`);
      break;
      
    default:
      // 默认规则
      baseCommission = totalShippedAmount * rule.baseRate;
      newCustomerCommission = newCustomerCount * rule.newCustomerBonus;
      break;
  }
  
  const totalCommission = baseCommission + marginCommission + collectionCommission + newCustomerCommission;
  
  console.log(`[Commission Engine] Total commission: ${totalCommission} (${(totalCommission / 100).toFixed(2)} CNY)`);
  
  // 返回结果
  return {
    success: true,
    data: {
      period: {
        startDate: input.startDate,
        endDate: input.endDate,
      },
      kpi: {
        totalShippedAmount,
        fulfilledOrderCount: ordersInPeriod.length,
        newCustomerCount,
        totalMargin,
        validPaymentAmount,
        overduePaymentAmount,
        validOrderCount,
        overdueOrderCount,
      },
      commission: {
        baseCommission: Math.round(baseCommission),
        marginCommission: Math.round(marginCommission),
        collectionCommission: Math.round(collectionCommission),
        newCustomerCommission: Math.round(newCustomerCommission),
        totalCommission: Math.round(totalCommission),
      },
      ruleVersion: rule.ruleVersion,
      category: rule.category,
      rule,
    },
  };
}
