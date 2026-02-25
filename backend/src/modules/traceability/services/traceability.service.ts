import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TraceabilityService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 根据追溯码获取完整追溯数据
   * 精确匹配：orders.batch_no -> production_plans.batch_no
   * 决不允许使用时间范围作为追溯依据
   */
  async getTraceData(code: string) {
    // code 格式: orderId 或 orderNo 或 batchNo
    let orderId: number | null = null;

    // 尝试按 batch_no 查询（QZ开头的追溯码）
    if (code.startsWith('QZ') || code.startsWith('qz')) {
      const orderByBatch = await this.dataSource.query(
        `SELECT id FROM orders WHERE batch_no = ? LIMIT 1`,
        [code],
      );
      if (orderByBatch.length > 0) {
        orderId = orderByBatch[0].id;
      }
    }

    // 尝试按 orderNo 查询
    if (!orderId) {
      const orderByNo = await this.dataSource.query(
        `SELECT id FROM orders WHERE order_no = ? LIMIT 1`,
        [code],
      );
      if (orderByNo.length > 0) {
        orderId = orderByNo[0].id;
      }
    }

    // 尝试按 ID 查询
    if (!orderId) {
      const parsed = parseInt(code);
      if (!isNaN(parsed)) {
        orderId = parsed;
      }
    }

    if (!orderId) {
      throw new NotFoundException(`Traceability code "${code}" not found`);
    }

    // 1. 查询订单基本信息 + 客户信息 + batch_no
    const orderRows = await this.dataSource.query(
      `SELECT 
        o.id, o.order_no, o.total_amount, o.status, o.order_date,
        o.delivery_address, o.delivery_date, o.created_at,
        o.batch_no,
        c.name AS customer_name, c.contact AS customer_contact,
        c.phone AS customer_phone, c.address AS customer_address,
        c.category AS customer_category
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?`,
      [orderId],
    );

    if (orderRows.length === 0) {
      throw new NotFoundException(`Order with code "${code}" not found`);
    }

    const order = orderRows[0];
    const batchNo = order.batch_no;

    // 2. 查询订单项
    const items = await this.dataSource.query(
      `SELECT product_id, quantity, unit_price, subtotal
      FROM order_items WHERE order_id = ?`,
      [orderId],
    );

    // 3. 精确匹配生产批次信息：JOIN production_plans ON orders.batch_no = pp.batch_no
    // 绝对禁止时间范围模糊匹配
    let productionPlan = null;
    if (batchNo) {
      const productionPlans = await this.dataSource.query(
        `SELECT 
          pp.batch_no, pp.plan_no, pp.plan_date,
          pp.product_id, pp.planned_quantity, pp.actual_quantity,
          pp.status AS production_status,
          pp.workshop, pp.soybean_batch, pp.water_quality,
          pp.workshop_temp, pp.sterilization_params,
          pp.quality_inspector, pp.quality_result,
          pp.production_date
        FROM production_plans pp
        WHERE pp.batch_no = ?
        LIMIT 1`,
        [batchNo],
      );

      if (productionPlans.length > 0) {
        const pp = productionPlans[0];
        productionPlan = {
          batchNo: pp.batch_no,
          planNo: pp.plan_no,
          planDate: pp.plan_date,
          productId: pp.product_id,
          plannedQuantity: Number(pp.planned_quantity),
          actualQuantity: Number(pp.actual_quantity),
          productionStatus: pp.production_status,
          workshop: pp.workshop,
          soybeanBatch: pp.soybean_batch,
          waterQuality: pp.water_quality,
          workshopTemp: pp.workshop_temp ? Number(pp.workshop_temp) : null,
          sterilizationParams: pp.sterilization_params,
          qualityInspector: pp.quality_inspector,
          qualityResult: pp.quality_result,
          productionDate: pp.production_date,
        };
      }
    }

    // 4. 查询配送记录（通过order_id精确关联）
    const deliveryRecords = await this.dataSource.query(
      `SELECT 
        dr.batch_no, dr.driver_id, dr.driver_name, dr.driver_phone,
        dr.picking_time, dr.shipping_time, dr.delivery_time,
        dr.status AS delivery_status
      FROM delivery_records dr
      WHERE dr.order_id = ?`,
      [orderId],
    );

    const logistics = deliveryRecords.length > 0 ? {
      batchNo: deliveryRecords[0].batch_no,
      driverId: deliveryRecords[0].driver_id,
      driverName: deliveryRecords[0].driver_name,
      driverPhone: deliveryRecords[0].driver_phone,
      pickingTime: deliveryRecords[0].picking_time,
      shippingTime: deliveryRecords[0].shipping_time,
      deliveryTime: deliveryRecords[0].delivery_time,
      deliveryStatus: deliveryRecords[0].delivery_status,
    } : null;

    return {
      // 订单基础信息
      orderId: order.id,
      orderNo: order.order_no,
      totalAmount: Number(order.total_amount),
      status: order.status,
      orderDate: order.order_date,
      createdAt: order.created_at,
      customerName: order.customer_name,
      customerCategory: order.customer_category,

      // 精确追溯批次号（唯一标识）
      batchNo: batchNo,

      // 原料端（来自production_plans精确匹配）
      rawMaterial: productionPlan ? {
        soybeanBatch: productionPlan.soybeanBatch || 'N/A',
        waterQuality: productionPlan.waterQuality || '合格',
      } : null,

      // 制造端（来自production_plans精确匹配）
      production: productionPlan ? {
        batchNo: productionPlan.batchNo,
        productionDate: productionPlan.productionDate || productionPlan.planDate,
        workshopTemp: productionPlan.workshopTemp,
        sterilizationParams: productionPlan.sterilizationParams || 'N/A',
        qualityInspector: productionPlan.qualityInspector || 'N/A',
        qualityResult: productionPlan.qualityResult || 'N/A',
        plannedQuantity: productionPlan.plannedQuantity,
        actualQuantity: productionPlan.actualQuantity,
        workshop: productionPlan.workshop,
      } : null,

      // 物流端（来自delivery_records精确匹配）
      logistics: logistics,

      // 订单项
      items: items.map((item: any) => ({
        productId: item.product_id,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      })),
    };
  }
}
