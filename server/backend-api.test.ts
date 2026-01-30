/**
 * Backend API Client Tests
 * 
 * 验证backend API配置和连接
 */

import { describe, it, expect } from 'vitest';
import { auditLogsAPI, ordersAPI, invoicesAPI, paymentsAPI, applyAPI } from './backend-api';

describe('Backend API Client', () => {
  it('should have BACKEND_URL configured', () => {
    expect(process.env.BACKEND_URL).toBeDefined();
    expect(process.env.BACKEND_URL).not.toBe('');
  });
  
  it('should have INTERNAL_SERVICE_TOKEN configured', () => {
    expect(process.env.INTERNAL_SERVICE_TOKEN).toBeDefined();
    expect(process.env.INTERNAL_SERVICE_TOKEN).not.toBe('');
  });
  
  it('should be able to construct API calls', () => {
    // 验证backend-api模块可以被正确导入
    expect(auditLogsAPI).toBeDefined();
    expect(auditLogsAPI.list).toBeInstanceOf(Function);
    expect(auditLogsAPI.trace).toBeInstanceOf(Function);
    
    // 注意：实际API调用需要backend服务运行
    // 这里只验证配置和模块结构，不进行实际请求
  });
  
  it('should have correct BACKEND_URL format', () => {
    const backendUrl = process.env.BACKEND_URL || '';
    // 验证URL格式
    expect(backendUrl).toMatch(/^https?:\/\/.+/);
  });
});
