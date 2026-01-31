/**
 * Backend API Client
 * 
 * 用于server-side调用backend REST API
 * INTERNAL_SERVICE_TOKEN只在server端使用，不会暴露到前端
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

if (!INTERNAL_SERVICE_TOKEN) {
  console.warn('[Backend API] INTERNAL_SERVICE_TOKEN not configured');
}

/**
 * 通用请求函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${INTERNAL_SERVICE_TOKEN}`);
  headers.set('Content-Type', 'application/json');
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Backend API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }
  
  return response.json();
}

/**
 * Orders API
 */
export const ordersAPI = {
  /**
   * 获取订单列表
   */
  list: async (params: {
    orgId: number;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams({
      orgId: params.orgId.toString(),
      ...(params.status && { status: params.status }),
      ...(params.page && { page: params.page.toString() }),
      ...(params.pageSize && { pageSize: params.pageSize.toString() }),
    });
    
    return request<any>(`/internal/orders?${query}`);
  },
  
  /**
   * 审核订单（批准）
   */
  approve: async (orderId: number, remark?: string) => {
    return request<any>(`/internal/orders/${orderId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE', remark }),
    });
  },
  
  /**
   * 审核订单（拒绝）
   */
  reject: async (orderId: number, remark?: string) => {
    return request<any>(`/internal/orders/${orderId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REJECT', remark }),
    });
  },
  
  /**
   * 履行订单（生成发票）
   */
  fulfill: async (orderId: number) => {
    return request<any>(`/internal/orders/${orderId}/fulfill`, {
      method: 'POST',
    });
  },
};

/**
 * AR Invoices API
 */
export const invoicesAPI = {
  /**
   * 获取发票列表
   */
  list: async (params: {
    orgId: number;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams({
      orgId: params.orgId.toString(),
      ...(params.status && { status: params.status }),
      ...(params.page && { page: params.page.toString() }),
      ...(params.pageSize && { pageSize: params.pageSize.toString() }),
    });
    
    return request<any>(`/ar/invoices?${query}`);
  },
  
  /**
   * 获取发票详情
   */
  get: async (invoiceId: number) => {
    return request<any>(`/ar/invoices/${invoiceId}`);
  },
};

/**
 * AR Payments API
 */
export const paymentsAPI = {
  /**
   * 获取收款列表
   */
  list: async (params: {
    orgId: number;
    appliedStatus?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams({
      orgId: params.orgId.toString(),
      ...(params.appliedStatus && { appliedStatus: params.appliedStatus }),
      ...(params.page && { page: params.page.toString() }),
      ...(params.pageSize && { pageSize: params.pageSize.toString() }),
    });
    
    return request<any>(`/ar/payments?${query}`);
  },
  
  /**
   * 获取收款详情
   */
  get: async (paymentId: number) => {
    return request<any>(`/ar/payments/${paymentId}`);
  },
};

/**
 * AR Apply API
 */
export const applyAPI = {
  /**
   * 核销收款到发票
   */
  apply: async (params: {
    paymentId: number;
    invoiceId: number;
    appliedAmount: number;
  }) => {
    return request<any>(`/ar/apply`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

/**
 * Audit Logs API
 */
export const auditLogsAPI = {
  /**
   * 获取审计日志列表
   */
  list: async (params: {
    page?: number;
    pageSize?: number;
    resourceType?: string;
    resourceId?: number;
    action?: string;
    startTime?: string;
    endTime?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page.toString());
    if (params.pageSize) query.set('pageSize', params.pageSize.toString());
    if (params.resourceType) query.set('resourceType', params.resourceType);
    if (params.resourceId) query.set('resourceId', params.resourceId.toString());
    if (params.action) query.set('action', params.action);
    if (params.startTime) query.set('startTime', params.startTime);
    if (params.endTime) query.set('endTime', params.endTime);
    
    return request<any>(`/audit-logs?${query}`);
  },
  
  /**
   * 追踪资源的审计链路
   */
  trace: async (resourceType: string, resourceId: number) => {
    const query = new URLSearchParams({
      resourceType,
      resourceId: resourceId.toString(),
    });
    
    return request<any>(`/audit-logs/trace?${query}`);
  },
};

/**
 * Server启动自检
 * 在server启动时调用，验证backend连接
 */
export async function healthCheck() {
  console.log('[Backend API] Health Check');
  console.log('[Backend API] BACKEND_URL:', BACKEND_URL);
  console.log('[Backend API] Token configured:', !!INTERNAL_SERVICE_TOKEN);
  
  try {
    // 探测请求：/ar/payments (简单查询，不需要特定参数)
    const probeUrl = `${BACKEND_URL}/ar/payments?orgId=1&page=1&pageSize=1`;
    console.log('[Backend API] Probing:', probeUrl);
    
    const response = await fetch(probeUrl, {
      headers: {
        'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[Backend API] Probe result:', response.status, response.statusText);
    
    if (response.ok) {
      console.log('[Backend API] ✓ Backend connection OK');
    } else {
      console.warn('[Backend API] ✗ Backend returned non-OK status:', response.status);
    }
  } catch (error) {
    console.error('[Backend API] ✗ Backend connection failed:', error);
  }
}
