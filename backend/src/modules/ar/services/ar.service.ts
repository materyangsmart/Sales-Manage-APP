import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ARInvoice } from '../entities/ar-invoice.entity';
import { ARPayment } from '../entities/ar-payment.entity';
import { ARApply } from '../entities/ar-apply.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApplyPaymentDto } from '../dto/apply-payment.dto';
import { GetSummaryDto } from '../dto/get-summary.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
import { assertSameOrg } from '../../../common/guards/org-isolation.guard';

@Injectable()
export class ARService {
  constructor(
    @InjectRepository(ARInvoice)
    private invoiceRepository: Repository<ARInvoice>,
    @InjectRepository(ARPayment)
    private paymentRepository: Repository<ARPayment>,
    @InjectRepository(ARApply)
    private applyRepository: Repository<ARApply>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private dataSource: DataSource,
  ) {}

  /**
   * 创建收款单
   */
  async createPayment(
    dto: CreatePaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    // 检查银行流水号是否已存在
    const existing = await this.paymentRepository.findOne({
      where: { bankRef: dto.bankRef },
    });

    if (existing) {
      throw new ConflictException(
        `Bank reference ${dto.bankRef} already exists`,
      );
    }

    // Org隔离校验：确保所有操作都在同一组织内
    // 这里只是一个示例，实际应该从请求上下文中获取用户的orgId
    // 并与 dto.orgId 进行比对

    // 生成收款单号
    const paymentNo = `PAY${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const payment = this.paymentRepository.create({
      orgId: dto.orgId,
      customerId: dto.customerId,
      paymentNo,
      bankRef: dto.bankRef,
      amount: dto.amount,
      unappliedAmount: dto.amount,
      paymentDate: new Date(dto.paymentDate),
      paymentMethod: dto.paymentMethod,
      receiptUrl: dto.receiptUrl || null,
      remark: dto.remark || null,
      createdBy: dto.createdBy,
      status: 'UNAPPLIED',
    });

    const saved = await this.paymentRepository.save(payment);

    // 记录审计日志
    await this.auditLogRepository.save({
      userId: dto.createdBy,
      action: 'CREATE',
      resourceType: 'AR_PAYMENT',
      resourceId: saved.id.toString(),
      newValue: saved,
      ipAddress,
      userAgent,
    });

    return {
      id: saved.id,
      paymentNo: saved.paymentNo,
      amount: saved.amount,
      unappliedAmount: saved.unappliedAmount,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  /**
   * 核销收款
   */
  async applyPayment(
    dto: ApplyPaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 查询收款单（加悲观锁）
      const payment = await queryRunner.manager.findOne(ARPayment, {
        where: { id: dto.paymentId, orgId: dto.orgId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException(`Payment ${dto.paymentId} not found`);
      }

      // 1.5 验证跨客户防篡改：所有应收单必须属于同一客户
      const invoiceIds = dto.applies.map((a) => a.invoiceId);
      const invoiceCustomerCheck = await queryRunner.manager
        .createQueryBuilder(ARInvoice, 'invoice')
        .select('COUNT(DISTINCT invoice.customer_id)', 'distinctCount')
        .where('invoice.id IN (:...invoiceIds)', { invoiceIds })
        .andWhere('invoice.org_id = :orgId', { orgId: dto.orgId })
        .getRawOne();

      if (
        !invoiceCustomerCheck ||
        parseInt(invoiceCustomerCheck.distinctCount) !== 1
      ) {
        throw new BadRequestException('所有应收单必须属于同一客户');
      }

      // 验证收款单与应收单客户一致
      const firstInvoice = await queryRunner.manager.findOne(ARInvoice, {
        where: { id: invoiceIds[0], orgId: dto.orgId },
      });

      if (!firstInvoice) {
        throw new NotFoundException('应收单不存在');
      }

      if (payment.customerId !== firstInvoice.customerId) {
        throw new BadRequestException(
          '收款单与应收单客户不一致，禁止跨客户核销',
        );
      }

      // Org隔离校验：确保收款单和应收单都属于请求的orgId
      assertSameOrg(payment, dto.orgId);
      assertSameOrg(firstInvoice, dto.orgId);

      // 2. 计算总核销金额
      const totalApplied = dto.applies.reduce(
        (sum, item) => sum + item.appliedAmount,
        0,
      );

      if (totalApplied > payment.unappliedAmount) {
        throw new BadRequestException(
          `Total applied amount ${totalApplied} exceeds unapplied amount ${payment.unappliedAmount}`,
        );
      }

      // 3. 逐个核销应收单
      const appliedInvoices: Array<{
        invoiceNo: string;
        appliedAmount: number;
        beforeBalance: number;
        afterBalance: number;
        status: string;
      }> = [];
      for (const applyItem of dto.applies) {
        // 检查是否已核销过（防止重复）
        const existingApply = await queryRunner.manager.findOne(ARApply, {
          where: {
            paymentId: dto.paymentId,
            invoiceId: applyItem.invoiceId,
          },
        });

        if (existingApply) {
          throw new ConflictException(
            `Payment ${dto.paymentId} already applied to invoice ${applyItem.invoiceId}`,
          );
        }

        // 查询应收单（加悲观锁）
        const invoice = await queryRunner.manager.findOne(ARInvoice, {
          where: { id: applyItem.invoiceId, orgId: dto.orgId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!invoice) {
          throw new NotFoundException(
            `Invoice ${applyItem.invoiceId} not found`,
          );
        }

        if (applyItem.appliedAmount > invoice.balance) {
          throw new BadRequestException(
            `Applied amount ${applyItem.appliedAmount} exceeds invoice balance ${invoice.balance}`,
          );
        }

        // 创建核销记录
        const apply = queryRunner.manager.create(ARApply, {
          orgId: dto.orgId,
          paymentId: dto.paymentId,
          invoiceId: applyItem.invoiceId,
          appliedAmount: applyItem.appliedAmount,
          operatorId: dto.operatorId,
          remark: dto.remark || null,
        });

        await queryRunner.manager.save(ARApply, apply);

        // 更新应收单余额和状态（使用乐观锁）
        const newBalance = invoice.balance - applyItem.appliedAmount;
        const newStatus = newBalance === 0 ? 'CLOSED' : 'PARTIAL';

        const updateResult = await queryRunner.manager.update(
          ARInvoice,
          { id: invoice.id, version: invoice.version },
          {
            balance: newBalance,
            status: newStatus,
            version: invoice.version + 1,
          },
        );

        if (updateResult.affected === 0) {
          throw new ConflictException(
            `Invoice ${invoice.id} was modified by another transaction`,
          );
        }

        appliedInvoices.push({
          invoiceNo: invoice.invoiceNo,
          appliedAmount: applyItem.appliedAmount,
          beforeBalance: invoice.balance,
          afterBalance: newBalance,
          status: newStatus,
        });
      }

      // 4. 更新收款单未核销金额和状态（使用乐观锁）
      const newUnappliedAmount = payment.unappliedAmount - totalApplied;
      const newPaymentStatus = newUnappliedAmount === 0 ? 'APPLIED' : 'PARTIAL';

      const updateResult = await queryRunner.manager.update(
        ARPayment,
        { id: payment.id, version: payment.version },
        {
          unappliedAmount: newUnappliedAmount,
          status: newPaymentStatus,
          version: payment.version + 1,
        },
      );

      if (updateResult.affected === 0) {
        throw new ConflictException(
          `Payment ${payment.id} was modified by another transaction`,
        );
      }

      // 5. 记录审计日志
      await queryRunner.manager.save(AuditLog, {
        userId: dto.operatorId,
        action: 'APPLY',
        resourceType: 'AR_PAYMENT',
        resourceId: payment.id.toString(),
        oldValue: {
          unappliedAmount: payment.unappliedAmount,
          status: payment.status,
        },
        newValue: {
          unappliedAmount: newUnappliedAmount,
          status: newPaymentStatus,
        },
        ipAddress,
        userAgent,
      });

      await queryRunner.commitTransaction();

      return {
        paymentNo: payment.paymentNo,
        totalApplied,
        unappliedAmount: newUnappliedAmount,
        paymentStatus: newPaymentStatus,
        appliedInvoices,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 查询收款单列表
   */
  async listPayments(dto: ListPaymentsDto) {
    const queryBuilder = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.org_id = :orgId', { orgId: dto.orgId });

    // 状态筛选
    if (dto.status) {
      queryBuilder.andWhere('payment.status = :status', { status: dto.status });
    }

    // 客户筛选
    if (dto.customerId) {
      queryBuilder.andWhere('payment.customer_id = :customerId', {
        customerId: dto.customerId,
      });
    }

    // 日期范围筛选
    if (dto.dateFrom) {
      queryBuilder.andWhere('payment.payment_date >= :dateFrom', {
        dateFrom: dto.dateFrom,
      });
    }
    if (dto.dateTo) {
      queryBuilder.andWhere('payment.payment_date <= :dateTo', {
        dateTo: dto.dateTo,
      });
    }

    // 支付方式筛选
    if (dto.method) {
      queryBuilder.andWhere('payment.payment_method = :method', {
        method: dto.method,
      });
    }

    // 排序：默认按到账时间倒序
    queryBuilder.orderBy('payment.payment_date', 'DESC');

    // 分页
    const page = dto.page || 1;
    const pageSize = dto.pageSize || 20;
    const skip = (page - 1) * pageSize;

    queryBuilder.skip(skip).take(pageSize);

    // 执行查询
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
   * 获取AR汇总信息
   */
  async getSummary(dto: GetSummaryDto) {
    const whereCondition: { orgId: number; customerId?: number } = {
      orgId: dto.orgId,
    };
    if (dto.customerId) {
      whereCondition.customerId = dto.customerId;
    }

    // 1. 账龄分析
    const today = new Date();
    const invoices = await this.invoiceRepository.find({
      where: whereCondition,
      select: ['balance', 'dueDate', 'status'],
    });

    const aging = {
      current: 0, // 未到期
      days0to30: 0, // 逾期0-30天
      days31to60: 0, // 逾期31-60天
      days61to90: 0, // 逾期61-90天
      days90plus: 0, // 逾期90天以上
    };

    let totalBalance = 0;
    let overdueBalance = 0;

    invoices.forEach((invoice) => {
      if (invoice.status === 'CLOSED' || invoice.status === 'WRITTEN_OFF') {
        return;
      }

      totalBalance += invoice.balance;

      const dueDate = new Date(invoice.dueDate);
      const overdueDays = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (overdueDays < 0) {
        aging.current += invoice.balance;
      } else if (overdueDays <= 30) {
        aging.days0to30 += invoice.balance;
        overdueBalance += invoice.balance;
      } else if (overdueDays <= 60) {
        aging.days31to60 += invoice.balance;
        overdueBalance += invoice.balance;
      } else if (overdueDays <= 90) {
        aging.days61to90 += invoice.balance;
        overdueBalance += invoice.balance;
      } else {
        aging.days90plus += invoice.balance;
        overdueBalance += invoice.balance;
      }
    });

    // 2. 近到期应收（未来7天到期）
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const upcomingDue = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.org_id = :orgId', { orgId: dto.orgId })
      .andWhere('invoice.due_date BETWEEN :today AND :sevenDaysLater', {
        today: today.toISOString().split('T')[0],
        sevenDaysLater: sevenDaysLater.toISOString().split('T')[0],
      })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['OPEN', 'PARTIAL'],
      })
      .select('SUM(invoice.balance)', 'total')
      .addSelect('COUNT(invoice.id)', 'count')
      .getRawOne();

    return {
      totalBalance,
      overdueBalance,
      aging,
      upcomingDue: {
        amount: parseInt(upcomingDue?.total || '0') || 0,
        count: parseInt(upcomingDue?.count || '0') || 0,
      },
    };
  }

  /**
   * 查询应收发票（分页）
   */
  async queryInvoices(dto: any) {
    const {
      orgId,
      customerId,
      status,
      orderId,
      page = 1,
      pageSize = 20,
    } = dto;

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.orgId = :orgId', { orgId });

    if (customerId) {
      qb.andWhere('invoice.customerId = :customerId', { customerId });
    }

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    if (orderId) {
      qb.andWhere('invoice.orderId = :orderId', { orderId });
    }

    qb.orderBy('invoice.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
