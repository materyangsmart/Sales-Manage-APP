import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import { CreateOrderDto, ReviewOrderDto, QueryOrdersDto } from '../dto/order.dto';
import { ARInvoice } from '../../ar/entities/ar-invoice.entity';
import { AuditLog } from '../../ar/entities/audit-log.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(ARInvoice)
    private arInvoiceRepository: Repository<ARInvoice>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
  ) {}

  /**
   * 创建订单（内部用）
   */
  async createOrder(dto: CreateOrderDto) {
    // 验证客户存在
    const customer = await this.customerRepository.findOne({
      where: { id: dto.customerId, orgId: dto.orgId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.status !== 'ACTIVE') {
      throw new BadRequestException('Customer is not active');
    }

    // 验证产品并计算总金额
    let totalAmount = 0;
    const orderItemsData: Array<{
      productId: number;
      productName: string;
      sku: string;
      unitPrice: number;
      quantity: number;
      subtotal: number;
      remark?: string;
    }> = [];

    for (const item of dto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId, orgId: dto.orgId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (product.status !== 'ACTIVE') {
        throw new BadRequestException(`Product ${product.productName} is not active`);
      }

      const subtotal = product.unitPrice * item.quantity;
      totalAmount += subtotal;

      orderItemsData.push({
        productId: product.id,
        productName: product.productName,
        sku: product.sku,
        unitPrice: product.unitPrice,
        quantity: item.quantity,
        subtotal,
        remark: item.remark,
      });
    }

    // 生成订单编号
    const orderNo = await this.generateOrderNo(dto.orgId);

    // 使用事务创建订单和订单项
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 创建订单
      const order = this.orderRepository.create({
        orgId: dto.orgId,
        orderNo,
        customerId: dto.customerId,
        totalAmount,
        status: 'PENDING_REVIEW',
        orderDate: new Date(dto.orderDate),
        deliveryAddress: dto.deliveryAddress,
        deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
        remark: dto.remark,
        createdBy: dto.createdBy,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 创建订单项
      const orderItems = orderItemsData.map((itemData) =>
        this.orderItemRepository.create({
          orderId: savedOrder.id,
          ...itemData,
        }),
      );

      await queryRunner.manager.save(orderItems);

      await queryRunner.commitTransaction();

      // 返回完整的订单（包含订单项）
      return this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['items'],
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 审核订单（approve/reject）
   */
  async reviewOrder(dto: ReviewOrderDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Order is not pending review');
    }

    // 更新订单状态
    order.status = dto.action;
    order.reviewedBy = dto.reviewedBy ?? null;
    order.reviewedAt = new Date();
    order.reviewComment = dto.comment ?? null;

    await this.orderRepository.save(order);

    // 如果批准，可以触发生成发票的逻辑（未来扩展）
    if (dto.action === 'APPROVED') {
      // TODO: 触发生成发票
      // await this.generateInvoice(order);
    }

    return order;
  }

  /**
   * 查询订单（分页、过滤）
   */
  async queryOrders(dto: QueryOrdersDto) {
    const { orgId, customerId, status, startDate, endDate, page = 1, pageSize = 20 } = dto;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.orgId = :orgId', { orgId });

    if (customerId) {
      queryBuilder.andWhere('order.customerId = :customerId', { customerId });
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('order.orderDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      queryBuilder.andWhere('order.orderDate >= :startDate', {
        startDate: new Date(startDate),
      });
    } else if (endDate) {
      queryBuilder.andWhere('order.orderDate <= :endDate', {
        endDate: new Date(endDate),
      });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const skip = (page - 1) * pageSize;
    queryBuilder.skip(skip).take(pageSize);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderById(id: number) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * 获取可用的生产批次列表（用于发货时选择）
   * 返回当前有效的、质检通过的生产批次
   */
  async getAvailableBatches() {
    const rows = await this.dataSource.query(`
      SELECT pp.batch_no, pp.product_name, pp.production_date, pp.expiry_date,
             pp.actual_quantity, pp.quality_inspector, pp.quality_result,
             pp.raw_material, pp.raw_material_batch,
             (SELECT COUNT(*) FROM orders o WHERE o.batch_no = pp.batch_no AND o.status = 'FULFILLED') as used_count
      FROM production_plans pp
      WHERE pp.quality_result = 'PASS'
        AND pp.expiry_date >= CURDATE()
      ORDER BY pp.production_date DESC
      LIMIT 200
    `);
    return rows;
  }

  /**
   * 生成订单编号
   */
  private async generateOrderNo(orgId: number): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // 查询今天的订单数量（使用TypeORM标准Like()）
    const count = await this.orderRepository.count({
      where: {
        orgId,
        orderNo: Like(`ORD-${dateStr}-%`),
      },
    });

    const seq = (count + 1).toString().padStart(4, '0');
    return `ORD-${dateStr}-${seq}`;
  }

  /**
   * 履行订单（fulfill）
   * 
   * P29关键修复：发货时必须传入明确的 batchNo 参数
   * 后端校验 batchNo 在 production_plans 表中真实存在
   * 
   * 生成应收发票并写入审计日志
   */
  async fulfillOrder(orderId: number, userId: number, batchNo: string) {
    // ===== P29: 强制校验 batchNo 参数 =====
    if (!batchNo || batchNo.trim() === '') {
      throw new BadRequestException(
        '发货必须指定生产批次号（batchNo），不允许空值。请从生产计划中选择有效批次。'
      );
    }

    // 校验 batchNo 在 production_plans 表中真实存在
    const batchRows = await this.dataSource.query(
      `SELECT id, batch_no, product_name, quality_result, expiry_date 
       FROM production_plans WHERE batch_no = ?`,
      [batchNo.trim()],
    );

    if (!batchRows || batchRows.length === 0) {
      throw new BadRequestException(
        `生产批次号 ${batchNo} 在 production_plans 表中不存在，拒绝发货。`
      );
    }

    const batchInfo = batchRows[0];

    // 校验质检结果必须为 PASS
    if (batchInfo.quality_result !== 'PASS') {
      throw new BadRequestException(
        `生产批次 ${batchNo} 质检结果为 ${batchInfo.quality_result}，只有 PASS 的批次才能发货。`
      );
    }

    // 校验批次未过期
    if (new Date(batchInfo.expiry_date) < new Date()) {
      throw new BadRequestException(
        `生产批次 ${batchNo} 已过期（${batchInfo.expiry_date}），不允许发货。`
      );
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === 'FULFILLED') {
      throw new BadRequestException('Order has already been fulfilled');
    }

    if (order.status !== 'APPROVED') {
      throw new BadRequestException('Only approved orders can be fulfilled');
    }

    // 使用事务：更新订单状态 + 写入batch_no + 生成发票 + 写审计日志
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 0. 写入精确的 batch_no 到 orders 表
      await queryRunner.query(
        `UPDATE orders SET batch_no = ? WHERE id = ?`,
        [batchNo.trim(), orderId],
      );

      // 1. 更新订单状态为FULFILLED
      const oldStatus = order.status;
      order.status = 'FULFILLED';
      order.fulfilledAt = new Date();
      order.fulfilledBy = userId;

      await queryRunner.manager.save(order);

      // 2. 生成应收发票
      const invoiceNo = await this.generateInvoiceNo(order.orgId);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 默认30天账期

      const invoice = this.arInvoiceRepository.create({
        orgId: order.orgId,
        customerId: order.customerId,
        invoiceNo,
        orderId: order.id,
        amount: order.totalAmount,
        taxAmount: 0,
        balance: order.totalAmount,
        dueDate,
        status: 'OPEN',
        remark: `Generated from order ${order.orderNo} (batch: ${batchNo})`,
      });

      const savedInvoice = await queryRunner.manager.save(invoice);

      // 3. 写审计日志
      const auditLog = this.auditLogRepository.create({
        userId,
        action: 'FULFILL',
        resourceType: 'Order',
        resourceId: order.id.toString(),
        oldValue: JSON.stringify({
          status: oldStatus,
          fulfilledAt: null,
          fulfilledBy: null,
          batchNo: null,
        }),
        newValue: JSON.stringify({
          status: 'FULFILLED',
          fulfilledAt: order.fulfilledAt,
          fulfilledBy: order.fulfilledBy,
          batchNo: batchNo,
          batchProductName: batchInfo.product_name,
          batchQualityResult: batchInfo.quality_result,
          generatedInvoice: {
            invoiceId: savedInvoice.id,
            invoiceNo: savedInvoice.invoiceNo,
            amount: savedInvoice.amount,
          },
        }),
        ipAddress: '127.0.0.1',
        userAgent: 'Internal API',
      });

      await queryRunner.manager.save(auditLog);

      await queryRunner.commitTransaction();

      // 返回订单和发票信息
      return {
        order: { ...order, batchNo },
        invoice: savedInvoice,
        batchInfo: {
          batchNo: batchInfo.batch_no,
          productName: batchInfo.product_name,
          qualityResult: batchInfo.quality_result,
          expiryDate: batchInfo.expiry_date,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 生成发票编号
   */
  private async generateInvoiceNo(orgId: number): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // 查询今天的发票数量（使用TypeORM标准Like()）
    const count = await this.arInvoiceRepository.count({
      where: {
        orgId,
        invoiceNo: Like(`INV-${dateStr}-%`),
      },
    });

    const seq = (count + 1).toString().padStart(4, '0');
    return `INV-${dateStr}-${seq}`;
  }
}
