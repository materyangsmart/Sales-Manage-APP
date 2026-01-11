/**
 * AR相关类型定义
 */

export interface ARPayment {
  id: number;
  paymentNo: string;
  orgId: number;
  customerId: number;
  amount: number; // 单位：分
  unappliedAmount: number; // 单位：分
  status: 'UNAPPLIED' | 'PARTIAL' | 'CLOSED';
  paymentDate: string; // ISO8601格式
  paymentMethod: string;
  bankRef: string;
  receiptUrl?: string;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ARInvoice {
  id: number;
  invoiceNo: string;
  orgId: number;
  customerId: number;
  amount: number; // 单位：分
  balance: number; // 单位：分
  dueDate: string;
  status: 'OPEN' | 'PARTIAL' | 'CLOSED' | 'WRITTEN_OFF';
  createdAt: string;
}

export interface ApplyItem {
  invoiceId: number;
  appliedAmount: number; // 单位：分
}

export interface ApplyPaymentRequest {
  orgId: number;
  paymentId: number;
  applies: ApplyItem[];
  operatorId: number;
  remark?: string;
}

export interface ApplyPaymentResponse {
  paymentNo: string;
  totalApplied: number;
  unappliedAmount: number;
  paymentStatus: string;
  appliedInvoices: Array<{
    invoiceNo: string;
    appliedAmount: number;
    beforeBalance: number;
    afterBalance: number;
    status: string;
  }>;
}

export interface PaymentListParams {
  orgId: number;
  status?: 'UNAPPLIED' | 'PARTIAL' | 'CLOSED';
  customerId?: number;
  dateFrom?: string;
  dateTo?: string;
  method?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentListResponse {
  items: ARPayment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
