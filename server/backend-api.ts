/**
 * Backend API Client
 * 
 * 用于server-side调用backend REST API
 * INTERNAL_SERVICE_TOKEN只在server端使用，不会暴露到前端
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3100';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

if (!INTERNAL_SERVICE_TOKEN) {
  console.warn('[Backend API] INTERNAL_SERVICE_TOKEN not configured');
}

/**
 * 通用请求函数
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  logContext?: string
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  // 访问日志：打印请求信息
  const requestMethod = options.method || 'GET';
  console.log(`[Backend API] ${requestMethod} ${url}${logContext ? ` (${logContext})` : ''}`);
  
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${INTERNAL_SERVICE_TOKEN}`);
  headers.set('Content-Type', 'application/json');
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // 访问日志：打印响应状态
    console.log(`[Backend API] Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Backend API] Error response:`, errorText.substring(0, 200));
      
      // Task 4: 区分401/403错误，不要统一返回500
      let errorMessage = `Backend API error: ${response.status} ${response.statusText}`;
      
      if (response.status === 401) {
        errorMessage = 'Unauthorized: Invalid or missing authentication token';
      } else if (response.status === 403) {
        errorMessage = 'Forbidden: Insufficient permissions to access this resource';
      }
      
      const error = new Error(errorMessage) as any;
      error.status = response.status;
      error.statusText = response.statusText;
      error.url = url;
      error.responseText = errorText;
      error.code = response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST';
      throw error;
    }
    
    return response.json();
  } catch (error) {
    // 访问日志：打印错误摘要
    if (error instanceof Error) {
      console.error(`[Backend API] Request failed:`, error.message);
    }
    throw error;
  }
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
    
    return request<any>(`/api/internal/orders?${query}`);
  },
  
  /**
   * 审核订单（批准）
   */
  approve: async (orderId: number, remark?: string) => {
    return request<any>(`/api/internal/orders/${orderId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE', remark }),
    });
  },
  
  /**
   * 审核订单（拒绝）
   */
  reject: async (orderId: number, remark?: string) => {
    return request<any>(`/api/internal/orders/${orderId}/review`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REJECT', remark }),
    });
  },
  
  /**
   * 履行订单（生成发票）
   */
  fulfill: async (orderId: number) => {
    return request<any>(`/api/internal/orders/${orderId}/fulfill`, {
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
  
  /**
   * 获取发票毛利数据
   * @param params.orgId - 组织ID
   * @param params.startDate - 开始日期 (ISO 8601格式)
   * @param params.endDate - 结束日期 (ISO 8601格式)
   * @param params.customerId - 客户ID（可选）
   */
  getMarginStats: async (params: {
    orgId: number;
    startDate: string;
    endDate: string;
    customerId?: number;
  }) => {
    const query = new URLSearchParams({
      orgId: params.orgId.toString(),
      startDate: params.startDate,
      endDate: params.endDate,
      ...(params.customerId && { customerId: params.customerId.toString() }),
    });
    
    return request<any>(`/ar/invoices/margin-stats?${query}`, {}, 'invoicesAPI.getMarginStats');
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
 * Customers API
 */
export const customersAPI = {
  /**
   * 获取客户列表
   * @param params.orgId - 组织ID
   * @param params.createdAfter - 过滤创建时间晚于此日期的客户（ISO 8601格式）
   * @param params.page - 页码
   * @param params.pageSize - 每页数量
   */
  list: async (params: {
    orgId: number;
    createdAfter?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams({
      orgId: params.orgId.toString(),
      ...(params.createdAfter && { createdAfter: params.createdAfter }),
      ...(params.page && { page: params.page.toString() }),
      ...(params.pageSize && { pageSize: params.pageSize.toString() }),
    });
    
    return request<any>(`/api/internal/customers?${query}`, {}, 'customersAPI.list');
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
 * Commission Rules API
 */
export const commissionRulesAPI = {
  /**
   * 获取提成规则列表
   */
  list: async (params?: {
    category?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.pageSize) query.set('pageSize', params.pageSize.toString());
    
    return request<any>(`/api/internal/commission-rules${query.toString() ? `?${query}` : ''}`, {}, 'commissionRulesAPI.list');
  },
  
  /**
   * 获取提成规则详情
   */
  get: async (id: number) => {
    return request<any>(`/api/internal/commission-rules/${id}`, {}, 'commissionRulesAPI.get');
  },
  
  /**
   * 创建提成规则
   */
  create: async (data: {
    ruleVersion: string;
    category: string;
    baseRate: number;
    newCustomerBonus: number;
    ruleJson?: string;
    effectiveFrom: string;
  }) => {
    return request<any>(`/api/internal/commission-rules`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, 'commissionRulesAPI.create');
  },
  
  /**
   * 更新提成规则
   */
  update: async (id: number, data: {
    ruleVersion?: string;
    category?: string;
    baseRate?: number;
    newCustomerBonus?: number;
    ruleJson?: string;
    effectiveFrom?: string;
  }) => {
    return request<any>(`/api/internal/commission-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, 'commissionRulesAPI.update');
  },
  
  /**
   * 删除提成规则
   */
  delete: async (id: number) => {
    return request<any>(`/api/internal/commission-rules/${id}`, {
      method: 'DELETE',
    }, 'commissionRulesAPI.delete');
  },
};

/**
 * Server启动自检
 * 在server启动时调用，验证backend连接
 */
export async function healthCheck() {
  console.log('='.repeat(60));
  console.log('[Backend API] Runtime Configuration');
  console.log('='.repeat(60));
  console.log('BACKEND_URL:', BACKEND_URL);
  console.log('Internal token present?', !!INTERNAL_SERVICE_TOKEN);
  console.log('='.repeat(60));
  
  try {
    // 探测请求1：/health (backend健康检查)
    const healthUrl = `${BACKEND_URL}/health`;
    console.log('[Backend API] Probing /health:', healthUrl);
    
    const healthResponse = await fetch(healthUrl);
    console.log('[Backend API] /health status code:', healthResponse.status);
    
    if (healthResponse.ok) {
      console.log('[Backend API] ✓ Backend /health OK');
    } else {
      console.warn('[Backend API] ✗ Backend /health returned:', healthResponse.status);
    }
    
    // 探测请求2：/ar/payments (验证API可访问性)
    const probeUrl = `${BACKEND_URL}/ar/payments?orgId=1&page=1&pageSize=1`;
    console.log('[Backend API] Probing /ar/payments:', probeUrl);
    
    const probeResponse = await fetch(probeUrl, {
      headers: {
        'Authorization': `Bearer ${INTERNAL_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log('[Backend API] /ar/payments status code:', probeResponse.status);
    
    if (probeResponse.ok) {
      console.log('[Backend API] ✓ Backend API access OK');
    } else {
      console.warn('[Backend API] ✗ Backend API returned:', probeResponse.status);
      const errorText = await probeResponse.text();
      console.warn('[Backend API] Error response:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('[Backend API] ✗ Backend connection failed:');
    console.error(error);
  }
  console.log('='.repeat(60));
}
