import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * 多维度提成引擎（P27）
 * 
 * 核心规则：
 * 1. 按客户类型（WET_MARKET, SUPERMARKET, WHOLESALE_B）分别聚合发货额
 * 2. 不同客户类型应用不同的基础利率和逾期扣减率
 * 3. API输出分类统计结果，而非单一总数
 * 
 * 提成公式：
 *   分类提成 = (分类发货额 × 分类基础利率) - (分类逾期额 × 分类逾期扣减率) + (分类新客数 × 分类新客奖金)
 *   总提成 = Σ 各分类提成
 */

// 各客户类型的提成参数
const COMMISSION_PARAMS: Record<string, {
  baseRate: number;
  overdueDeductionRate: number;
  newCustomerBonus: number;
  label: string;
}> = {
  WET_MARKET: {
    baseRate: 0.02,           // 菜市场 2%
    overdueDeductionRate: 0.005, // 逾期扣减 0.5%
    newCustomerBonus: 300,    // 新客奖金 ¥300
    label: '菜市场',
  },
  SUPERMARKET: {
    baseRate: 0.015,          // 商超 1.5%
    overdueDeductionRate: 0.003, // 逾期扣减 0.3%
    newCustomerBonus: 800,    // 新客奖金 ¥800
    label: '商超',
  },
  WHOLESALE_B: {
    baseRate: 0.01,           // 批发 1%
    overdueDeductionRate: 0.002, // 逾期扣减 0.2%
    newCustomerBonus: 1000,   // 新客奖金 ¥1000
    label: '批发商',
  },
};

export interface CategoryCommission {
  category: string;
  categoryLabel: string;
  orderCount: number;
  deliveryAmount: number;
  baseRate: number;
  baseCommission: number;
  overdueAmount: number;
  overdueDeductionRate: number;
  overdueDeduction: number;
  newCustomerCount: number;
  newCustomerBonus: number;
  newCustomerCommission: number;
  netCommission: number;
}

