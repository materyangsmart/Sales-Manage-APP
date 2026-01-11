import axios from 'axios';
import type {
  PaymentListParams,
  PaymentListResponse,
  ApplyPaymentRequest,
  ApplyPaymentResponse,
} from '../types/ar';

const api = axios.create({
  baseURL: '/api/ar',
  timeout: 30000,
});

// 请求拦截器：添加幂等性键
api.interceptors.request.use((config) => {
  // 对于POST请求，自动添加幂等性键
  if (config.method === 'post' && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = generateIdempotencyKey();
  }
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      // 409冲突错误特殊处理
      if (status === 409) {
        error.userMessage = '数据已被他人更新，请刷新后重试';
      } else if (data?.message) {
        error.userMessage = data.message;
      } else {
        error.userMessage = '操作失败，请稍后重试';
      }
    } else {
      error.userMessage = '网络错误，请检查网络连接';
    }
    
    return Promise.reject(error);
  }
);

/**
 * 生成幂等性键（UUID v4）
 */
function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取收款单列表
 */
export async function getPaymentList(
  params: PaymentListParams
): Promise<PaymentListResponse> {
  const response = await api.get<PaymentListResponse>('/payments', { params });
  return response.data;
}

/**
 * 核销收款
 */
export async function applyPayment(
  data: ApplyPaymentRequest
): Promise<ApplyPaymentResponse> {
  const response = await api.post<ApplyPaymentResponse>('/apply', data);
  return response.data;
}

export default api;
