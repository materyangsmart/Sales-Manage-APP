/**
 * 批量为 routers.ts 中的路由模块添加 RBAC Guard
 * 
 * 策略：在每个路由模块的第一个 protectedProcedure 前面，
 * 将 protectedProcedure 替换为 roleProcedure([...allowedRoles])
 * 
 * 注意：公共路由（auth, ping, public, portal, notification, employee, imAuth, imPush, fileStorage, localAuth, storage）
 * 保持 protectedProcedure 不变（所有角色可访问）
 */
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'server/routers.ts';
let content = readFileSync(filePath, 'utf-8');

// 路由模块 → 允许的角色（admin 自动放行，不需要列出）
const ROUTE_GUARDS = {
  // 销售模块
  'orders': ['sales', 'fulfillment'],
  'salesOrder': ['sales'],
  'commission': ['sales'],
  'salesKPI': ['sales'],
  'expenses': ['sales'],
  'businessTrips': ['sales'],
  'afterSales': ['sales', 'fulfillment'],
  'customerPnL': ['sales', 'finance'],
  'referral': ['sales'],
  'growthIncentive': ['sales'],
  
  // 交付/履约模块
  'fulfillment': ['fulfillment'],
  'inventory': ['fulfillment'],
  'mrp': ['fulfillment'],
  'srm': ['fulfillment'],
  
  // 财务模块
  'invoices': ['finance'],
  'payments': ['finance'],
  'arApply': ['finance'],
  'credit': ['finance'],
  'billing': ['finance'],
  'arAging': ['finance'],
  'financeExpenses': ['finance'],
  'paymentReceipt': ['finance'],
  
  // 审计/纪检模块
  'auditLogs': ['auditor'],
  'ceo': ['auditor'],
  'antiFraud': ['auditor'],
  'governance': ['auditor'],
  'fraudEngine': ['auditor'],
  'churnRadar': ['auditor', 'sales'],
  'winback': ['auditor', 'sales'],
  'roiReferral': ['auditor'],
  
  // 管理员专属
  'rbac': [],        // admin only
  'workflow': [],     // admin only
  'biDashboard': [],  // admin only
  'aiCopilot': [],    // admin only
};

// 不需要 guard 的公共路由（保持 protectedProcedure）
const PUBLIC_ROUTES = [
  'auth', 'ping', 'system', 'public', 'portal', 'notification',
  'employee', 'imAuth', 'imPush', 'fileStorage', 'localAuth', 'storage',
];

let replacements = 0;

for (const [routeName, roles] of Object.entries(ROUTE_GUARDS)) {
  // 找到路由模块定义的位置
  const routePattern = new RegExp(`(  ${routeName}: router\\({\\n)`, 'g');
  const match = routePattern.exec(content);
  if (!match) {
    console.log(`⚠️  Route "${routeName}" not found, skipping`);
    continue;
  }
  
  // 在路由模块内部，找到所有 protectedProcedure 并替换
  // 策略：找到该路由块的起始位置，然后在该块内替换
  const startIdx = match.index + match[0].length;
  
  // 找到该路由块的结束位置（匹配括号）
  let depth = 1;
  let endIdx = startIdx;
  for (let i = startIdx; i < content.length && depth > 0; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') depth--;
    endIdx = i;
  }
  
  const blockContent = content.substring(startIdx, endIdx);
  const rolesStr = roles.length > 0 
    ? `roleProcedure(['admin', ${roles.map(r => `'${r}'`).join(', ')}])`
    : `roleProcedure(['admin'])`;
  
  const newBlock = blockContent.replace(/protectedProcedure/g, rolesStr);
  
  if (newBlock !== blockContent) {
    content = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
    const count = (blockContent.match(/protectedProcedure/g) || []).length;
    replacements += count;
    console.log(`✓ ${routeName}: ${count} procedures → ${rolesStr}`);
  }
}

writeFileSync(filePath, content, 'utf-8');
console.log(`\n✅ Total: ${replacements} protectedProcedure → roleProcedure replacements`);
