import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// 规则类型定义
type CommissionRule = {
  id: number;
  ruleVersion: string;
  category: 'WET_MARKET' | 'WHOLESALE_B' | 'SUPERMARKET' | 'ECOMMERCE' | 'DEFAULT';
  baseRate: number;
  newCustomerBonus: number;
  ruleJson: string | null;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
};

// 规则表单类型
type RuleFormData = {
  ruleVersion: string;
  category: 'WET_MARKET' | 'WHOLESALE_B' | 'SUPERMARKET' | 'ECOMMERCE' | 'DEFAULT';
  baseRate: string;
  newCustomerBonus: string;
  marginWeight: string;
  collectionWeight: string;
  paymentDueDays: string;
  effectiveFrom: string;
};

// 客户类型选项
const CATEGORY_OPTIONS = [
  { value: 'DEFAULT', label: '默认类型' },
  { value: 'WET_MARKET', label: '菜市场类' },
  { value: 'WHOLESALE_B', label: '批发商类' },
  { value: 'SUPERMARKET', label: '商超类' },
  { value: 'ECOMMERCE', label: '电商类' },
];

export default function CommissionRules() {
  // const { toast } = useToast(); // 使用sonner的toast
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CommissionRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    ruleVersion: '',
    category: 'DEFAULT',
    baseRate: '0.02',
    newCustomerBonus: '100',
    marginWeight: '0.5',
    collectionWeight: '0.02',
    paymentDueDays: '30',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });

  // 查询规则列表
  const { data: rules, isLoading, refetch } = trpc.commissionRules.list.useQuery();

  // 创建规则mutation
  const createMutation = trpc.commissionRules.create.useMutation({
    onSuccess: () => {
      toast.success('提成规则已成功创建');
      setIsCreateDialogOpen(false);
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || '无法创建提成规则');
    },
  });

  // 更新规则mutation
  const updateMutation = trpc.commissionRules.update.useMutation({
    onSuccess: () => {
      toast.success('提成规则已成功更新');
      setIsEditDialogOpen(false);
      refetch();
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || '无法更新提成规则');
    },
  });

  // 删除规则mutation
  const deleteMutation = trpc.commissionRules.delete.useMutation({
    onSuccess: () => {
      toast.success('提成规则已成功删除');
      setIsDeleteDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || '无法删除提成规则');
    },
  });

  // 重置表单
  const resetForm = () => {
    setFormData({
      ruleVersion: '',
      category: 'DEFAULT',
      baseRate: '0.02',
      newCustomerBonus: '100',
      marginWeight: '0.5',
      collectionWeight: '0.02',
      paymentDueDays: '30',
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
    setSelectedRule(null);
  };

  // 打开创建对话框
  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (rule: CommissionRule) => {
    setSelectedRule(rule);
    
    // 解析ruleJson
    let ruleJson: any = {};
    if (rule.ruleJson) {
      try {
        ruleJson = JSON.parse(rule.ruleJson);
      } catch (e) {
        console.error('Failed to parse ruleJson:', e);
      }
    }

    setFormData({
      ruleVersion: rule.ruleVersion,
      category: rule.category,
      baseRate: rule.baseRate.toString(),
      newCustomerBonus: rule.newCustomerBonus.toString(),
      marginWeight: (ruleJson.marginWeight || 0.5).toString(),
      collectionWeight: (ruleJson.collectionWeight || 0.02).toString(),
      paymentDueDays: (ruleJson.paymentDueDays || 30).toString(),
      effectiveFrom: rule.effectiveFrom.split('T')[0],
    });
    setIsEditDialogOpen(true);
  };

  // 打开删除对话框
  const handleDelete = (rule: CommissionRule) => {
    setSelectedRule(rule);
    setIsDeleteDialogOpen(true);
  };

  // 提交创建
  const handleSubmitCreate = () => {
    // 构建ruleJson
    const ruleJson = {
      marginWeight: parseFloat(formData.marginWeight),
      collectionWeight: parseFloat(formData.collectionWeight),
      paymentDueDays: parseInt(formData.paymentDueDays),
    };

    createMutation.mutate({
      ruleVersion: formData.ruleVersion,
      category: formData.category,
      baseRate: parseFloat(formData.baseRate),
      newCustomerBonus: parseFloat(formData.newCustomerBonus),
      ruleJson: JSON.stringify(ruleJson),
      effectiveFrom: formData.effectiveFrom,
    });
  };

  // 提交更新
  const handleSubmitUpdate = () => {
    if (!selectedRule) return;

    // 构建ruleJson
    const ruleJson = {
      marginWeight: parseFloat(formData.marginWeight),
      collectionWeight: parseFloat(formData.collectionWeight),
      paymentDueDays: parseInt(formData.paymentDueDays),
    };

    updateMutation.mutate({
      id: selectedRule.id,
      ruleVersion: formData.ruleVersion,
      category: formData.category,
      baseRate: parseFloat(formData.baseRate),
      newCustomerBonus: parseFloat(formData.newCustomerBonus),
      ruleJson: JSON.stringify(ruleJson),
      effectiveFrom: formData.effectiveFrom,
    });
  };

  // 提交删除
  const handleSubmitDelete = () => {
    if (!selectedRule) return;
    deleteMutation.mutate({ id: selectedRule.id });
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  // 格式化百分比
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  // 获取类别标签
  const getCategoryLabel = (category: string) => {
    const option = CATEGORY_OPTIONS.find((opt) => opt.value === category);
    return option?.label || category;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">提成规则管理</h1>
          <p className="text-muted-foreground mt-2">
            管理不同客户类型的提成计算规则
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          创建规则
        </Button>
      </div>

      {/* 规则列表 */}
      <Card>
        <CardHeader>
          <CardTitle>规则列表</CardTitle>
          <CardDescription>
            查看和管理所有提成规则版本
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无提成规则</p>
              <p className="text-sm mt-2">点击"创建规则"按钮添加第一条规则</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>规则版本</TableHead>
                    <TableHead>客户类型</TableHead>
                    <TableHead>基础利率</TableHead>
                    <TableHead>新客户奖励</TableHead>
                    <TableHead>毛利权重</TableHead>
                    <TableHead>回款权重</TableHead>
                    <TableHead>账期天数</TableHead>
                    <TableHead>生效日期</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule: CommissionRule) => {
                    let ruleJson: any = {};
                    if (rule.ruleJson) {
                      try {
                        ruleJson = JSON.parse(rule.ruleJson);
                      } catch (e) {
                        console.error('Failed to parse ruleJson:', e);
                      }
                    }

                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.ruleVersion}</TableCell>
                        <TableCell>{getCategoryLabel(rule.category)}</TableCell>
                        <TableCell>{formatPercent(rule.baseRate)}</TableCell>
                        <TableCell>¥{rule.newCustomerBonus}</TableCell>
                        <TableCell>
                          {ruleJson.marginWeight ? formatPercent(ruleJson.marginWeight) : '-'}
                        </TableCell>
                        <TableCell>
                          {ruleJson.collectionWeight ? formatPercent(ruleJson.collectionWeight) : '-'}
                        </TableCell>
                        <TableCell>
                          {ruleJson.paymentDueDays ? `${ruleJson.paymentDueDays}天` : '-'}
                        </TableCell>
                        <TableCell>{formatDate(rule.effectiveFrom)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(rule)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(rule)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建规则对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建提成规则</DialogTitle>
            <DialogDescription>
              配置新的提成规则版本，设置不同客户类型的计算参数
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* 规则版本 */}
            <div className="space-y-2">
              <Label htmlFor="create-ruleVersion">规则版本 *</Label>
              <Input
                id="create-ruleVersion"
                placeholder="例如：2026-V2"
                value={formData.ruleVersion}
                onChange={(e) => setFormData({ ...formData, ruleVersion: e.target.value })}
              />
            </div>

            {/* 客户类型 */}
            <div className="space-y-2">
              <Label htmlFor="create-category">客户类型 *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="create-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 基础利率 */}
            <div className="space-y-2">
              <Label htmlFor="create-baseRate">基础利率 *</Label>
              <Input
                id="create-baseRate"
                type="number"
                step="0.001"
                placeholder="例如：0.02"
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                当前值：{formatPercent(parseFloat(formData.baseRate) || 0)}
              </p>
            </div>

            {/* 新客户奖励 */}
            <div className="space-y-2">
              <Label htmlFor="create-newCustomerBonus">新客户奖励（元）*</Label>
              <Input
                id="create-newCustomerBonus"
                type="number"
                step="10"
                placeholder="例如：100"
                value={formData.newCustomerBonus}
                onChange={(e) => setFormData({ ...formData, newCustomerBonus: e.target.value })}
              />
            </div>

            {/* 毛利权重 */}
            <div className="space-y-2">
              <Label htmlFor="create-marginWeight">毛利权重</Label>
              <Input
                id="create-marginWeight"
                type="number"
                step="0.01"
                placeholder="例如：0.5"
                value={formData.marginWeight}
                onChange={(e) => setFormData({ ...formData, marginWeight: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                当前值：{formatPercent(parseFloat(formData.marginWeight) || 0)}
              </p>
            </div>

            {/* 回款权重 */}
            <div className="space-y-2">
              <Label htmlFor="create-collectionWeight">回款权重</Label>
              <Input
                id="create-collectionWeight"
                type="number"
                step="0.001"
                placeholder="例如：0.02"
                value={formData.collectionWeight}
                onChange={(e) => setFormData({ ...formData, collectionWeight: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                当前值：{formatPercent(parseFloat(formData.collectionWeight) || 0)}
              </p>
            </div>

            {/* 账期天数 */}
            <div className="space-y-2">
              <Label htmlFor="create-paymentDueDays">账期天数</Label>
              <Input
                id="create-paymentDueDays"
                type="number"
                step="1"
                placeholder="例如：30"
                value={formData.paymentDueDays}
                onChange={(e) => setFormData({ ...formData, paymentDueDays: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                超过此天数的收款不计入提成
              </p>
            </div>

            {/* 生效日期 */}
            <div className="space-y-2">
              <Label htmlFor="create-effectiveFrom">生效日期 *</Label>
              <Input
                id="create-effectiveFrom"
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmitCreate}
              disabled={createMutation.isPending || !formData.ruleVersion}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑规则对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑提成规则</DialogTitle>
            <DialogDescription>
              修改提成规则的配置参数
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {/* 与创建对话框相同的表单字段 */}
            {/* 规则版本 */}
            <div className="space-y-2">
              <Label htmlFor="edit-ruleVersion">规则版本 *</Label>
              <Input
                id="edit-ruleVersion"
                placeholder="例如：2026-V2"
                value={formData.ruleVersion}
                onChange={(e) => setFormData({ ...formData, ruleVersion: e.target.value })}
              />
            </div>

            {/* 客户类型 */}
            <div className="space-y-2">
              <Label htmlFor="edit-category">客户类型 *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: any) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 基础利率 */}
            <div className="space-y-2">
              <Label htmlFor="edit-baseRate">基础利率 *</Label>
              <Input
                id="edit-baseRate"
                type="number"
                step="0.001"
                placeholder="例如：0.02"
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                当前值：{formatPercent(parseFloat(formData.baseRate) || 0)}
              </p>
            </div>

            {/* 新客户奖励 */}
            <div className="space-y-2">
              <Label htmlFor="edit-newCustomerBonus">新客户奖励（元）*</Label>
              <Input
                id="edit-newCustomerBonus"
                type="number"
                step="10"
                placeholder="例如：100"
                value={formData.newCustomerBonus}
                onChange={(e) => setFormData({ ...formData, newCustomerBonus: e.target.value })}
              />
            </div>

            {/* 毛利权重 */}
            <div className="space-y-2">
              <Label htmlFor="edit-marginWeight">毛利权重</Label>
              <Input
                id="edit-marginWeight"
                type="number"
                step="0.01"
                placeholder="例如：0.5"
                value={formData.marginWeight}
                onChange={(e) => setFormData({ ...formData, marginWeight: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                当前值：{formatPercent(parseFloat(formData.marginWeight) || 0)}
              </p>
            </div>

            {/* 回款权重 */}
            <div className="space-y-2">
              <Label htmlFor="edit-collectionWeight">回款权重</Label>
              <Input
                id="edit-collectionWeight"
                type="number"
                step="0.001"
                placeholder="例如：0.02"
                value={formData.collectionWeight}
                onChange={(e) => setFormData({ ...formData, collectionWeight: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                当前值：{formatPercent(parseFloat(formData.collectionWeight) || 0)}
              </p>
            </div>

            {/* 账期天数 */}
            <div className="space-y-2">
              <Label htmlFor="edit-paymentDueDays">账期天数</Label>
              <Input
                id="edit-paymentDueDays"
                type="number"
                step="1"
                placeholder="例如：30"
                value={formData.paymentDueDays}
                onChange={(e) => setFormData({ ...formData, paymentDueDays: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                超过此天数的收款不计入提成
              </p>
            </div>

            {/* 生效日期 */}
            <div className="space-y-2">
              <Label htmlFor="edit-effectiveFrom">生效日期 *</Label>
              <Input
                id="edit-effectiveFrom"
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmitUpdate}
              disabled={updateMutation.isPending || !formData.ruleVersion}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              您确定要删除规则版本 <strong>{selectedRule?.ruleVersion}</strong> 吗？
              此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmitDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
