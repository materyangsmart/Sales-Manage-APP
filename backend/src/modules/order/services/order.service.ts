import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import { CreateOrderDto, ReviewOrderDto, QueryOrdersDto } from '../dto/order.dto';
import { ARInvoice } from '../../ar/entities/ar-invoice.entity';
import { AuditLog } from '../../../common/entities/audit-log.entity';

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
    const orderItemsData = [];

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
    order.reviewedBy = dto.reviewedBy;
    order.reviewedAt = new Date();
    order.reviewComment = dto.comment;

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
   * 生成订单编号
   */
  private async generateOrderNo(orgId: number): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // 查询今天的订单数量
    const count = await this.orderRepository.count({
      where: {
        orgId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        orderNo: { $like: `ORD-${dateStr}-%` } as any,
      },
    });

    const seq = (count + 1).toString().padStart(4, '0');
    return `ORD-${dateStr}-${seq}`;
  }
}

  /**
   * 履行订单（fulfill）
   * 生成应收发票并写入审计日志
   */
  async fulfillOrder(orderId: number, userId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'APPROVED') {
      throw new BadRequestException('Only approved orders can be fulfilled');
    }

    if (order.status === 'FULFILLED') {
      throw new BadRequestException('Order has already been fulfilled');
    }

    // 使用事务：更新订单状态 + 生成发票 + 写审计日志
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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
        taxAmount: 0, // 暂时不考虑税额
        balance: order.totalAmount,
        dueDate,
        status: 'OPEN',
        remark: `Generated from order ${order.orderNo}`,
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
        }),
        newValue: JSON.stringify({
          status: 'FULFILLED',
          fulfilledAt: order.fulfilledAt,
          fulfilledBy: order.fulfilledBy,
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
        order,
        invoice: savedInvoice,
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

    // 查询今天的发票数量
    const count = await this.arInvoiceRepository.count({
      where: {
        orgId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        invoiceNo: { $like: `INV-${dateStr}-%` } as any,
      },
    });

    const seq = (count + 1).toString().padStart(4, '0');
    return `INV-${dateStr}-${seq}`;
  }
