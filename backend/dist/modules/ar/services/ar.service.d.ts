import { Repository, DataSource } from 'typeorm';
import { ARInvoice } from '../entities/ar-invoice.entity';
import { ARPayment } from '../entities/ar-payment.entity';
import { ARApply } from '../entities/ar-apply.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApplyPaymentDto } from '../dto/apply-payment.dto';
import { GetSummaryDto } from '../dto/get-summary.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
export declare class ARService {
    private invoiceRepository;
    private paymentRepository;
    private applyRepository;
    private auditLogRepository;
    private dataSource;
    constructor(invoiceRepository: Repository<ARInvoice>, paymentRepository: Repository<ARPayment>, applyRepository: Repository<ARApply>, auditLogRepository: Repository<AuditLog>, dataSource: DataSource);
    createPayment(dto: CreatePaymentDto, ipAddress?: string, userAgent?: string): Promise<{
        id: number;
        paymentNo: string;
        amount: number;
        unappliedAmount: number;
        status: string;
        createdAt: Date;
    }>;
    applyPayment(dto: ApplyPaymentDto, ipAddress?: string, userAgent?: string): Promise<{
        paymentNo: string;
        totalApplied: number;
        unappliedAmount: number;
        paymentStatus: string;
        appliedInvoices: {
            invoiceNo: string;
            appliedAmount: number;
            beforeBalance: number;
            afterBalance: number;
            status: string;
        }[];
    }>;
    listPayments(dto: ListPaymentsDto): Promise<{
        items: ARPayment[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }>;
    getSummary(dto: GetSummaryDto): Promise<{
        totalBalance: number;
        overdueBalance: number;
        aging: {
            current: number;
            days0to30: number;
            days31to60: number;
            days61to90: number;
            days90plus: number;
        };
        upcomingDue: {
            amount: number;
            count: number;
        };
    }>;
}
