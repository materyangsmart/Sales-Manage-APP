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
  headers.set('x-internal-token', INTERNAL_SERVICE_TOKEN);
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
   * 获取订单详情
   */
  get: async (orderId: number) => {
    return request<any>(`/api/internal/orders/${orderId}`);
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


/**
 * ========================================
 * 治理级API（P21-P23）
 * ========================================
 */

export interface BadDebtRisk {
  customerId: number;
  customerName: string;
  unpaidAmount: number;
  overdueDays: number;
  creditScore: number;
  estimatedLoss: number;
}

export interface YieldAnomaly {
  batchNo: string;
  soybeanInput: number;
  productOutput: number;
  actualYield: number;
  standardYield: number;
  deviation: number;
  productionDate: string;
}

export interface ChurnRisk {
  customerId: number;
  customerName: string;
  customerCategory: string;
  daysSinceLastOrder: number;
  lastOrderDate: string;
  avgMonthlyOrders: number;
  salesRepName: string;
}

export interface ComplaintAlert {
  id: number;
  batchNo: string;
  complainantName: string;
  complaintContent: string;
  severity: string;
  createdAt: string;
}

export interface CEORadarData {
  badDebtRisks: BadDebtRisk[];
  yieldAnomalies: YieldAnomaly[];
  churnRisks: ChurnRisk[];
  complaintAlerts: ComplaintAlert[];
  unreadComplaintCount: number;
  lastUpdate: string;
}

/**
 * CEO雷达API
 */
export const ceoRadarAPI = {
  /**
   * 获取CEO雷达数据
   */
  async getRadarData(): Promise<CEORadarData> {
    return request<CEORadarData>('/api/internal/ceo/radar', {}, 'CEO Radar');
  },
};

export interface PriceAnomaly {
  id: number;
  orderId: number;
  customerId: number;
  customerName: string;
  productId: number;
  productName: string;
  unitPrice: string;
  regionAvgPrice: string;
  deviationPercent: string;
  salesRepId: number;
  salesRepName: string;
  specialReason: string | null;
  approvedBy: number | null;
  approvedAt: Date | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Date;
  updatedAt: Date;
}

export interface SettlementAudit {
  id: number;
  paymentId: number;
  invoiceId: number;
  applyAmount: string;
  salesRepId: number;
  salesRepName: string;
  applyTime: Date;
  commissionDeadline: Date;
  timeToDeadline: number;
  isSuspicious: boolean;
  suspiciousReason: string | null;
  createdAt: Date;
}

/**
 * 反舞弊API
 */
export const antiFraudAPI = {
  /**
   * 获取所有待审批的价格异常
   */
  async getPriceAnomalies(): Promise<PriceAnomaly[]> {
    return request<PriceAnomaly[]>('/api/internal/anti-fraud/price-anomalies', {}, 'Get Price Anomalies');
  },

  /**
   * 批准价格异常
   */
  async approvePriceAnomaly(anomalyId: number, approvedBy: number, specialReason: string): Promise<void> {
    return request<void>(`/api/internal/anti-fraud/price-anomalies/${anomalyId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy, specialReason }),
    }, 'Approve Price Anomaly');
  },

  /**
   * 拒绝价格异常
   */
  async rejectPriceAnomaly(anomalyId: number, rejectedBy: number): Promise<void> {
    return request<void>(`/api/internal/anti-fraud/price-anomalies/${anomalyId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectedBy }),
    }, 'Reject Price Anomaly');
  },

  /**
   * 获取所有疑似结算审计记录
   */
  async getSuspiciousSettlements(): Promise<SettlementAudit[]> {
    return request<SettlementAudit[]>('/api/internal/anti-fraud/suspicious-settlements', {}, 'Get Suspicious Settlements');
  },
};

