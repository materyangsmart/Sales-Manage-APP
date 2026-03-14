import { useState } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Shield, UserPlus, Users, Lock, Unlock, AlertTriangle,
  ChevronLeft, Eye, EyeOff, RefreshCw,
} from 'lucide-react';

/**
 * 职位模板定义（与backend POSITION_ROLE_MAP完全一致）
 * 这些数据硬编码在前端，确保与后端保持同步
 */
const POSITION_TEMPLATES = [
  { code: 'CEO', name: '总经理', role: 'ADMIN', color: 'bg-red-100 text-red-800' },
  { code: 'SALES_DIRECTOR', name: '营销总监', role: 'SALES', color: 'bg-blue-100 text-blue-800' },
  { code: 'SALES_REP', name: '销售员', role: 'SALES', color: 'bg-blue-50 text-blue-700' },
  { code: 'FINANCE_SUPERVISOR', name: '财务主管', role: 'FINANCE', color: 'bg-green-100 text-green-800' },
  { code: 'FINANCE_CLERK', name: '财务专员', role: 'FINANCE', color: 'bg-green-50 text-green-700' },
  { code: 'PRODUCTION_MANAGER', name: '生产主管', role: 'PRODUCTION', color: 'bg-purple-100 text-purple-800' },
  { code: 'WAREHOUSE_CLERK', name: '仓库管理员', role: 'WAREHOUSE', color: 'bg-yellow-100 text-yellow-800' },
  { code: 'DRIVER', name: '配送司机', role: 'DRIVER', color: 'bg-gray-100 text-gray-800' },
];

/**
 * 角色权限说明（与backend ROLE_PERMISSION_MAP完全一致）
 */
const ROLE_PERMISSIONS: Record<string, { allowed: string[]; blocked: string[] }> = {
  ADMIN: {
    allowed: ['全部模块：订单、AR、客户、产品、员工、报表、CEO看板、生产、仓库、配送、质量'],
    blocked: [],
  },
  SALES: {
    allowed: ['订单创建/查看', '客户管理', '产品查看', '销售报表', '提成报表'],
    blocked: ['AR模块（收款/发票/核销）'],
  },
  FINANCE: {
    allowed: ['AR全部（收款/发票/核销）', '所有报表', '订单查看', '客户查看'],
    blocked: ['订单创建/修改/删除'],
  },
  PRODUCTION: {
    allowed: ['生产计划', '质量追溯', '产品查看', '订单查看'],
    blocked: ['AR模块', '客户创建/修改'],
  },
  WAREHOUSE: {
    allowed: ['仓库管理', '订单查看', '产品查看'],
    blocked: ['AR模块', '客户创建/修改'],
  },
  DRIVER: {
    allowed: ['配送任务', '订单查看'],
    blocked: ['AR模块', '订单创建', '客户创建'],
  },
};

