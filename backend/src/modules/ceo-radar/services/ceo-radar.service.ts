import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RadarAlert {
  type: 'BAD_DEBT' | 'CUSTOMER_CHURN' | 'PRICE_ANOMALY' | 'YIELD_ANOMALY' | 'COMPLAINT';
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  data: any;
}

@Injectable()
export class CeoRadarService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 获取CEO雷达全部警报（含得率异动审计）
   */
  async getRadarAlerts(orgId: number): Promise<RadarAlert[]> {
    const alerts: RadarAlert[] = [];

    // 1. 坏账风险预警
    const badDebtAlerts = await this.getBadDebtAlerts(orgId);
    alerts.push(...badDebtAlerts);

    // 2. 客户流失预警
    const churnAlerts = await this.getCustomerChurnAlerts(orgId);
    alerts.push(...churnAlerts);

    // 3. 价格异常预警
    const priceAlerts = await this.getPriceAnomalyAlerts(orgId);
    alerts.push(...priceAlerts);

    // 4. 得率异动审计（production_plans planned_quantity vs actual_quantity）
    const yieldAlerts = await this.getYieldAnomalyAlerts();
    alerts.push(...yieldAlerts);

    // 5. 质量投诉预警
    const complaintAlerts = await this.getComplaintAlerts();
    alerts.push(...complaintAlerts);

    return alerts;
  }

  /**
   * 坏账风险：逾期超过30天且余额>0的发票
   */
  private async getBadDebtAlerts(orgId: number): Promise<RadarAlert[]> {
    const rows = await this.dataSource.query(
      `SELECT 
        ai.id, ai.invoice_no, ai.balance, ai.due_date,
        DATEDIFF(CURDATE(), ai.due_date) AS overdue_days,
        c.name AS customer_name
      FROM ar_invoices ai
      LEFT JOIN customers c ON ai.customer_id = c.id
      WHERE ai.org_id = ?
        AND ai.status IN ('OPEN', 'PARTIAL')
        AND ai.due_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND ai.balance > 0
      ORDER BY ai.balance DESC
      LIMIT 20`,
      [orgId],
    );

    return rows.map((row: any) => ({
      type: 'BAD_DEBT' as const,
      level: Number(row.overdue_days) > 90 ? 'HIGH' as const : 'MEDIUM' as const,
      title: `坏账风险: ${row.customer_name}`,
      description: `发票 ${row.invoice_no} 逾期 ${row.overdue_days} 天，余额 ¥${(Number(row.balance) / 100).toFixed(2)}`,
      data: {
        invoiceId: row.id,
        invoiceNo: row.invoice_no,
        balance: Number(row.balance),
        overdueDays: Number(row.overdue_days),
        customerName: row.customer_name,
      },
    }));
  }

  /**
   * 客户流失：90天内无订单的活跃客户
   */
  private async getCustomerChurnAlerts(orgId: number): Promise<RadarAlert[]> {
    const rows = await this.dataSource.query(
      `SELECT 
        c.id, c.name AS customer_name,
        MAX(o.order_date) AS last_order_date,
        DATEDIFF(CURDATE(), MAX(o.order_date)) AS days_since_last_order
      FROM customers c
      LEFT JOIN orders o ON c.id = o.customer_id
      WHERE c.org_id = ?
      GROUP BY c.id, c.name
      HAVING days_since_last_order > 90 OR last_order_date IS NULL
      ORDER BY days_since_last_order DESC
      LIMIT 20`,
      [orgId],
    );

    return rows.map((row: any) => ({
      type: 'CUSTOMER_CHURN' as const,
      level: Number(row.days_since_last_order) > 180 ? 'HIGH' as const : 'MEDIUM' as const,
      title: `客户流失风险: ${row.customer_name}`,
      description: `${row.days_since_last_order ? `已 ${row.days_since_last_order} 天未下单` : '从未下单'}`,
      data: {
        customerId: row.id,
        customerName: row.customer_name,
        lastOrderDate: row.last_order_date,
        daysSinceLastOrder: Number(row.days_since_last_order || 0),
      },
    }));
  }

  /**
   * 价格异常：单价低于片区均值3%的订单
   */
  private async getPriceAnomalyAlerts(orgId: number): Promise<RadarAlert[]> {
    const rows = await this.dataSource.query(
      `SELECT 
        oi.id, oi.product_name, oi.unit_price, oi.order_id,
        o.order_no, o.order_date,
        AVG(oi2.unit_price) AS avg_price,
        ((AVG(oi2.unit_price) - oi.unit_price) / AVG(oi2.unit_price) * 100) AS deviation_pct
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      INNER JOIN order_items oi2 ON oi.product_name = oi2.product_name
      INNER JOIN orders o2 ON oi2.order_id = o2.id AND o2.org_id = ?
      WHERE o.org_id = ?
        AND o.order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY oi.id, oi.product_name, oi.unit_price, oi.order_id, o.order_no, o.order_date
      HAVING deviation_pct > 3
      ORDER BY deviation_pct DESC
      LIMIT 20`,
      [orgId, orgId],
    );

    return rows.map((row: any) => ({
      type: 'PRICE_ANOMALY' as const,
      level: Number(row.deviation_pct) > 10 ? 'HIGH' as const : 'MEDIUM' as const,
      title: `价格异常: ${row.product_name}`,
      description: `订单 ${row.order_no} 单价 ¥${(Number(row.unit_price) / 100).toFixed(2)}，低于均价 ${Number(row.deviation_pct).toFixed(1)}%`,
      data: {
        orderItemId: row.id,
        orderId: row.order_id,
        orderNo: row.order_no,
        productName: row.product_name,
        unitPrice: Number(row.unit_price),
        avgPrice: Number(row.avg_price),
        deviationPct: Number(row.deviation_pct),
      },
    }));
  }

  /**
   * 得率异动审计：对比 production_plans 中的 planned_quantity 和 actual_quantity
   * 如果偏差率大于 2%，抛出警告
   */
  private async getYieldAnomalyAlerts(): Promise<RadarAlert[]> {
    const rows = await this.dataSource.query(
      `SELECT 
        pp.id, pp.batch_no, pp.product_name,
        pp.planned_quantity, pp.actual_quantity,
        pp.production_date,
        ABS(pp.actual_quantity - pp.planned_quantity) / pp.planned_quantity * 100 AS deviation_pct
      FROM production_plans pp
      WHERE pp.actual_quantity IS NOT NULL
        AND pp.planned_quantity > 0
        AND ABS(pp.actual_quantity - pp.planned_quantity) / pp.planned_quantity * 100 > 2
        AND pp.production_date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      ORDER BY deviation_pct DESC
      LIMIT 20`,
    );

    return rows.map((row: any) => {
      const deviation = Number(row.deviation_pct);
      const isOverProduction = Number(row.actual_quantity) > Number(row.planned_quantity);
      return {
        type: 'YIELD_ANOMALY' as const,
        level: deviation > 10 ? 'HIGH' as const : deviation > 5 ? 'MEDIUM' as const : 'LOW' as const,
        title: `得率异动: ${row.product_name} (${row.batch_no})`,
        description: `计划 ${row.planned_quantity} 件，实际 ${row.actual_quantity} 件，偏差 ${isOverProduction ? '+' : '-'}${deviation.toFixed(1)}%`,
        data: {
          batchNo: row.batch_no,
          productName: row.product_name,
          plannedQuantity: Number(row.planned_quantity),
          actualQuantity: Number(row.actual_quantity),
          deviationPct: deviation,
          productionDate: row.production_date,
          isOverProduction,
        },
      };
    });
  }

  /**
   * 质量投诉预警：最近7天的未处理投诉
   */
  private async getComplaintAlerts(): Promise<RadarAlert[]> {
    try {
      const rows = await this.dataSource.query(
        `SELECT 
          qf.id, qf.rating, qf.comment, qf.customer_name,
          qf.created_at,
          o.order_no, o.batch_no
        FROM quality_feedback qf
        LEFT JOIN orders o ON qf.order_id = o.id
        WHERE qf.rating <= 2
          AND qf.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ORDER BY qf.rating ASC, qf.created_at DESC
        LIMIT 20`,
      );

      return rows.map((row: any) => ({
        type: 'COMPLAINT' as const,
        level: row.rating <= 1 ? 'HIGH' as const : 'MEDIUM' as const,
        title: `质量投诉: ${row.customer_name || '匿名客户'} (${row.rating}星)`,
        description: `${row.comment?.substring(0, 100) || '无描述'}${row.order_no ? ` (订单: ${row.order_no})` : ''}`,
        data: {
          feedbackId: row.id,
          rating: row.rating,
          batchNo: row.batch_no,
          orderNo: row.order_no,
          customerName: row.customer_name,
          createdAt: row.created_at,
        },
      }));
    } catch {
      // quality_feedback 表可能不存在
      return [];
    }
  }
}
