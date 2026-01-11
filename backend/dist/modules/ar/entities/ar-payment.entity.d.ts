export declare class ARPayment {
    id: number;
    orgId: number;
    customerId: number;
    paymentNo: string;
    bankRef: string;
    amount: number;
    unappliedAmount: number;
    paymentDate: Date;
    paymentMethod: string;
    status: string;
    receiptUrl: string | null;
    remark: string | null;
    createdBy: number;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
