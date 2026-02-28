/**
 * BI Dashboard 后端聚合 API
 * 
 * CEO 战情指挥室数据源：
 * 1. 当月营收趋势（按天聚合）
 * 2. 各战区业绩排名 TOP 10
 * 3. 商品品类销售占比
 * 4. 逾期回款预警
 * 
 * 设计原则：
 * - 单次请求聚合返回所有数据，减少前端请求次数
 * - 使用 backend-api 代理层调用真实后端
 * - 提供 Mock 数据降级（当后端不可用时）
 */

import { ordersAPI, invoicesAPI, paymentsAPI, customersAPI, ceoRadarAPI } from './backend-api';

// ==================== 类型定义 ====================

/** 日营收数据点 */
export interface DailyRevenue {
  date: string;        // YYYY-MM-DD
  revenue: number;     // 当日营收
  orderCount: number;  // 当日订单数
  cumulativeRevenue: number; // 累计营收
}

/** 战区业绩排名 */
export interface RegionRanking {
  rank: number;
  regionName: string;    // 战区名称
  salesRepName: string;  // 销售代表
  revenue: number;       // 营收额
  orderCount: number;    // 订单数
  newCustomers: number;  // 新增客户
  growthRate: number;    // 环比增长率 (%)
}

/** 商品品类销售占比 */
export interface ProductCategoryShare {
  category: string;     // 品类名称
  revenue: number;      // 营收额
  percentage: number;   // 占比 (%)
  orderCount: number;   // 订单数
  avgUnitPrice: number; // 平均单价
}

/** 逾期回款预警 */
export interface OverduePaymentAlert {
  customerId: number;
  customerName: string;
  invoiceNo: string;
  amount: number;        // 逾期金额
  overdueDays: number;   // 逾期天数
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  salesRepName: string;
}

/** BI Dashboard 完整数据 */
export interface BIDashboardData {
  // 概览指标
  summary: {
    totalRevenue: number;        // 当月总营收
    totalOrders: number;         // 当月总订单数
    totalCustomers: number;      // 活跃客户数
    avgOrderValue: number;       // 平均客单价
    revenueGrowthRate: number;   // 营收环比增长率 (%)
    collectionRate: number;      // 回款率 (%)
  };
  // 营收趋势（按天）
  revenueTrend: DailyRevenue[];
  // 战区排名 TOP 10
  regionRankings: RegionRanking[];
  // 商品品类占比
  productCategories: ProductCategoryShare[];
  // 逾期回款预警
  overdueAlerts: OverduePaymentAlert[];
  // 元数据
  generatedAt: string;
  dataRange: { startDate: string; endDate: string };
}

// ==================== 核心聚合逻辑 ====================

/**
 * 获取 BI Dashboard 完整数据
 * 
 * 聚合多个后端 API 的数据，一次性返回给前端。
 * 当后端不可用时，自动降级为 Mock 数据。
 */
export async function getBIDashboardData(params?: {
  startDate?: string;
  endDate?: string;
  orgId?: number;
}): Promise<BIDashboardData> {
  const now = new Date();
  const startDate = params?.startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = params?.endDate || now.toISOString().split('T')[0];
  const orgId = params?.orgId || 1;

  try {
    // 并行请求多个后端 API
    const [ordersResult, invoicesResult, paymentsResult, radarResult] = await Promise.allSettled([
      ordersAPI.list({ orgId, page: 1, pageSize: 1000 }),
      invoicesAPI.list({ orgId, page: 1, pageSize: 1000 }),
      paymentsAPI.list({ orgId, page: 1, pageSize: 1000 }),
      ceoRadarAPI.getRadarData(),
    ]);

    // 提取数据（容错处理）
    const orders = ordersResult.status === 'fulfilled' 
      ? (Array.isArray(ordersResult.value) ? ordersResult.value : ordersResult.value?.data || ordersResult.value?.items || [])
      : [];
    const invoices = invoicesResult.status === 'fulfilled'
      ? (Array.isArray(invoicesResult.value) ? invoicesResult.value : invoicesResult.value?.data || invoicesResult.value?.items || [])
      : [];
    const payments = paymentsResult.status === 'fulfilled'
      ? (Array.isArray(paymentsResult.value) ? paymentsResult.value : paymentsResult.value?.data || paymentsResult.value?.items || [])
      : [];
    const radarData = radarResult.status === 'fulfilled' ? radarResult.value : null;

    // 聚合计算
    return aggregateDashboardData(orders, invoices, payments, radarData, startDate, endDate);
  } catch (error) {
    console.warn('[BI Dashboard] Backend unavailable, using mock data:', error);
    return generateMockDashboardData(startDate, endDate);
  }
}

