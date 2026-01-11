export declare class AuditLog {
    id: number;
    userId: number | null;
    action: string;
    resourceType: string;
    resourceId: string;
    oldValue: any;
    newValue: any;
    ipAddress: string | null;
    userAgent: string | null;
    idempotencyKey: string | null;
    responseData: any;
    createdAt: Date;
}
