import { ARService } from '../services/ar.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { ApplyPaymentDto } from '../dto/apply-payment.dto';
import { GetSummaryDto } from '../dto/get-summary.dto';
import { ListPaymentsDto } from '../dto/list-payments.dto';
import type { Request } from 'express';
export declare class ARController {
    private readonly arService;
    constructor(arService: ARService);
    createPayment(dto: CreatePaymentDto, req: Request): Promise<{
        id: number;
        paymentNo: string;
        amount: number;
        unappliedAmount: number;
        status: string;
        createdAt: Date;
    }>;
    applyPayment(dto: ApplyPaymentDto, req: Request): Promise<{
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
        items: import("../entities/ar-payment.entity").ARPayment[];
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
