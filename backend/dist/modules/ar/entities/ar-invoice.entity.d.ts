export declare class ARInvoice {
    id: number;
    orgId: number;
    customerId: number;
    invoiceNo: string;
    orderId: number | null;
    amount: number;
    taxAmount: number;
    balance: number;
    dueDate: Date;
    status: string;
    remark: string | null;
    createdAt: Date;
    updatedAt: Date;
    version: number;
}