export interface CustomerCreditScore {
  id: number;
  customerId: number;
  customerName: string;
  creditScore: number;
  creditLevel: 'S' | 'A' | 'B' | 'C' | 'D';
  totalOrders: number;
  totalAmount: string;
  paidAmount: string;
  paymentRate: string;
  overdueCount: number;
  maxOverdueDays: number;
  autoApproveEnabled: boolean;
  autoApproveLimit: string;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 信用评分API
 */
export const creditAPI = {
  /**
   * 计算客户信用评分
   */
  async calculateCreditScore(customerId: number): Promise<CustomerCreditScore> {
    return request<CustomerCreditScore>('/api/internal/credit/calculate', {
      method: 'POST',
      body: JSON.stringify({ customerId }),
    }, 'Calculate Credit Score');
  },

  /**
   * 获取客户信用评分
   */
  async getCreditScore(customerId: number): Promise<CustomerCreditScore | null> {
    return request<CustomerCreditScore | null>(`/api/internal/credit/${customerId}`, {}, 'Get Credit Score');
  },

  /**
   * 批量计算所有客户的信用评分
   */
  async calculateAllCreditScores(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/internal/credit/calculate-all', {
      method: 'POST',
    }, 'Calculate All Credit Scores');
  },
};


/**
 * ========================================
 * 治理级API（P24 - 职能隔离与账户自动化）
 * ========================================
 */

