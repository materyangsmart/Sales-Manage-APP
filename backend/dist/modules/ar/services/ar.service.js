"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ar_invoice_entity_1 = require("../entities/ar-invoice.entity");
const ar_payment_entity_1 = require("../entities/ar-payment.entity");
const ar_apply_entity_1 = require("../entities/ar-apply.entity");
const audit_log_entity_1 = require("../entities/audit-log.entity");
const org_isolation_guard_1 = require("../../../common/guards/org-isolation.guard");
let ARService = class ARService {
    invoiceRepository;
    paymentRepository;
    applyRepository;
    auditLogRepository;
    dataSource;
    constructor(invoiceRepository, paymentRepository, applyRepository, auditLogRepository, dataSource) {
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
        this.applyRepository = applyRepository;
        this.auditLogRepository = auditLogRepository;
        this.dataSource = dataSource;
    }
    async createPayment(dto, ipAddress, userAgent) {
        const existing = await this.paymentRepository.findOne({
            where: { bankRef: dto.bankRef },
        });
        if (existing) {
            throw new common_1.ConflictException(`Bank reference ${dto.bankRef} already exists`);
        }
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
    async applyPayment(dto, ipAddress, userAgent) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const payment = await queryRunner.manager.findOne(ar_payment_entity_1.ARPayment, {
                where: { id: dto.paymentId, orgId: dto.orgId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!payment) {
                throw new common_1.NotFoundException(`Payment ${dto.paymentId} not found`);
            }
            const invoiceIds = dto.applies.map((a) => a.invoiceId);
            const invoiceCustomerCheck = await queryRunner.manager
                .createQueryBuilder(ar_invoice_entity_1.ARInvoice, 'invoice')
                .select('COUNT(DISTINCT invoice.customer_id)', 'distinctCount')
                .where('invoice.id IN (:...invoiceIds)', { invoiceIds })
                .andWhere('invoice.org_id = :orgId', { orgId: dto.orgId })
                .getRawOne();
            if (!invoiceCustomerCheck ||
                parseInt(invoiceCustomerCheck.distinctCount) !== 1) {
                throw new common_1.BadRequestException('所有应收单必须属于同一客户');
            }
            const firstInvoice = await queryRunner.manager.findOne(ar_invoice_entity_1.ARInvoice, {
                where: { id: invoiceIds[0], orgId: dto.orgId },
            });
            if (!firstInvoice) {
                throw new common_1.NotFoundException('应收单不存在');
            }
            if (payment.customerId !== firstInvoice.customerId) {
                throw new common_1.BadRequestException('收款单与应收单客户不一致，禁止跨客户核销');
            }
            (0, org_isolation_guard_1.assertSameOrg)(payment, dto.orgId);
            (0, org_isolation_guard_1.assertSameOrg)(firstInvoice, dto.orgId);
            const totalApplied = dto.applies.reduce((sum, item) => sum + item.appliedAmount, 0);
            if (totalApplied > payment.unappliedAmount) {
                throw new common_1.BadRequestException(`Total applied amount ${totalApplied} exceeds unapplied amount ${payment.unappliedAmount}`);
            }
            const appliedInvoices = [];
            for (const applyItem of dto.applies) {
                const existingApply = await queryRunner.manager.findOne(ar_apply_entity_1.ARApply, {
                    where: {
                        paymentId: dto.paymentId,
                        invoiceId: applyItem.invoiceId,
                    },
                });
                if (existingApply) {
                    throw new common_1.ConflictException(`Payment ${dto.paymentId} already applied to invoice ${applyItem.invoiceId}`);
                }
                const invoice = await queryRunner.manager.findOne(ar_invoice_entity_1.ARInvoice, {
                    where: { id: applyItem.invoiceId, orgId: dto.orgId },
                    lock: { mode: 'pessimistic_write' },
                });
                if (!invoice) {
                    throw new common_1.NotFoundException(`Invoice ${applyItem.invoiceId} not found`);
                }
                if (applyItem.appliedAmount > invoice.balance) {
                    throw new common_1.BadRequestException(`Applied amount ${applyItem.appliedAmount} exceeds invoice balance ${invoice.balance}`);
                }
                const apply = queryRunner.manager.create(ar_apply_entity_1.ARApply, {
                    orgId: dto.orgId,
                    paymentId: dto.paymentId,
                    invoiceId: applyItem.invoiceId,
                    appliedAmount: applyItem.appliedAmount,
                    operatorId: dto.operatorId,
                    remark: dto.remark || null,
                });
                await queryRunner.manager.save(ar_apply_entity_1.ARApply, apply);
                const newBalance = invoice.balance - applyItem.appliedAmount;
                const newStatus = newBalance === 0 ? 'CLOSED' : 'PARTIAL';
                const updateResult = await queryRunner.manager.update(ar_invoice_entity_1.ARInvoice, { id: invoice.id, version: invoice.version }, {
                    balance: newBalance,
                    status: newStatus,
                    version: invoice.version + 1,
                });
                if (updateResult.affected === 0) {
                    throw new common_1.ConflictException(`Invoice ${invoice.id} was modified by another transaction`);
                }
                appliedInvoices.push({
                    invoiceNo: invoice.invoiceNo,
                    appliedAmount: applyItem.appliedAmount,
                    beforeBalance: invoice.balance,
                    afterBalance: newBalance,
                    status: newStatus,
                });
            }
            const newUnappliedAmount = payment.unappliedAmount - totalApplied;
            const newPaymentStatus = newUnappliedAmount === 0 ? 'APPLIED' : 'PARTIAL';
            const updateResult = await queryRunner.manager.update(ar_payment_entity_1.ARPayment, { id: payment.id, version: payment.version }, {
                unappliedAmount: newUnappliedAmount,
                status: newPaymentStatus,
                version: payment.version + 1,
            });
            if (updateResult.affected === 0) {
                throw new common_1.ConflictException(`Payment ${payment.id} was modified by another transaction`);
            }
            await queryRunner.manager.save(audit_log_entity_1.AuditLog, {
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
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async listPayments(dto) {
        const queryBuilder = this.paymentRepository
            .createQueryBuilder('payment')
            .where('payment.org_id = :orgId', { orgId: dto.orgId });
        if (dto.status) {
            queryBuilder.andWhere('payment.status = :status', { status: dto.status });
        }
        if (dto.customerId) {
            queryBuilder.andWhere('payment.customer_id = :customerId', {
                customerId: dto.customerId,
            });
        }
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
        if (dto.method) {
            queryBuilder.andWhere('payment.payment_method = :method', {
                method: dto.method,
            });
        }
        queryBuilder.orderBy('payment.payment_date', 'DESC');
        const page = dto.page || 1;
        const pageSize = dto.pageSize || 20;
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
    async getSummary(dto) {
        const whereCondition = {
            orgId: dto.orgId,
        };
        if (dto.customerId) {
            whereCondition.customerId = dto.customerId;
        }
        const today = new Date();
        const invoices = await this.invoiceRepository.find({
            where: whereCondition,
            select: ['balance', 'dueDate', 'status'],
        });
        const aging = {
            current: 0,
            days0to30: 0,
            days31to60: 0,
            days61to90: 0,
            days90plus: 0,
        };
        let totalBalance = 0;
        let overdueBalance = 0;
        invoices.forEach((invoice) => {
            if (invoice.status === 'CLOSED' || invoice.status === 'WRITTEN_OFF') {
                return;
            }
            totalBalance += invoice.balance;
            const dueDate = new Date(invoice.dueDate);
            const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (overdueDays < 0) {
                aging.current += invoice.balance;
            }
            else if (overdueDays <= 30) {
                aging.days0to30 += invoice.balance;
                overdueBalance += invoice.balance;
            }
            else if (overdueDays <= 60) {
                aging.days31to60 += invoice.balance;
                overdueBalance += invoice.balance;
            }
            else if (overdueDays <= 90) {
                aging.days61to90 += invoice.balance;
                overdueBalance += invoice.balance;
            }
            else {
                aging.days90plus += invoice.balance;
                overdueBalance += invoice.balance;
            }
        });
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
};
exports.ARService = ARService;
exports.ARService = ARService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ar_invoice_entity_1.ARInvoice)),
    __param(1, (0, typeorm_1.InjectRepository)(ar_payment_entity_1.ARPayment)),
    __param(2, (0, typeorm_1.InjectRepository)(ar_apply_entity_1.ARApply)),
    __param(3, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], ARService);
//# sourceMappingURL=ar.service.js.map