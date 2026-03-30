/**
 * RBAC 权限体系 - 角色定义与路由权限映射
 * 
 * 5 大核心角色：
 * - admin: 超级管理员（全部权限）
 * - sales: 销售（订单、代客下单、提成、KPI）
 * - fulfillment: 交付/履约（订单履行、库存、履约看板）
 * - finance: 财务（发票、收款、核销、费用审核、应收账龄、账单）
 * - auditor: 审计/纪检（审计日志、经营雷达、反欺诈、治理）
 */

export type AppRole = 'admin' | 'sales' | 'fulfillment' | 'finance' | 'auditor' | 'user';

/** 角色中文标签 */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: '超级管理员',
  sales: '销售',
  fulfillment: '交付/履约',
  finance: '财务',
  auditor: '审计/纪检',
  user: '普通用户',
};

/** 角色颜色（用于 Badge 展示） */
export const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  sales: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  fulfillment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  finance: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  auditor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

/**
 * 路由模块 → 允许访问的角色列表
 * 
 * 规则：admin 拥有所有权限，不需要在每个映射中列出
 * 'user' 角色只能访问公共路由（ping、auth、public、portal）
 */
export const ROUTE_PERMISSIONS: Record<string, AppRole[]> = {
  // === 公共路由（所有已登录用户可访问） ===
  ping: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  auth: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  system: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  public: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  portal: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  notification: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  employee: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  imAuth: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  imPush: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  fileStorage: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  localAuth: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],
  storage: ['admin', 'sales', 'fulfillment', 'finance', 'auditor', 'user'],

  // === 销售模块 ===
  orders: ['admin', 'sales', 'fulfillment'],           // 销售+履约都需要看订单
  salesOrder: ['admin', 'sales'],                       // 代客下单仅销售
  customerMgmt: ['admin', 'sales', 'finance'],           // 客户管理 CRUD
  commission: ['admin', 'sales'],                       // 提成查询/规则
  salesKPI: ['admin', 'sales'],                         // 销售KPI看板
  expenses: ['admin', 'sales'],                         // 费用报销（销售提交）
  businessTrips: ['admin', 'sales'],                    // 出差申请
  afterSales: ['admin', 'sales', 'fulfillment'],        // 售后
  customerPnL: ['admin', 'sales', 'finance'],           // 客户损益
  referral: ['admin', 'sales'],                         // 裂变推荐
  growthIncentive: ['admin', 'sales'],                  // 增长激励

  // === 交付/履约模块 ===
  fulfillment: ['admin', 'fulfillment'],                // 订单履行
  inventory: ['admin', 'fulfillment'],                  // 库存管理
  mrp: ['admin', 'fulfillment'],                        // MRP 物料需求
  srm: ['admin', 'fulfillment'],                        // 供应商管理

  // === 财务模块 ===
  invoices: ['admin', 'finance'],                       // 发票管理
  payments: ['admin', 'finance'],                       // 收款管理
  arApply: ['admin', 'finance'],                        // 核销操作
  credit: ['admin', 'finance'],                         // 信用额度
  billing: ['admin', 'finance'],                        // 账单
  arAging: ['admin', 'finance'],                        // 应收账龄
  financeExpenses: ['admin', 'finance'],                // 财务审核台
  paymentReceipt: ['admin', 'finance'],                 // 收款凭证

  // === 审计/纪检模块 ===
  auditLogs: ['admin', 'auditor'],                      // 审计日志
  ceo: ['admin', 'auditor'],                            // 经营异常雷达
  antiFraud: ['admin', 'auditor'],                      // 反欺诈
  governance: ['admin', 'auditor'],                     // 治理
  fraudEngine: ['admin', 'auditor'],                    // 反作弊引擎
  churnRadar: ['admin', 'auditor', 'sales'],            // 流失预警（销售也需看）
  winback: ['admin', 'auditor', 'sales'],               // 挽回工具（销售也需用）
  roiReferral: ['admin', 'auditor'],                    // ROI 裂变分析

  // === 管理员专属 ===
  rbac: ['admin'],                                      // RBAC 管理
  workflow: ['admin'],                                  // 工作流
  biDashboard: ['admin'],                               // BI 看板
  aiCopilot: ['admin'],                                 // AI 助手
  traceability: ['admin', 'auditor'],                   // 溯源
  feedback: ['admin'],                                  // 反馈
  complaint: ['admin', 'auditor'],                      // 投诉
};

/**
 * 检查用户角色是否有权访问指定路由模块
 */
export function hasRoutePermission(role: AppRole | string, routeModule: string): boolean {
  if (role === 'admin') return true;
  const allowed = ROUTE_PERMISSIONS[routeModule];
  if (!allowed) return false; // 未定义的路由默认拒绝
  return allowed.includes(role as AppRole);
}

/**
 * 前端侧边栏菜单项定义（含角色权限标记）
 */
export interface MenuItem {
  icon: string;  // lucide icon name
  label: string;
  path: string;
  /** 允许访问的角色列表，admin 始终可见 */
  roles: AppRole[];
}

/** 侧边栏菜单配置 - 按角色过滤 */
export const SIDEBAR_MENU_CONFIG: MenuItem[] = [
  { icon: 'ClipboardCheck', label: '订单审核', path: '/orders/review', roles: ['admin', 'sales', 'fulfillment'] },
  { icon: 'ShoppingCart', label: '代客下单', path: '/orders/create', roles: ['admin', 'sales'] },
  { icon: 'Users', label: '客户管理', path: '/customers', roles: ['admin', 'sales', 'finance'] },
  { icon: 'Package', label: '订单履行', path: '/orders/fulfill', roles: ['admin', 'fulfillment'] },
  { icon: 'Kanban', label: '履约看板', path: '/orders/fulfillment', roles: ['admin', 'fulfillment'] },
  { icon: 'Warehouse', label: '库存管理', path: '/admin/inventory', roles: ['admin', 'fulfillment'] },
  { icon: 'FileText', label: '发票管理', path: '/ar/invoices', roles: ['admin', 'finance'] },
  { icon: 'CreditCard', label: '收款管理', path: '/ar/payments', roles: ['admin', 'finance'] },
  { icon: 'Receipt', label: '核销操作', path: '/ar/apply', roles: ['admin', 'finance'] },
  { icon: 'TrendingUp', label: '提成查询', path: '/commission/stats', roles: ['admin', 'sales'] },
  { icon: 'Settings', label: '提成规则', path: '/commission/rules', roles: ['admin', 'sales'] },
  { icon: 'Search', label: '审计日志', path: '/audit/logs', roles: ['admin', 'auditor'] },
  { icon: 'BadgeDollarSign', label: '费用报销', path: '/expense/claim', roles: ['admin', 'sales'] },
  { icon: 'Trophy', label: '销售KPI看板', path: '/admin/sales-performance', roles: ['admin', 'sales'] },
  { icon: 'ClipboardList', label: '财务审核台', path: '/finance/expenses', roles: ['admin', 'finance'] },
  { icon: 'BarChart3', label: '应收账龄', path: '/finance/ar-aging', roles: ['admin', 'finance'] },
];
