export declare class CreatePaymentDto {
    orgId: number;
    customerId: number;
    bankRef: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    receiptUrl?: string;
    remark?: string;
    createdBy: number;
}
