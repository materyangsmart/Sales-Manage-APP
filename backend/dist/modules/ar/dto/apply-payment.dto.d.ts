export declare class ApplyItemDto {
    invoiceId: number;
    appliedAmount: number;
}
export declare class ApplyPaymentDto {
    orgId: number;
    paymentId: number;
    applies: ApplyItemDto[];
    operatorId: number;
    remark?: string;
}