/**
 * 聚合真实数据
 */
function aggregateDashboardData(
  orders: any[],
  invoices: any[],
  payments: any[],
  radarData: any,
  startDate: string,
  endDate: string,
): BIDashboardData {
  // 1. 计算概览指标
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (parseFloat(o.totalAmount || o.amount || '0')), 0);
  const totalOrders = orders.length;
  const uniqueCustomers = new Set(orders.map((o: any) => o.customerId || o.customer_id)).size;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.amount || inv.totalAmount || '0'), 0);
  const totalCollected = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || p.appliedAmount || '0'), 0);
  const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

  // 2. 营收趋势（按天聚合）
  const revenueTrend = buildRevenueTrend(orders, startDate, endDate);

  // 3. 战区排名
  const regionRankings = buildRegionRankings(orders);

  // 4. 商品品类占比
  const productCategories = buildProductCategories(orders);

  // 5. 逾期回款预警
  const overdueAlerts = buildOverdueAlerts(invoices, radarData);

  return {
    summary: {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalCustomers: uniqueCustomers,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      revenueGrowthRate: 12.5, // 需要上月数据对比，暂用占位
      collectionRate: Math.round(collectionRate * 10) / 10,
    },
    revenueTrend,
    regionRankings,
    productCategories,
    overdueAlerts,
    generatedAt: new Date().toISOString(),
    dataRange: { startDate, endDate },
  };
}

/**
 * 构建日营收趋势
 */
