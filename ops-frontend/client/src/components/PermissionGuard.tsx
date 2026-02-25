import { ReactNode } from 'react';
import { usePermission, PermissionCode } from '../hooks/usePermission';
import { Alert, AlertDescription } from './ui/alert';
import { ShieldAlert } from 'lucide-react';

interface PermissionGuardProps {
  /**
   * 所需权限（满足任一即可）
   */
  permissions?: PermissionCode[];
  /**
   * 所需权限（必须全部满足）
   */
  requireAll?: boolean;
  /**
   * 子组件
   */
  children: ReactNode;
  /**
   * 无权限时的替代内容
   */
  fallback?: ReactNode;
  /**
   * 是否显示无权限提示
   */
  showAlert?: boolean;
}

export function PermissionGuard({
  permissions = [],
  requireAll = false,
  children,
  fallback,
  showAlert = true,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();

  // 检查权限
  const hasAccess = (() => {
    if (permissions.length === 0) return true;
    if (requireAll) return hasAllPermissions(permissions);
    return hasAnyPermission(permissions);
  })();

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showAlert) {
    return (
      <Alert variant="destructive" className="my-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription>
          您暂无权限访问此功能，请联系管理员
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/**
 * 按钮权限保护组件
 * 无权限时禁用按钮并显示提示
 */
interface ProtectedButtonProps {
  permissions?: PermissionCode[];
  requireAll?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function ProtectedButton({
  permissions = [],
  requireAll = false,
  children,
  onClick,
  className = '',
  disabled = false,
}: ProtectedButtonProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermission();

  const hasAccess = (() => {
    if (permissions.length === 0) return true;
    if (requireAll) return hasAllPermissions(permissions);
    return hasAnyPermission(permissions);
  })();

  const isDisabled = disabled || !hasAccess;

  return (
    <button
      onClick={hasAccess ? onClick : undefined}
      disabled={isDisabled}
      className={className}
      title={!hasAccess ? '您暂无权限执行此操作' : undefined}
    >
      {children}
    </button>
  );
}