export interface EmployeeData {
  id: number;
  orgId: number;
  name: string;
  phone: string;
  positionCode: string;
  roleCode: string;
  permissions: string;
  blockedModules: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionTemplate {
  code: string;
  name: string;
  role: string;
  permissions: string[];
  blockedModules: string[];
}

export interface CommissionRuleDisplay {
  formula: string;
  description: string;
  rules: Array<{
    category: string;
    coefficient: number;
    badDebtDeduction: string;
    example: string;
  }>;
}

/**
 * 治理API（员工管理 + 权限控制）
 */
export const governanceAPI = {
  /**
   * 创建员工（自动赋权）
   */
  async createEmployee(data: {
    orgId: number;
    name: string;
    phone: string;
    positionCode: string;
  }): Promise<EmployeeData> {
    return request<EmployeeData>('/api/internal/governance/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 'Create Employee');
  },

  /**
   * 更新员工职位（自动重新赋权）
   */
  async updateEmployeePosition(employeeId: number, positionCode: string): Promise<EmployeeData> {
    return request<EmployeeData>(`/api/internal/governance/employees/${employeeId}/position`, {
      method: 'PUT',
      body: JSON.stringify({ positionCode }),
    }, 'Update Employee Position');
  },

  /**
   * 获取员工列表
   */
  async getEmployees(orgId: number): Promise<EmployeeData[]> {
    return request<EmployeeData[]>(`/api/internal/governance/employees?orgId=${orgId}`, {}, 'Get Employees');
  },

  /**
   * 获取员工详情
   */
  async getEmployee(id: number): Promise<EmployeeData> {
    return request<EmployeeData>(`/api/internal/governance/employees/${id}`, {}, 'Get Employee');
  },

  /**
   * 获取职位模板列表
   */
  async getPositionTemplates(): Promise<PositionTemplate[]> {
    return request<PositionTemplate[]>('/api/internal/governance/position-templates', {}, 'Get Position Templates');
  },

  /**
   * 获取透明提成规则
   */
  async getCommissionRulesDisplay(): Promise<CommissionRuleDisplay> {
    return request<CommissionRuleDisplay>('/api/internal/governance/commission-rules', {}, 'Get Commission Rules Display');
  },

  /**
   * 检查API访问权限
   */
  async checkAccess(employeeId: number, module: string, action: string): Promise<{ allowed: boolean }> {
    return request<{ allowed: boolean }>('/api/internal/governance/check-access', {
      method: 'POST',
      body: JSON.stringify({ employeeId, module, action }),
    }, 'Check Access');
  },
};


/**
 * ========================================
 * 治理级API（P25 - 质量投诉直连CEO看板）
 * ========================================
 */

export interface QualityComplaint {
  id: number;
  batchNo: string;
  driverId: number | null;
  orderId: number | null;
  customerId: number | null;
  complainantName: string;
  complainantPhone: string | null;
  complaintContent: string;
  imageUrls: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  ceoRead: boolean;
  ceoNote: string | null;
  productionShift: string | null;
  productionDate: string | null;
  resolution: string | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 质量投诉API
 */
export const complaintAPI = {
  /**
   * 提交投诉（公开接口，不需要登录）
   */
  async submitComplaint(data: {
    batchNo: string;
    driverId?: number;
    orderId?: number;
    customerId?: number;
    complainantName: string;
    complainantPhone?: string;
    complaintContent: string;
    imageUrls?: string[];
  }): Promise<{ id: number; severity: string; status: string; message: string }> {
    return request<{ id: number; severity: string; status: string; message: string }>(
      '/api/internal/complaints/submit',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'Submit Complaint',
    );
  },

  /**
   * 获取未读投诉数量（CEO红点提醒）
   */
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return request<{ unreadCount: number }>(
      '/api/internal/complaints/unread-count',
      {},
      'Get Unread Complaint Count',
    );
  },

  /**
   * 获取投诉列表（CEO专用）
   */
  async getComplaints(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    severity?: string;
    unreadOnly?: boolean;
  }): Promise<{ items: QualityComplaint[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.unreadOnly) query.set('unreadOnly', 'true');
    return request<{ items: QualityComplaint[]; total: number }>(
      `/api/internal/complaints/list?${query.toString()}`,
      {},
      'Get Complaints',
    );
  },

  /**
   * 获取投诉详情
   */
  async getComplaintDetail(id: number): Promise<QualityComplaint> {
    return request<QualityComplaint>(`/api/internal/complaints/${id}`, {}, 'Get Complaint Detail');
  },

  /**
   * 标记投诉为已读
   */
  async markAsRead(id: number): Promise<void> {
    return request<void>(`/api/internal/complaints/${id}/read`, {
      method: 'PUT',
    }, 'Mark Complaint Read');
  },

  /**
   * 更新投诉状态
   */
  async updateComplaintStatus(id: number, data: {
    status: string;
    ceoNote?: string;
    resolution?: string;
  }): Promise<QualityComplaint> {
    return request<QualityComplaint>(`/api/internal/complaints/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, 'Update Complaint Status');
  },
};


/**
 * ========================================
 * 员工管理API
 * ========================================
 */

export const employeeAPI = {
  /**
   * 获取员工列表
   */
  async list(orgId: number = 1): Promise<any[]> {
    return request<any[]>(`/api/internal/users?orgId=${orgId}`, {}, 'Get Employee List');
  },

  /**
   * 获取职位模板列表
   */
  async getJobPositions(): Promise<any[]> {
    return request<any[]>('/api/internal/governance/position-templates', {}, 'Get Job Positions');
  },

  /**
   * 创建员工
   */
  async create(data: {
    orgId?: number;
    username: string;
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
    department?: string;
    job_position_id: string;
  }): Promise<any> {
    return request<any>('/api/internal/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 'Create Employee');
  },

  /**
   * 删除员工
   */
  async delete(id: number): Promise<any> {
    return request<any>(`/api/internal/users/${id}`, {
      method: 'DELETE',
    }, 'Delete Employee');
  },
};


/**
 * ========================================
 * 个人业绩API
 * ========================================
 */

export const myPerformanceAPI = {
  /**
   * 获取当前用户的个人业绩数据
   * @param userId - 当前登录用户的ID
   */
  async get(userId: number): Promise<any> {
    return request<any>(`/api/internal/commission/my-performance?userId=${userId}`, {}, 'Get My Performance');
  },
};


/**
 * ========================================
 * 追溯数据API
 * ========================================
 */

export const traceabilityAPI = {
  /**
   * 获取订单追溯数据（公开接口）
   * @param code - 追溯码（orderId）
   */
  async getTraceData(code: string | number): Promise<any> {
    return request<any>(`/api/internal/traceability/${code}`, {}, 'Get Trace Data');
  },
};


/**
 * ========================================
 * 质量反馈API（消灭Drizzle直连）
 * ========================================
 */

export const feedbackAPI = {
  /**
   * 提交客户评价
   */
  async submit(data: {
    orderId: number;
    batchNo?: string;
    customerName?: string;
    rating: number;
    comment?: string;
    images?: string[];
  }): Promise<{ success: boolean; feedbackId: number }> {
    return request<{ success: boolean; feedbackId: number }>('/api/internal/feedback/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    }, 'Submit Feedback');
  },

  /**
   * 获取订单评价列表
   */
  async list(orderId: number): Promise<any[]> {
    return request<any[]>(`/api/internal/feedback/list?orderId=${orderId}`, {}, 'Get Feedback List');
  },
};

/**
 * ========================================
 * RBAC 管理 API（权限中台）
 * ========================================
 */
export const rbacAPI = {
  async getRoles(): Promise<any[]> {
    return request<any[]>('/api/internal/rbac/roles', {}, 'Get Roles');
  },
  async getOrgTree(): Promise<any[]> {
    return request<any[]>('/api/internal/rbac/organizations', {}, 'Get Org Tree');
  },
  async getUsers(params: { orgId?: number; page?: number; pageSize?: number }): Promise<{ items: any[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.orgId) qs.set('orgId', String(params.orgId));
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<{ items: any[]; total: number }>(`/api/internal/rbac/users?${qs}`, {}, 'Get Users');
  },
  async assignRole(userId: number, roleId: number, orgId?: number): Promise<void> {
    await request<void>('/api/internal/rbac/assign-role', {
      method: 'POST',
      body: JSON.stringify({ userId, roleId, orgId }),
    }, 'Assign Role');
  },
  async removeUserRole(userId: number, roleId: number): Promise<void> {
    await request<void>(`/api/internal/rbac/users/${userId}/roles/remove`, {
      method: 'PATCH',
      body: JSON.stringify({ roleId }),
    }, 'Remove User Role');
  },
  async updateUserOrg(userId: number, orgId: number): Promise<void> {
    await request<void>(`/api/internal/rbac/users/${userId}/org`, {
      method: 'PATCH',
      body: JSON.stringify({ orgId }),
    }, 'Update User Org');
  },
};

/**
 * ========================================
 * Workflow 审批 API
 * ========================================
 */
export const workflowAPI = {
  async getMyTodos(params: { page?: number; pageSize?: number }): Promise<{ items: any[]; total: number }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<{ items: any[]; total: number }>(`/api/internal/workflow/my-todos?${qs}`, {}, 'Get My Todos');
  },
  async approve(instanceId: number, comment: string): Promise<any> {
    return request<any>(`/api/internal/workflow/instances/${instanceId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }, 'Approve Workflow');
  },
  async reject(instanceId: number, comment: string): Promise<any> {
    return request<any>(`/api/internal/workflow/instances/${instanceId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    }, 'Reject Workflow');
  },
  async getInstance(instanceId: number): Promise<any> {
    return request<any>(`/api/internal/workflow/instances/${instanceId}`, {}, 'Get Workflow Instance');
  },
  async getInstanceByBusiness(businessType: string, businessId: number): Promise<any> {
    return request<any>(`/api/internal/workflow/instances/by-business?businessType=${businessType}&businessId=${businessId}`, {}, 'Get Workflow Instance By Business');
  },
};

/**
 * ========================================
 * Notification 消息 API
 * ========================================
 */
export const notificationAPI = {
  async getUnreadCount(): Promise<{ unreadCount: number }> {
    return request<{ unreadCount: number }>('/api/internal/notifications/unread-count', {}, 'Get Unread Count');
  },
  async getList(params: { page?: number; pageSize?: number }): Promise<any> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<any>(`/api/internal/notifications?${qs}`, {}, 'Get Notifications');
  },
  async markAsRead(id: number): Promise<void> {
    await request<void>(`/api/internal/notifications/${id}/read`, {
      method: 'PATCH',
    }, 'Mark As Read');
  },
  async markAllAsRead(): Promise<void> {
    await request<void>('/api/internal/notifications/read-all', {
      method: 'PATCH',
    }, 'Mark All As Read');
  },
};
