/**
 * MS-RBAC E2E 测试
 * 验证：角色枚举扩展、API Guard 中间件、权限映射
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { hasRoutePermission, ROLE_LABELS, ROUTE_PERMISSIONS, type AppRole } from '../shared/rbac';

// ============================================================
// Suite 1: 角色定义与标签
// ============================================================
describe('Suite 1: 角色定义与标签', () => {
  const ALL_ROLES: AppRole[] = ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'];

  it('T1.1 应包含 6 个角色', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(6);
    for (const role of ALL_ROLES) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(typeof ROLE_LABELS[role]).toBe('string');
    }
  });

  it('T1.2 角色中文标签正确', () => {
    expect(ROLE_LABELS.admin).toBe('超级管理员');
    expect(ROLE_LABELS.sales).toBe('销售');
    expect(ROLE_LABELS.fulfillment).toBe('交付/履约');
    expect(ROLE_LABELS.finance).toBe('财务');
    expect(ROLE_LABELS.auditor).toBe('审计/纪检');
    expect(ROLE_LABELS.user).toBe('普通用户');
  });
});

// ============================================================
// Suite 2: hasRoutePermission 权限检查
// ============================================================
describe('Suite 2: hasRoutePermission 权限检查', () => {
  it('T2.1 admin 可以访问所有路由', () => {
    const allRoutes = Object.keys(ROUTE_PERMISSIONS);
    for (const route of allRoutes) {
      expect(hasRoutePermission('admin', route)).toBe(true);
    }
  });

  it('T2.2 sales 只能访问销售相关路由', () => {
    // 销售可以访问
    expect(hasRoutePermission('sales', 'orders')).toBe(true);
    expect(hasRoutePermission('sales', 'salesOrder')).toBe(true);
    expect(hasRoutePermission('sales', 'commission')).toBe(true);
    expect(hasRoutePermission('sales', 'salesKPI')).toBe(true);
    expect(hasRoutePermission('sales', 'expenses')).toBe(true);

    // 销售不能访问
    expect(hasRoutePermission('sales', 'invoices')).toBe(false);
    expect(hasRoutePermission('sales', 'payments')).toBe(false);
    expect(hasRoutePermission('sales', 'arApply')).toBe(false);
    expect(hasRoutePermission('sales', 'auditLogs')).toBe(false);
    expect(hasRoutePermission('sales', 'rbac')).toBe(false);
  });

  it('T2.3 finance 只能访问财务相关路由', () => {
    // 财务可以访问
    expect(hasRoutePermission('finance', 'invoices')).toBe(true);
    expect(hasRoutePermission('finance', 'payments')).toBe(true);
    expect(hasRoutePermission('finance', 'arApply')).toBe(true);
    expect(hasRoutePermission('finance', 'credit')).toBe(true);
    expect(hasRoutePermission('finance', 'billing')).toBe(true);
    expect(hasRoutePermission('finance', 'arAging')).toBe(true);

    // 财务不能访问
    expect(hasRoutePermission('finance', 'salesOrder')).toBe(false);
    expect(hasRoutePermission('finance', 'commission')).toBe(false);
    expect(hasRoutePermission('finance', 'auditLogs')).toBe(false);
    expect(hasRoutePermission('finance', 'inventory')).toBe(false);
  });

  it('T2.4 fulfillment 只能访问交付相关路由', () => {
    // 交付可以访问
    expect(hasRoutePermission('fulfillment', 'fulfillment')).toBe(true);
    expect(hasRoutePermission('fulfillment', 'inventory')).toBe(true);
    expect(hasRoutePermission('fulfillment', 'orders')).toBe(true);
    expect(hasRoutePermission('fulfillment', 'afterSales')).toBe(true);

    // 交付不能访问
    expect(hasRoutePermission('fulfillment', 'invoices')).toBe(false);
    expect(hasRoutePermission('fulfillment', 'commission')).toBe(false);
    expect(hasRoutePermission('fulfillment', 'auditLogs')).toBe(false);
  });

  it('T2.5 auditor 只能访问审计相关路由', () => {
    // 审计可以访问
    expect(hasRoutePermission('auditor', 'auditLogs')).toBe(true);
    expect(hasRoutePermission('auditor', 'ceo')).toBe(true);
    expect(hasRoutePermission('auditor', 'antiFraud')).toBe(true);
    expect(hasRoutePermission('auditor', 'governance')).toBe(true);
    expect(hasRoutePermission('auditor', 'fraudEngine')).toBe(true);

    // 审计不能访问
    expect(hasRoutePermission('auditor', 'salesOrder')).toBe(false);
    expect(hasRoutePermission('auditor', 'invoices')).toBe(false);
    expect(hasRoutePermission('auditor', 'inventory')).toBe(false);
  });

  it('T2.6 user 只能访问公共路由', () => {
    // 公共路由
    expect(hasRoutePermission('user', 'ping')).toBe(true);
    expect(hasRoutePermission('user', 'auth')).toBe(true);
    expect(hasRoutePermission('user', 'system')).toBe(true);
    expect(hasRoutePermission('user', 'portal')).toBe(true);

    // 业务路由全部拒绝
    expect(hasRoutePermission('user', 'orders')).toBe(false);
    expect(hasRoutePermission('user', 'invoices')).toBe(false);
    expect(hasRoutePermission('user', 'auditLogs')).toBe(false);
    expect(hasRoutePermission('user', 'inventory')).toBe(false);
  });

  it('T2.7 未定义的路由默认拒绝所有非 admin 角色', () => {
    expect(hasRoutePermission('admin', 'nonExistentRoute')).toBe(true);
    expect(hasRoutePermission('sales', 'nonExistentRoute')).toBe(false);
    expect(hasRoutePermission('finance', 'nonExistentRoute')).toBe(false);
  });
});

// ============================================================
// Suite 3: 跨角色访问控制矩阵
// ============================================================
describe('Suite 3: 跨角色访问控制矩阵', () => {
  it('T3.1 销售调用收款接口应被拒绝', () => {
    expect(hasRoutePermission('sales', 'payments')).toBe(false);
  });

  it('T3.2 财务调用代客下单应被拒绝', () => {
    expect(hasRoutePermission('finance', 'salesOrder')).toBe(false);
  });

  it('T3.3 交付调用审计日志应被拒绝', () => {
    expect(hasRoutePermission('fulfillment', 'auditLogs')).toBe(false);
  });

  it('T3.4 审计调用库存管理应被拒绝', () => {
    expect(hasRoutePermission('auditor', 'inventory')).toBe(false);
  });

  it('T3.5 流失预警对销售和审计都开放', () => {
    expect(hasRoutePermission('sales', 'churnRadar')).toBe(true);
    expect(hasRoutePermission('auditor', 'churnRadar')).toBe(true);
    expect(hasRoutePermission('finance', 'churnRadar')).toBe(false);
  });

  it('T3.6 所有角色都能访问公共路由（ping/auth/system）', () => {
    const publicRoutes = ['ping', 'auth', 'system', 'portal', 'notification'];
    const allRoles: AppRole[] = ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'];
    for (const route of publicRoutes) {
      for (const role of allRoles) {
        expect(hasRoutePermission(role, route)).toBe(true);
      }
    }
  });
});

// ============================================================
// Suite 4: ROUTE_PERMISSIONS 完整性
// ============================================================
describe('Suite 4: ROUTE_PERMISSIONS 完整性', () => {
  it('T4.1 所有路由映射都包含 admin', () => {
    for (const [route, roles] of Object.entries(ROUTE_PERMISSIONS)) {
      expect(roles).toContain('admin');
    }
  });

  it('T4.2 rbac 路由仅 admin 可访问', () => {
    expect(ROUTE_PERMISSIONS['rbac']).toEqual(['admin']);
  });

  it('T4.3 客户损益同时对销售和财务开放', () => {
    expect(ROUTE_PERMISSIONS['customerPnL']).toContain('sales');
    expect(ROUTE_PERMISSIONS['customerPnL']).toContain('finance');
  });
});
