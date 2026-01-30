/**
 * 共享类型定义
 */

export type OrderStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FULFILLED';
export type InvoiceStatus = 'OPEN' | 'CLOSED';
export type PaymentAppliedStatus = 'UNAPPLIED' | 'PARTIAL' | 'APPLIED';

export interface Order {
  id: number;
  orderNo: string;
  customerId: number;
  customerName?: string;
  orgId: number;
  orderDate: string;
  totalAmount: number;
  status: OrderStatus;
  reviewComment?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  fulfilledBy?: number;
  fulfilledAt?: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  customerId: number;
  customerName?: string;
  orgId: number;
  orderId?: number;
  orderNo?: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balance: number;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  paymentNo: string;
  customerId: number;
  customerName?: string;
  orgId: number;
  paymentDate: string;
  amount: number;
  unappliedAmount: number;
  paymentMethod: string;
  appliedStatus: PaymentAppliedStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: number;
  resourceType: string;
  resourceId: number;
  action: string;
  userId: number;
  userName?: string;
  changes?: Record<string, unknown>;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
