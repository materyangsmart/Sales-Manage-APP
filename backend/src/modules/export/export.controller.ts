import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';

/**
 * P31: 企业级数据导出中枢
 * 
 * 流式处理千万级数据导出为标准 CSV 格式
 * 附带 BOM 头防止 Excel 乱码
 */
@Controller('api/internal/export')
@UseGuards(RolesGuard)
export class ExportController {
  constructor(private dataSource: DataSource) {}

  /**
   * 导出订单数据 CSV
   * GET /api/internal/export/orders?startDate=2025-01-01&endDate=2025-12-31&status=FULFILLED
   */
  @Get('orders')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async exportOrders(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const filename = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // BOM 头防止 Excel 乱码
    res.write('\uFEFF');

    // CSV 表头
    const headers = [
      '订单ID', '订单编号', '客户ID', '客户名称', '客户类型',
      '订单金额(元)', '订单毛利(元)', '订单状态', '订单日期',
      '发货日期', '生产批次号', '审核人ID', '审核时间',
      '发货人ID', '发货时间', '创建时间',
    ];
    res.write(headers.join(',') + '\n');

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND o.order_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND o.order_date <= ?';
      params.push(endDate);
    }
    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    // 流式查询：每次取 1000 行
    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.dataSource.query(`
        SELECT 
          o.id,
          o.order_no,
          o.customer_id,
          c.name AS customer_name,
          c.category AS customer_category,
          o.total_amount,
          ROUND(o.total_amount * 0.15) AS gross_profit,
          o.status,
          o.order_date,
          o.delivery_date,
          o.batch_no,
          o.reviewed_by,
          o.reviewed_at,
          o.fulfilled_by,
          o.fulfilled_at,
          o.created_at
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        ${whereClause}
        ORDER BY o.id ASC
        LIMIT ? OFFSET ?
      `, [...params, PAGE_SIZE, offset]);

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        const line = [
          row.id,
          this.escapeCSV(row.order_no),
          row.customer_id,
          this.escapeCSV(row.customer_name || ''),
          this.escapeCSV(this.translateCategory(row.customer_category)),
          (row.total_amount / 100).toFixed(2),
          (row.gross_profit / 100).toFixed(2),
          this.translateStatus(row.status),
          row.order_date ? new Date(row.order_date).toISOString().slice(0, 10) : '',
          row.delivery_date ? new Date(row.delivery_date).toISOString().slice(0, 10) : '',
          this.escapeCSV(row.batch_no || ''),
          row.reviewed_by || '',
          row.reviewed_at ? new Date(row.reviewed_at).toISOString().replace('T', ' ').slice(0, 19) : '',
          row.fulfilled_by || '',
          row.fulfilled_at ? new Date(row.fulfilled_at).toISOString().replace('T', ' ').slice(0, 19) : '',
          row.created_at ? new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 19) : '',
        ].join(',');
        res.write(line + '\n');
      }

      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      }
    }

    res.end();
  }

  /**
   * 导出收款数据 CSV
   * GET /api/internal/export/payments?startDate=2025-01-01&endDate=2025-12-31
   */
  @Get('payments')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.AUDITOR)
  async exportPayments(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const filename = `payments_export_${new Date().toISOString().slice(0, 10)}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // BOM 头
    res.write('\uFEFF');

    // CSV 表头
    const headers = [
      '收款ID', '收款编号', '银行流水号', '客户ID', '客户名称', '客户类型',
      '收款金额(元)', '未核销金额(元)', '收款日期', '收款方式',
      '核销状态', '核销时间戳', '关联发票号', '关联订单批次号',
      '创建人ID', '创建时间',
    ];
    res.write(headers.join(',') + '\n');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (startDate) {
      whereClause += ' AND p.payment_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND p.payment_date <= ?';
      params.push(endDate);
    }
    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    const PAGE_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const rows = await this.dataSource.query(`
        SELECT 
          p.id,
          p.payment_no,
          p.bank_ref,
          p.customer_id,
          c.name AS customer_name,
          c.category AS customer_category,
          p.amount,
          p.unapplied_amount,
          p.payment_date,
          p.payment_method,
          p.status,
          p.updated_at AS reconciled_at,
          GROUP_CONCAT(DISTINCT i.invoice_no SEPARATOR '; ') AS related_invoices,
          GROUP_CONCAT(DISTINCT o.batch_no SEPARATOR '; ') AS related_batch_nos,
          p.created_by,
          p.created_at
        FROM ar_payments p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN ar_apply aa ON aa.payment_id = p.id
        LEFT JOIN ar_invoices i ON aa.invoice_id = i.id
        LEFT JOIN orders o ON i.order_id = o.id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.id ASC
        LIMIT ? OFFSET ?
      `, [...params, PAGE_SIZE, offset]);

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of rows) {
        const line = [
          row.id,
          this.escapeCSV(row.payment_no),
          this.escapeCSV(row.bank_ref),
          row.customer_id,
          this.escapeCSV(row.customer_name || ''),
          this.escapeCSV(this.translateCategory(row.customer_category)),
          (row.amount / 100).toFixed(2),
          (row.unapplied_amount / 100).toFixed(2),
          row.payment_date ? new Date(row.payment_date).toISOString().slice(0, 10) : '',
          this.translatePaymentMethod(row.payment_method),
          this.translatePaymentStatus(row.status),
          row.reconciled_at ? new Date(row.reconciled_at).toISOString().replace('T', ' ').slice(0, 19) : '',
          this.escapeCSV(row.related_invoices || ''),
          this.escapeCSV(row.related_batch_nos || ''),
          row.created_by || '',
          row.created_at ? new Date(row.created_at).toISOString().replace('T', ' ').slice(0, 19) : '',
        ].join(',');
        res.write(line + '\n');
      }

      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) {
        hasMore = false;
      }
    }

    res.end();
  }

  // ===== Helper Methods =====

  private escapeCSV(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private translateCategory(cat: string): string {
    const map: Record<string, string> = {
      WET_MARKET: '菜市场',
      SUPERMARKET: '商超',
      WHOLESALE_B: '批发商',
      ECOMMERCE: '电商',
      DEFAULT: '默认',
    };
    return map[cat] || cat || '';
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING_REVIEW: '待审核',
      APPROVED: '已批准',
      REJECTED: '已拒绝',
      FULFILLED: '已完成',
      CANCELLED: '已取消',
    };
    return map[status] || status || '';
  }

  private translatePaymentMethod(method: string): string {
    const map: Record<string, string> = {
      BANK_TRANSFER: '银行转账',
      CASH: '现金',
      CHECK: '支票',
    };
    return map[method] || method || '';
  }

  private translatePaymentStatus(status: string): string {
    const map: Record<string, string> = {
      UNAPPLIED: '未核销',
      PARTIAL: '部分核销',
      APPLIED: '已核销',
    };
    return map[status] || status || '';
  }
}
