import { useMemo } from 'react';
import { useAuth } from '../_core/hooks/useAuth';

export type PermissionCode =
  // 订单权限
  | 'ORDER_CREATE'
  | 'ORDER_VIEW'
  | 'ORDER_EDIT'
  | 'ORDER_DELETE'
  // 客户权限
  | 'CUSTOMER_CREATE'
  | 'CUSTOMER_VIEW'
  | 'CUSTOMER_EDIT'
  | 'CUSTOMER_DELETE'
  // 财务权限
  | 'INVOICE_CREATE'
  | 'INVOICE_VIEW'
  | 'PAYMENT_CREATE'
  | 'PAYMENT_VIEW'
  | 'APPLY_CREATE'
  | 'APPLY_VIEW'
  // 提成权限
  | 'COMMISSION_VIEW_OWN'
  | 'COMMISSION_VIEW_ALL'
  // 审批权限
  | 'APPROVAL_L2'
  | 'APPROVAL_L3';

export type RoleCode = 'SALES' | 'FINANCE' | 'SALES_DIRECTOR' | 'CEO';

// 角色权限映射
const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SALES: [
    'ORDER_CREATE',
    'ORDER_VIEW',
    'ORDER_EDIT',
    'CUSTOMER_CREATE',
    'CUSTOMER_VIEW',
    'CUSTOMER_EDIT',
    'COMMISSION_VIEW_OWN',
  ],
  FINANCE: [
    'ORDER_VIEW',
    'CUSTOMER_VIEW',
    'INVOICE_CREATE',
    'INVOICE_VIEW',
    'PAYMENT_CREATE',
    'PAYMENT_VIEW',
    'APPLY_CREATE',
    'APPLY_VIEW',
  ],
  SALES_DIRECTOR: [
    'ORDER_CREATE',
    'ORDER_VIEW',
    'ORDER_EDIT',
    'ORDER_DELETE',
    'CUSTOMER_CREATE',
    'CUSTOMER_VIEW',
    'CUSTOMER_EDIT',
    'CUSTOMER_DELETE',
    'INVOICE_VIEW',
    'PAYMENT_VIEW',
    'APPLY_VIEW',
    'COMMISSION_VIEW_OWN',
    'COMMISSION_VIEW_ALL',
    'APPROVAL_L2',
  ],
  CEO: [
    'ORDER_CREATE',
    'ORDER_VIEW',
    'ORDER_EDIT',
    'ORDER_DELETE',
    'CUSTOMER_CREATE',
    'CUSTOMER_VIEW',
    'CUSTOMER_EDIT',
    'CUSTOMER_DELETE',
    'INVOICE_CREATE',
    'INVOICE_VIEW',
    'PAYMENT_CREATE',
    'PAYMENT_VIEW',
    'APPLY_CREATE',
    'APPLY_VIEW',
    'COMMISSION_VIEW_OWN',
    'COMMISSION_VIEW_ALL',
    'APPROVAL_L2',
    'APPROVAL_L3',
  ],
};

export function usePermission() {
  const { user } = useAuth();

  // 获取用户角色（从user对象中获取，需要backend返回）
  const userRole = (user as any)?.role as RoleCode | undefined;

  // 获取用户权限列表
  const permissions = useMemo(() => {
    if (!userRole) return [];
    return ROLE_PERMISSIONS[userRole] || [];
  }, [userRole]);

  /**
   * 检查是否拥有指定权限
   */
  const hasPermission = (permission: PermissionCode): boolean => {
    return permissions.includes(permission);
  };

  /**
   * 检查是否拥有任一权限
   */
  const hasAnyPermission = (permissionList: PermissionCode[]): boolean => {
    return permissionList.some((p) => hasPermission(p));
  };

  /**
   * 检查是否拥有所有权限
   */
  const hasAllPermissions = (permissionList: PermissionCode[]): boolean => {
    return permissionList.every((p) => hasPermission(p));
  };

  /**
   * 检查是否为指定角色
   */
  const hasRole = (role: RoleCode): boolean => {
    return userRole === role;
  };

  /**
   * 检查是否为任一角色
   */
  const hasAnyRole = (roles: RoleCode[]): boolean => {
    return roles.some((r) => hasRole(r));
  };

  return {
    permissions,
    userRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
  };
}