export default function EmployeeGovernance() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  // 使用sonner的toast
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    phone: '',
    positionCode: '',
  });
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  // 权限检查：仅admin可访问
  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">权限拦截</h2>
            <p className="text-muted-foreground mb-4">
              您的角色无权访问员工治理模块。如需访问，请联系管理员。
            </p>
            <Button onClick={() => navigate('/')}>返回首页</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const employeesQuery = trpc.governance.getEmployees.useQuery({ orgId: 1 });
  const createMutation = trpc.governance.createEmployee.useMutation({
    onSuccess: () => {
      toast.success('创建成功：员工已创建，权限已自动分配');
      setShowCreateDialog(false);
      setNewEmployee({ name: '', phone: '', positionCode: '' });
      employeesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`创建失败：${error.message}`);
    },
  });
  const updatePositionMutation = trpc.governance.updateEmployeePosition.useMutation({
    onSuccess: () => {
      toast.success('职位更新成功：权限已自动重新分配');
      employeesQuery.refetch();
    },
    onError: (error) => {
      toast.error(`更新失败：${error.message}`);
    },
  });

  const commissionQuery = trpc.governance.getCommissionRules.useQuery();

  const handleCreateEmployee = () => {
    if (!newEmployee.name || !newEmployee.phone || !newEmployee.positionCode) {
      toast.error('请填写完整信息');
      return;
    }
    createMutation.mutate({
      orgId: 1,
      name: newEmployee.name,
      phone: newEmployee.phone,
      positionCode: newEmployee.positionCode,
    });
  };

  const getPositionTemplate = (code: string) =>
    POSITION_TEMPLATES.find((p) => p.code === code);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                员工治理中心
              </h1>
              <p className="text-sm text-muted-foreground">
                职位 → 角色 → 权限 自动映射 | 禁止手动修改权限
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6">
        {/* 治理规则说明 */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="h-5 w-5" />
              治理规则（硬编码，不可修改）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {POSITION_TEMPLATES.map((pos) => {
                const perms = ROLE_PERMISSIONS[pos.role];
                return (
                  <div
                    key={pos.code}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedPosition === pos.code
                        ? 'ring-2 ring-primary border-primary'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() =>
                      setSelectedPosition(
                        selectedPosition === pos.code ? null : pos.code,
                      )
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{pos.name}</span>
                      <Badge className={pos.color}>{pos.role}</Badge>
                    </div>
                    {selectedPosition === pos.code && perms && (
                      <div className="mt-2 text-xs space-y-1">
                        <div className="flex items-start gap-1">
                          <Eye className="h-3 w-3 mt-0.5 text-green-600 shrink-0" />
                          <span className="text-green-700">
                            {perms.allowed.join('、')}
                          </span>
                        </div>
                        {perms.blocked.length > 0 && (
                          <div className="flex items-start gap-1">
                            <EyeOff className="h-3 w-3 mt-0.5 text-red-600 shrink-0" />
                            <span className="text-red-700">
                              禁止：{perms.blocked.join('、')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 透明提成规则 */}
        {commissionQuery.data && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                💰 透明提成规则（白纸黑字，杜绝主观评价）
              </CardTitle>
              <CardDescription className="text-base font-semibold text-amber-800">
                公式：{commissionQuery.data.formula}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {commissionQuery.data.description}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">客户类别</th>
                      <th className="text-left py-2 px-3">提成系数</th>
                      <th className="text-left py-2 px-3">坏账扣除规则</th>
                      <th className="text-left py-2 px-3">示例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionQuery.data.rules.map((rule, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2 px-3 font-medium">{rule.category}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline">{(rule.coefficient * 100).toFixed(1)}%</Badge>
                        </td>
                        <td className="py-2 px-3 text-red-600 text-xs">
                          {rule.badDebtDeduction}
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {rule.example}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 员工列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  员工档案
                </CardTitle>
                <CardDescription>
                  选择职位即自动分配角色和权限，无需手动勾选
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => employeesQuery.refetch()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  刷新
                </Button>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="h-4 w-4 mr-1" />
                      创建员工
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>创建员工（自动赋权）</DialogTitle>
                      <DialogDescription>
                        选择职位后，系统将自动分配角色和权限，禁止手动修改。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>姓名</Label>
                        <Input
                          value={newEmployee.name}
                          onChange={(e) =>
                            setNewEmployee({ ...newEmployee, name: e.target.value })
                          }
                          placeholder="请输入员工姓名"
                        />
                      </div>
                      <div>
                        <Label>手机号</Label>
                        <Input
                          value={newEmployee.phone}
                          onChange={(e) =>
                            setNewEmployee({ ...newEmployee, phone: e.target.value })
                          }
                          placeholder="请输入手机号"
                        />
                      </div>
                      <div>
                        <Label>职位（选择后自动分配权限）</Label>
                        <Select
                          value={newEmployee.positionCode}
                          onValueChange={(value) =>
                            setNewEmployee({ ...newEmployee, positionCode: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择职位" />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITION_TEMPLATES.map((pos) => (
                              <SelectItem key={pos.code} value={pos.code}>
                                {pos.name} → {pos.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {newEmployee.positionCode && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            <p className="font-medium">
                              自动分配角色：
                              {getPositionTemplate(newEmployee.positionCode)?.role}
                            </p>
                            {ROLE_PERMISSIONS[
                              getPositionTemplate(newEmployee.positionCode)?.role || ''
                            ]?.blocked.length > 0 && (
                              <p className="text-red-600 mt-1">
                                禁止访问：
                                {ROLE_PERMISSIONS[
                                  getPositionTemplate(newEmployee.positionCode)?.role || ''
                                ]?.blocked.join('、')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateDialog(false)}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleCreateEmployee}
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? '创建中...' : '创建并自动赋权'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {employeesQuery.isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : employeesQuery.error ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p className="text-muted-foreground">
                  无法加载员工数据（backend可能未启动）
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {employeesQuery.error.message}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">ID</th>
                      <th className="text-left py-2 px-3">姓名</th>
                      <th className="text-left py-2 px-3">手机号</th>
                      <th className="text-left py-2 px-3">职位</th>
                      <th className="text-left py-2 px-3">角色</th>
                      <th className="text-left py-2 px-3">状态</th>
                      <th className="text-left py-2 px-3">权限数</th>
                      <th className="text-left py-2 px-3">禁止模块</th>
                      <th className="text-left py-2 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employeesQuery.data || []).map((emp: any) => {
                      const pos = getPositionTemplate(emp.positionCode);
                      const permissions = JSON.parse(emp.permissions || '[]');
                      const blocked = JSON.parse(emp.blockedModules || '[]');
                      return (
                        <tr key={emp.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-3">{emp.id}</td>
                          <td className="py-2 px-3 font-medium">{emp.name}</td>
                          <td className="py-2 px-3">{emp.phone}</td>
                          <td className="py-2 px-3">
                            <Badge className={pos?.color || ''}>
                              {pos?.name || emp.positionCode}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="outline">{emp.roleCode}</Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={
                                emp.status === 'ACTIVE' ? 'default' : 'secondary'
                              }
                            >
                              {emp.status === 'ACTIVE' ? '在职' : '离职'}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <span className="flex items-center gap-1">
                              <Unlock className="h-3 w-3 text-green-600" />
                              {permissions.length}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {blocked.length > 0 ? (
                              <span className="flex items-center gap-1 text-red-600">
                                <Lock className="h-3 w-3" />
                                {blocked.length}
                              </span>
                            ) : (
                              <span className="text-green-600 text-xs">无限制</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Select
                              onValueChange={(value) =>
                                updatePositionMutation.mutate({
                                  employeeId: emp.id,
                                  positionCode: value,
                                })
                              }
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue placeholder="调整职位" />
                              </SelectTrigger>
                              <SelectContent>
                                {POSITION_TEMPLATES.filter(
                                  (p) => p.code !== emp.positionCode,
                                ).map((pos) => (
                                  <SelectItem key={pos.code} value={pos.code}>
                                    {pos.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!employeesQuery.data || employeesQuery.data.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无员工数据。点击"创建员工"开始添加。
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