@Injectable()
export class CommissionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 获取个人业绩（多维度提成引擎）
   * 按客户类型分别聚合，输出分类统计结果
   */
  async getMyPerformance(userId: number) {
    // 1. 获取用户信息
    const userRows = await this.dataSource.query(
      `SELECT id, real_name, job_position, roles FROM users WHERE id = ?`,
      [userId],
    );
    const user = userRows[0] || { id: userId, real_name: 'Unknown', job_position: 'SALES_REP' };

    // 2. 按客户类型分别聚合发货额（FULFILLED状态的订单）
    const deliveryByCategory = await this.dataSource.query(
      `SELECT 
        c.category,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS delivery_amount
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.id
      WHERE o.created_by = ? AND o.status = 'FULFILLED'
      GROUP BY c.category`,
      [userId],
    );

    // 3. 按客户类型分别聚合逾期金额
    const overdueByCategory = await this.dataSource.query(
      `SELECT 
        c.category,
        COALESCE(SUM(ai.balance), 0) AS overdue_amount
      FROM ar_invoices ai
      INNER JOIN orders o ON ai.order_id = o.id
      INNER JOIN customers c ON o.customer_id = c.id
      WHERE o.created_by = ?
        AND ai.status IN ('OPEN', 'PARTIAL')
        AND ai.due_date < CURDATE()
      GROUP BY c.category`,
      [userId],
    );

    // 4. 按客户类型统计新增客户数（最近30天）
    const newCustomersByCategory = await this.dataSource.query(
      `SELECT 
        c.category,
        COUNT(DISTINCT c.id) AS new_customer_count
      FROM customers c
      WHERE c.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND EXISTS (
          SELECT 1 FROM orders o 
          WHERE o.customer_id = c.id AND o.created_by = ?
        )
      GROUP BY c.category`,
      [userId],
    );

    // 构建分类映射
    const deliveryMap = new Map<string, { orderCount: number; deliveryAmount: number }>();
    for (const row of deliveryByCategory) {
      deliveryMap.set(row.category, {
        orderCount: Number(row.order_count),
        deliveryAmount: Number(row.delivery_amount),
      });
    }

    const overdueMap = new Map<string, number>();
    for (const row of overdueByCategory) {
      overdueMap.set(row.category, Number(row.overdue_amount));
    }

    const newCustomerMap = new Map<string, number>();
    for (const row of newCustomersByCategory) {
      newCustomerMap.set(row.category, Number(row.new_customer_count));
    }

    // 5. 尝试从commission_rules表读取自定义规则（覆盖默认参数）
    const dbRules = await this.dataSource.query(
      `SELECT category, rule_json FROM commission_rules WHERE is_active = 1`,
    ).catch(() => []);

    const ruleOverrides = new Map<string, any>();
    for (const rule of dbRules) {
      try {
        const ruleJson = typeof rule.rule_json === 'string' ? JSON.parse(rule.rule_json) : rule.rule_json;
        ruleOverrides.set(rule.category, ruleJson);
      } catch {
        // ignore parse errors
      }
    }

    // 6. 按客户类型计算分类提成
    const categoryCommissions: CategoryCommission[] = [];
    let totalDeliveryAmount = 0;
    let totalOrderCount = 0;
    let totalOverdueAmount = 0;
    let totalNewCustomerCount = 0;
    let totalCommission = 0;

    for (const [category, params] of Object.entries(COMMISSION_PARAMS)) {
      const delivery = deliveryMap.get(category) || { orderCount: 0, deliveryAmount: 0 };
      const overdueAmount = overdueMap.get(category) || 0;
      const newCustomerCount = newCustomerMap.get(category) || 0;

      // 检查是否有数据库自定义规则
      const dbRule = ruleOverrides.get(category);
      const baseRate = dbRule?.baseRate ? parseFloat(dbRule.baseRate) : params.baseRate;
      const overdueDeductionRate = dbRule?.overdueDeduction ? parseFloat(dbRule.overdueDeduction) : params.overdueDeductionRate;
      const newCustomerBonusAmount = dbRule?.newCustomerBonus ? parseFloat(dbRule.newCustomerBonus) : params.newCustomerBonus;

      const baseCommission = delivery.deliveryAmount * baseRate;
      const overdueDeduction = overdueAmount * overdueDeductionRate;
      const newCustomerCommission = newCustomerCount * newCustomerBonusAmount;
      const netCommission = Math.max(0, baseCommission - overdueDeduction + newCustomerCommission);

      categoryCommissions.push({
        category,
        categoryLabel: params.label,
        orderCount: delivery.orderCount,
        deliveryAmount: delivery.deliveryAmount,
        baseRate,
        baseCommission: Math.round(baseCommission * 100) / 100,
        overdueAmount,
        overdueDeductionRate,
        overdueDeduction: Math.round(overdueDeduction * 100) / 100,
        newCustomerCount,
        newCustomerBonus: newCustomerBonusAmount,
        newCustomerCommission: Math.round(newCustomerCommission * 100) / 100,
        netCommission: Math.round(netCommission * 100) / 100,
      });

      totalDeliveryAmount += delivery.deliveryAmount;
      totalOrderCount += delivery.orderCount;
      totalOverdueAmount += overdueAmount;
      totalNewCustomerCount += newCustomerCount;
      totalCommission += netCommission;
    }

    // 7. 月度趋势（最近6个月，按客户类型分组）
    const monthlyTrend = await this.dataSource.query(
      `SELECT 
        DATE_FORMAT(o.order_date, '%Y-%m') AS month,
        c.category,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS delivery_amount
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.id
      WHERE o.created_by = ? 
        AND o.status = 'FULFILLED'
        AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(o.order_date, '%Y-%m'), c.category
      ORDER BY month DESC, c.category`,
      [userId],
    );

    return {
      userId: user.id,
      userName: user.real_name,
      jobPosition: user.job_position,

      // 汇总数据
      totalRevenue: Math.round(totalDeliveryAmount * 100) / 100,
      orderCount: totalOrderCount,
      newCustomerCount: totalNewCustomerCount,
      overdueAmount: Math.round(totalOverdueAmount * 100) / 100,
      totalCommission: Math.round(totalCommission * 100) / 100,
      paymentRate: totalDeliveryAmount > 0
        ? Math.round((1 - totalOverdueAmount / totalDeliveryAmount) * 1000) / 1000
        : 1,

      // 分类提成明细（核心输出）
      categoryBreakdown: categoryCommissions,

      // 月度趋势（按客户类型分组）
      monthlyTrend: monthlyTrend.map((row: any) => ({
        month: row.month,
        category: row.category,
        orderCount: Number(row.order_count),
        deliveryAmount: Number(row.delivery_amount),
      })),
    };
  }
}
