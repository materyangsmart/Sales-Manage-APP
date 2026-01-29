/**
 * Backend API Client
 * 
 * 连接到Sales-Manage-APP backend的internal接口
 * 使用internal token进行身份验证
 */

// Backend API base URL（从环境变量读取，开发环境默认localhost:3000）
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// Internal token（从环境变量读取）
const INTERNAL_TOKEN = import.meta.env.VITE_INTERNAL_TOKEN || 'Bearer test-internal-token';

/**
 * 通用请求函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': INTERNAL_TOKEN,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * GET请求
 */
export async function get<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'GET' });
}

/**
 * POST请求
 */
export async function post<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * PUT请求
 */
export async function put<T>(endpoint: string, data?: unknown): Promise<T> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * DELETE请求
 */
export async function del<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' });
}

// ============================================
// 类型定义
// ============================================

export type OrderStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'FULFILLED';
export type InvoiceStatus = 'OPEN' | 'CLOSED';
export type PaymentStatus = 'UNAPPLIED' | 'PARTIAL' | 'APPLIED';

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
  status: PaymentStatus;
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
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// API函数
// ============================================

// 订单相关
export const orderApi = {
  list: (params?: { status?: OrderStatus; page?: number; pageSize?: number }) => 
    get<PaginatedResponse<Order>>(`/internal/orders?${new URLSearchParams(params as Record<string, string>)}`),
  
  getById: (id: number) => 
    get<Order>(`/internal/orders/${id}`),
  
  review: (id: number, data: { action: 'APPROVE' | 'REJECT'; reviewComment?: string }) => 
    post<Order>(`/internal/orders/${id}/review`, data),
  
  fulfill: (id: number) => 
    post<Order>(`/internal/orders/${id}/fulfill`),
};

// AR发票相关
export const invoiceApi = {
  list: (params?: { status?: InvoiceStatus; orgId?: number; page?: number; pageSize?: number }) => 
    get<PaginatedResponse<Invoice>>(`/internal/ar/invoices?${new URLSearchParams(params as Record<string, string>)}`),
  
  getById: (id: number) => 
    get<Invoice>(`/internal/ar/invoices/${id}`),
};

// AR收款相关
export const paymentApi = {
  list: (params?: { status?: PaymentStatus; orgId?: number; page?: number; pageSize?: number }) => 
    get<PaginatedResponse<Payment>>(`/internal/ar/payments?${new URLSearchParams(params as Record<string, string>)}`),
  
  getById: (id: number) => 
    get<Payment>(`/internal/ar/payments/${id}`),
  
  apply: (id: number, data: { invoiceId: number; appliedAmount: number }) => 
    post<Payment>(`/internal/ar/payments/${id}/apply`, data),
};

// 审计日志相关
export const auditLogApi = {
  list: (params?: { 
    resourceType?: string; 
    resourceId?: number; 
    action?: string; 
    startDate?: string; 
    endDate?: string;
    page?: number; 
    pageSize?: number;
  }) => 
    get<PaginatedResponse<AuditLog>>(`/internal/audit-logs?${new URLSearchParams(params as Record<string, string>)}`),
  
  trace: (resourceType: string, resourceId: number) => 
    get<AuditLog[]>(`/internal/audit-logs/trace?resourceType=${resourceType}&resourceId=${resourceId}`),
};