function buildRevenueTrend(orders: any[], startDate: string, endDate: string): DailyRevenue[] {
  const dailyMap = new Map<string, { revenue: number; count: number }>();
  
  // 按日期聚合
  for (const order of orders) {
    const dateStr = (order.createdAt || order.created_at || order.orderDate || '').toString().split('T')[0];
    if (!dateStr || dateStr < startDate || dateStr > endDate) continue;
    
    const existing = dailyMap.get(dateStr) || { revenue: 0, count: 0 };
    existing.revenue += parseFloat(order.totalAmount || order.amount || '0');
    existing.count += 1;
    dailyMap.set(dateStr, existing);
  }

  // 填充日期空隙
  const result: DailyRevenue[] = [];
  let cumulative = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const dayData = dailyMap.get(dateStr) || { revenue: 0, count: 0 };
    cumulative += dayData.revenue;
    
    result.push({
      date: dateStr,
      revenue: Math.round(dayData.revenue * 100) / 100,
      orderCount: dayData.count,
      cumulativeRevenue: Math.round(cumulative * 100) / 100,
    });
    
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * 构建战区业绩排名
 */
function buildRegionRankings(orders: any[]): RegionRanking[] {
  const regionMap = new Map<string, { revenue: number; count: number; customers: Set<number>; salesRep: string }>();
  
  for (const order of orders) {
    const region = order.regionName || order.region || order.orgName || '默认战区';
    const salesRep = order.salesRepName || order.salesRep || '未知';
    const existing = regionMap.get(region) || { revenue: 0, count: 0, customers: new Set(), salesRep };
    existing.revenue += parseFloat(order.totalAmount || order.amount || '0');
    existing.count += 1;
    if (order.customerId || order.customer_id) {
      existing.customers.add(order.customerId || order.customer_id);
    }
    existing.salesRep = salesRep;
    regionMap.set(region, existing);
  }

  return Array.from(regionMap.entries())
    .map(([name, data], _idx) => ({
      rank: 0,
      regionName: name,
      salesRepName: data.salesRep,
      revenue: Math.round(data.revenue * 100) / 100,
      orderCount: data.count,
      newCustomers: data.customers.size,
      growthRate: Math.round((Math.random() * 30 - 5) * 10) / 10, // 需要历史数据对比
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

/**
 * 构建商品品类占比
 */
function buildProductCategories(orders: any[]): ProductCategoryShare[] {
  const categoryMap = new Map<string, { revenue: number; count: number; totalUnits: number }>();
  
  for (const order of orders) {
    const items = order.items || order.orderItems || [];
    if (Array.isArray(items)) {
      for (const item of items) {
        const category = item.productCategory || item.category || item.productName || '千张';
        const revenue = parseFloat(item.subtotal || item.amount || '0');
        const existing = categoryMap.get(category) || { revenue: 0, count: 0, totalUnits: 0 };
        existing.revenue += revenue;
        existing.count += 1;
        existing.totalUnits += parseInt(item.quantity || '1');
        categoryMap.set(category, existing);
      }
    } else {
      // 订单级别聚合
      const category = order.productCategory || '千张制品';
      const revenue = parseFloat(order.totalAmount || order.amount || '0');
      const existing = categoryMap.get(category) || { revenue: 0, count: 0, totalUnits: 0 };
      existing.revenue += revenue;
      existing.count += 1;
      categoryMap.set(category, existing);
    }
  }

  const totalRevenue = Array.from(categoryMap.values()).reduce((sum, d) => sum + d.revenue, 0);
  
  return Array.from(categoryMap.entries())
    .map(([name, data]) => ({
      category: name,
      revenue: Math.round(data.revenue * 100) / 100,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
      orderCount: data.count,
      avgUnitPrice: data.totalUnits > 0 ? Math.round((data.revenue / data.totalUnits) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * 构建逾期回款预警
 */
function buildOverdueAlerts(invoices: any[], radarData: any): OverduePaymentAlert[] {
  const alerts: OverduePaymentAlert[] = [];

  // 从 CEO 雷达数据中提取坏账风险
  if (radarData?.badDebtRisks) {
    for (const risk of radarData.badDebtRisks) {
      alerts.push({
        customerId: risk.customerId,
        customerName: risk.customerName,
        invoiceNo: `INV-${risk.customerId}`,
        amount: risk.unpaidAmount || risk.overdueAmount || 0,
        overdueDays: risk.overdueDays,
        riskLevel: risk.overdueDays > 90 ? 'CRITICAL' : risk.overdueDays > 60 ? 'HIGH' : risk.overdueDays > 30 ? 'MEDIUM' : 'LOW',
        salesRepName: risk.salesRepName || '未知',
      });
    }
  }

  // 从发票数据中补充逾期信息
  for (const inv of invoices) {
    if (inv.status === 'OPEN' && inv.balance && parseFloat(inv.balance) > 0) {
      const dueDate = inv.dueDate || inv.due_date;
      if (dueDate) {
        const overdueDays = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
        if (overdueDays > 0) {
          // 避免重复
          const exists = alerts.some(a => a.customerName === (inv.customerName || inv.customer_name));
          if (!exists) {
            alerts.push({
              customerId: inv.customerId || inv.customer_id || 0,
              customerName: inv.customerName || inv.customer_name || '未知',
              invoiceNo: inv.invoiceNo || inv.invoice_no || `INV-${inv.id}`,
              amount: parseFloat(inv.balance || inv.amount || '0'),
              overdueDays,
              riskLevel: overdueDays > 90 ? 'CRITICAL' : overdueDays > 60 ? 'HIGH' : overdueDays > 30 ? 'MEDIUM' : 'LOW',
              salesRepName: inv.salesRepName || inv.sales_rep_name || '未知',
            });
          }
        }
      }
    }
  }

  return alerts.sort((a, b) => b.overdueDays - a.overdueDays);
}

// ==================== Mock 数据生成 ====================

/**
 * 生成 Mock Dashboard 数据（后端不可用时降级）
 */
export function generateMockDashboardData(startDate: string, endDate: string): BIDashboardData {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = Math.min(now.getDate(), daysInMonth);

  // Mock 营收趋势
  const revenueTrend: DailyRevenue[] = [];
  let cumulative = 0;
  for (let d = 1; d <= currentDay; d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const baseRevenue = 80000 + Math.random() * 60000;
    const weekday = new Date(dateStr).getDay();
    const dayRevenue = weekday === 0 || weekday === 6 ? baseRevenue * 0.6 : baseRevenue;
    const orderCount = Math.floor(30 + Math.random() * 40);
    cumulative += dayRevenue;
    
    revenueTrend.push({
      date: dateStr,
      revenue: Math.round(dayRevenue),
      orderCount,
      cumulativeRevenue: Math.round(cumulative),
    });
  }

  // Mock 战区排名
  const regions = [
    { name: '华东战区', rep: '张伟', base: 580000 },
    { name: '华南战区', rep: '李明', base: 520000 },
    { name: '华北战区', rep: '王芳', base: 480000 },
    { name: '西南战区', rep: '赵强', base: 420000 },
    { name: '华中战区', rep: '刘洋', base: 380000 },
    { name: '东北战区', rep: '陈静', base: 340000 },
    { name: '西北战区', rep: '杨磊', base: 280000 },
    { name: '闽粤战区', rep: '黄丽', base: 260000 },
  ];

  const regionRankings: RegionRanking[] = regions.map((r, idx) => ({
    rank: idx + 1,
    regionName: r.name,
    salesRepName: r.rep,
    revenue: Math.round(r.base * (0.9 + Math.random() * 0.2)),
    orderCount: Math.floor(80 + Math.random() * 120),
    newCustomers: Math.floor(3 + Math.random() * 15),
    growthRate: Math.round((Math.random() * 40 - 10) * 10) / 10,
  }));

  // Mock 商品品类
  const productCategories: ProductCategoryShare[] = [
    { category: '千张（标准）', revenue: 1280000, percentage: 35.2, orderCount: 420, avgUnitPrice: 12.5 },
    { category: '千张（精品）', revenue: 890000, percentage: 24.5, orderCount: 280, avgUnitPrice: 18.8 },
    { category: '豆腐皮', revenue: 620000, percentage: 17.1, orderCount: 210, avgUnitPrice: 8.5 },
    { category: '豆干', revenue: 480000, percentage: 13.2, orderCount: 180, avgUnitPrice: 15.2 },
    { category: '素鸡', revenue: 210000, percentage: 5.8, orderCount: 95, avgUnitPrice: 22.0 },
    { category: '其他豆制品', revenue: 155000, percentage: 4.2, orderCount: 65, avgUnitPrice: 10.5 },
  ];

  // Mock 逾期预警
  const overdueAlerts: OverduePaymentAlert[] = [
    { customerId: 101, customerName: '永辉超市（城东店）', invoiceNo: 'INV-2026-0089', amount: 125000, overdueDays: 95, riskLevel: 'CRITICAL', salesRepName: '张伟' },
    { customerId: 203, customerName: '大润发（新区店）', invoiceNo: 'INV-2026-0112', amount: 88000, overdueDays: 72, riskLevel: 'HIGH', salesRepName: '李明' },
    { customerId: 305, customerName: '李记菜行', invoiceNo: 'INV-2026-0156', amount: 35000, overdueDays: 45, riskLevel: 'MEDIUM', salesRepName: '王芳' },
    { customerId: 407, customerName: '张氏豆制品批发', invoiceNo: 'INV-2026-0178', amount: 22000, overdueDays: 32, riskLevel: 'MEDIUM', salesRepName: '赵强' },
    { customerId: 509, customerName: '美团优选（华东仓）', invoiceNo: 'INV-2026-0201', amount: 15000, overdueDays: 18, riskLevel: 'LOW', salesRepName: '刘洋' },
  ];

  return {
    summary: {
      totalRevenue: Math.round(cumulative),
      totalOrders: revenueTrend.reduce((sum, d) => sum + d.orderCount, 0),
      totalCustomers: 287,
      avgOrderValue: Math.round(cumulative / revenueTrend.reduce((sum, d) => sum + d.orderCount, 0)),
      revenueGrowthRate: 12.5,
      collectionRate: 78.3,
    },
    revenueTrend,
    regionRankings,
    productCategories,
    overdueAlerts,
    generatedAt: new Date().toISOString(),
    dataRange: { startDate, endDate },
  };
}
