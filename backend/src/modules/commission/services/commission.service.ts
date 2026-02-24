import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CommissionService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 获取个人业绩（真实SQL聚合）
   * 根据当前登录用户的ID，聚合其名下客户的真实发货额和逾期扣减
   */
  async getMyPerformance(userId: number) {
    // 1. 获取用户信息
    const userRows = await this.dataSource.query(
      `SELECT id, real_name, job_position, roles FROM users WHERE id = ?`,
      [userId],
    );
    const user = userRows[0] || { id: userId, real_name: 'Unknown', job_position: 'SALES_REP' };

    // 2. 聚合该销售员名下的订单发货额（FULFILLED状态的订单）
    const deliveryStats = await this.dataSource.query(
      `SELECT 
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS total_delivery_amount,
        COUNT(DISTINCT o.customer_id) AS customer_count,
        COUNT(DISTINCT CASE WHEN o.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN o.id END) AS recent_orders,
        COALESCE(SUM(CASE WHEN o.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN o.total_amount ELSE 0 END), 0) AS recent_delivery_amount
      FROM orders o
      WHERE o.created_by = ? AND o.status = 'FULFILLED'`,
      [userId],
    );

    // 3. 聚合逾期扣减（超过30天未核销的发票余额）
    const overdueStats = await this.dataSource.query(
      `SELECT 
        COUNT(DISTINCT ai.id) AS overdue_invoice_count,
        COALESCE(SUM(ai.balance), 0) AS overdue_amount
      FROM ar_invoices ai
      INNER JOIN orders o ON ai.order_id = o.id
      WHERE o.created_by = ?
        AND ai.status IN ('OPEN', 'PARTIAL')
        AND ai.due_date < CURDATE()`,
      [userId],
    );

    // 4. 计算提成（基于提成规则表）
    const commissionRules = await this.dataSource.query(
      `SELECT * FROM commission_rules ORDER BY min_amount ASC`,
    ).catch(() => []);

    const totalDelivery = Number(deliveryStats[0]?.total_delivery_amount || 0);
    const overdueAmount = Number(overdueStats[0]?.overdue_amount || 0);

    // 计算提成基数 = 发货额 - 逾期扣减
    const commissionBase = Math.max(0, totalDelivery - overdueAmount);
    let commissionRate = 0.03; // 默认3%

    // 根据规则表匹配提成比例
    for (const rule of commissionRules) {
      const minAmt = Number(rule.min_amount || 0);
      const maxAmt = Number(rule.max_amount || Infinity);
      if (commissionBase >= minAmt && commissionBase < maxAmt) {
        commissionRate = Number(rule.rate || 0.03);
        break;
      }
    }

    const commissionAmount = Math.round(commissionBase * commissionRate);

    // 5. 月度趋势（最近6个月）
    const monthlyTrend = await this.dataSource.query(
      `SELECT 
        DATE_FORMAT(o.order_date, '%Y-%m') AS month,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS delivery_amount
      FROM orders o
      WHERE o.created_by = ? 
        AND o.status = 'FULFILLED'
        AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(o.order_date, '%Y-%m')
      ORDER BY month DESC`,
      [userId],
    );

    return {
      userId: user.id,
      userName: user.real_name,
      jobPosition: user.job_position,
      summary: {
        totalOrders: Number(deliveryStats[0]?.total_orders || 0),
        totalDeliveryAmount: totalDelivery,
        customerCount: Number(deliveryStats[0]?.customer_count || 0),
        recentOrders: Number(deliveryStats[0]?.recent_orders || 0),
        recentDeliveryAmount: Number(deliveryStats[0]?.recent_delivery_amount || 0),
      },
      overdue: {
        invoiceCount: Number(overdueStats[0]?.overdue_invoice_count || 0),
        overdueAmount: overdueAmount,
      },
      commission: {
        base: commissionBase,
        rate: commissionRate,
        amount: commissionAmount,
        deduction: overdueAmount,
      },
      monthlyTrend: monthlyTrend.map((row: any) => ({
        month: row.month,
        orderCount: Number(row.order_count),
        deliveryAmount: Number(row.delivery_amount),
      })),
    };
  }
}
