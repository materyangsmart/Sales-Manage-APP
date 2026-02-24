import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TraceabilityService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * 根据追溯码获取完整追溯数据
   * 联表查询 orders + order_items + production_plans + delivery_records + customers
   */
  async getTraceData(code: string) {
    // code 格式: orderId 或 orderNo
    let orderId: number;

    // 尝试按 orderNo 查询
    const orderByNo = await this.dataSource.query(
      `SELECT id FROM orders WHERE order_no = ? LIMIT 1`,
      [code],
    );

    if (orderByNo.length > 0) {
      orderId = orderByNo[0].id;
    } else {
      // 尝试按 ID 查询
      orderId = parseInt(code);
      if (isNaN(orderId)) {
        throw new NotFoundException(`Traceability code "${code}" not found`);
      }
    }

    // 1. 查询订单基本信息 + 客户信息
    const orderRows = await this.dataSource.query(
      `SELECT 
        o.id, o.order_no, o.total_amount, o.status, o.order_date,
        o.delivery_address, o.delivery_date, o.created_at,
        c.name AS customer_name, c.contact AS customer_contact,
        c.phone AS customer_phone, c.address AS customer_address
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?`,
      [orderId],
    );

    if (orderRows.length === 0) {
      throw new NotFoundException(`Order with code "${code}" not found`);
    }

    const order = orderRows[0];

    // 2. 查询订单项
    const items = await this.dataSource.query(
      `SELECT product_name, sku, unit_price, quantity, subtotal
      FROM order_items WHERE order_id = ?`,
      [orderId],
    );

    // 3. 查询生产批次信息（通过订单关联的产品匹配批次）
    const productionPlans = await this.dataSource.query(
      `SELECT 
        pp.batch_no, pp.product_name, pp.planned_quantity, pp.actual_quantity,
        pp.raw_material, pp.raw_material_batch, pp.production_date, pp.expiry_date,
        pp.quality_inspector, pp.quality_result
      FROM production_plans pp
      WHERE pp.production_date <= ? 
        AND pp.expiry_date >= ?
      ORDER BY pp.production_date DESC
      LIMIT 5`,
      [order.order_date, order.order_date],
    );

    // 4. 查询配送记录
    const deliveryRecords = await this.dataSource.query(
      `SELECT 
        dr.driver_id, dr.driver_name, dr.vehicle_no,
        dr.departure_time, dr.arrival_time, dr.temperature, dr.status
      FROM delivery_records dr
      WHERE dr.order_id = ?`,
      [orderId],
    );

    return {
      order: {
        id: order.id,
        orderNo: order.order_no,
        totalAmount: Number(order.total_amount),
        status: order.status,
        orderDate: order.order_date,
        deliveryAddress: order.delivery_address,
        deliveryDate: order.delivery_date,
        createdAt: order.created_at,
      },
      customer: {
        name: order.customer_name,
        contact: order.customer_contact,
        phone: order.customer_phone,
        address: order.customer_address,
      },
      items: items.map((item: any) => ({
        productName: item.product_name,
        sku: item.sku,
        unitPrice: Number(item.unit_price),
        quantity: Number(item.quantity),
        subtotal: Number(item.subtotal),
      })),
      production: productionPlans.map((pp: any) => ({
        batchNo: pp.batch_no,
        productName: pp.product_name,
        plannedQuantity: Number(pp.planned_quantity),
        actualQuantity: Number(pp.actual_quantity),
        rawMaterial: pp.raw_material,
        rawMaterialBatch: pp.raw_material_batch,
        productionDate: pp.production_date,
        expiryDate: pp.expiry_date,
        qualityInspector: pp.quality_inspector,
        qualityResult: pp.quality_result,
      })),
      logistics: deliveryRecords.map((dr: any) => ({
        driverId: dr.driver_id,
        driverName: dr.driver_name,
        vehicleNo: dr.vehicle_no,
        departureTime: dr.departure_time,
        arrivalTime: dr.arrival_time,
        temperature: dr.temperature ? Number(dr.temperature) : null,
        status: dr.status,
      })),
    };
  }
}
