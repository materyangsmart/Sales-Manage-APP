import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, TrendingUp, Package, Users, DollarSign } from 'lucide-react';

export default function CommissionStats() {
  const [orgId, setOrgId] = useState('2'); // 默认组织ID
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-01-31');
  const [ruleVersion, setRuleVersion] = useState('2026-V1');
  const [customerCategory, setCustomerCategory] = useState<string>('ALL'); // 客户类型过滤器
  const [shouldFetch, setShouldFetch] = useState(false);

  // 使用tRPC查询KPI统计
  const queryInput = useMemo(() => ({
    orgId: parseInt(orgId),
    startDate,
    endDate,
    ruleVersion,
    customerCategory: customerCategory === 'ALL' ? undefined : (customerCategory as 'WET_MARKET' | 'WHOLESALE_B' | 'SUPERMARKET' | 'ECOMMERCE' | 'DEFAULT'),
  }), [orgId, startDate, endDate, ruleVersion, customerCategory]);

  const { data, isLoading, error } = trpc.commission.getKpiStats.useQuery(
    queryInput,
    {
      enabled: shouldFetch && !!orgId && !!startDate && !!endDate && !!ruleVersion,
    }
  );

  const handleQuery = () => {
    console.log('[CommissionStats] Query triggered with params:', queryInput);
    console.log('[CommissionStats] Enabled conditions:', {
      shouldFetch,
      hasOrgId: !!orgId,
      hasStartDate: !!startDate,
      hasEndDate: !!endDate,
      hasRuleVersion: !!ruleVersion,
    });
    setShouldFetch(true);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">提成查询</h1>
        <p className="text-muted-foreground mt-2">
          查询销售人员的KPI指标和提成计算结果
        </p>
      </div>

      {/* 查询条件 */}
      <Card>
        <CardHeader>
          <CardTitle>查询条件</CardTitle>
          <CardDescription>选择日期范围、组织和规则版本</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 组织选择 */}
            <div className="space-y-2">
              <Label htmlFor="orgId">组织</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger id="orgId">
                  <SelectValue placeholder="选择组织" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">千张食品（总部）</SelectItem>
                  <SelectItem value="2">千张食品（华东区）</SelectItem>
                  <SelectItem value="3">千张食品（华南区）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 开始日期 */}
            <div className="space-y-2">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* 结束日期 */}
            <div className="space-y-2">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* 规则版本 */}
            <div className="space-y-2">
              <Label htmlFor="ruleVersion">规则版本</Label>
              <Select value={ruleVersion} onValueChange={setRuleVersion}>
                <SelectTrigger id="ruleVersion">
                  <SelectValue placeholder="选择规则版本" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026-V1">2026-V1</SelectItem>
                  <SelectItem value="2026-V2">2026-V2</SelectItem>
                  <SelectItem value="2025-V1">2025-V1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 客户类型选择 */}
            <div className="space-y-2">
              <Label htmlFor="customerCategory">客户类型</Label>
              <Select value={customerCategory} onValueChange={setCustomerCategory}>
                <SelectTrigger id="customerCategory">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部类型</SelectItem>
                  <SelectItem value="WET_MARKET">菜市场类</SelectItem>
                  <SelectItem value="WHOLESALE_B">批发商类</SelectItem>
                  <SelectItem value="SUPERMARKET">商超类</SelectItem>
                  <SelectItem value="ECOMMERCE">电商类</SelectItem>
                  <SelectItem value="DEFAULT">默认类型</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={handleQuery} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              查询
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">查询失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error.message || '无法获取KPI统计数据，请稍后重试'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI指标卡片 */}
      {data?.success && data.data && (
        <>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">KPI指标</h2>
            <p className="text-sm text-muted-foreground mt-1">
              统计期间：{data.data.period.startDate} 至 {data.data.period.endDate}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 发货总额 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">发货总额</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ¥{data.data.kpi.totalShippedAmount.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  已履行订单金额总计
                </p>
              </CardContent>
            </Card>

            {/* 订单数 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">订单数</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.data.kpi.fulfilledOrderCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  已履行订单数量
                </p>
              </CardContent>
            </Card>

            {/* 新增客户数 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">新增客户数</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.data.kpi.newCustomerCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  期间内新增的有效客户
                </p>
              </CardContent>
            </Card>

            {/* 毛利总额（SUPERMARKET类别显示） */}
            {data.data.category === 'SUPERMARKET' && data.data.kpi.totalMargin !== undefined && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">毛利总额</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ¥{data.data.kpi.totalMargin.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    商超类核心指标
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 账期内收款（WET_MARKET/WHOLESALE_B类别显示） */}
            {(data.data.category === 'WET_MARKET' || data.data.category === 'WHOLESALE_B') && data.data.kpi.validPaymentAmount !== undefined && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">账期内收款</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ¥{data.data.kpi.validPaymentAmount.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    地推型/批发型核心指标
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 提成明细 */}
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">提成明细</h2>
            <p className="text-sm text-muted-foreground mt-1">
              规则版本：{data.data.ruleVersion} (基础利率: {(data.data.rule.baseRate * 100).toFixed(2)}%, 新客奖励: ¥{data.data.rule.newCustomerBonus})
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                提成计算结果
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 基础提成 */}
              <div className="flex justify-between items-center pb-3 border-b">
                <div>
                  <p className="font-medium">基础提成</p>
                  <p className="text-sm text-muted-foreground">
                    发货总额 × 基础利率 (¥{data.data.kpi.totalShippedAmount.toLocaleString()} × {(data.data.rule.baseRate * 100).toFixed(2)}%)
                  </p>
                </div>
                <div className="text-xl font-bold">
                  ¥{data.data.commission.baseCommission.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              {/* 毛利提成（SUPERMARKET类别） */}
              {data.data.commission.marginCommission !== undefined && data.data.commission.marginCommission > 0 && (
                <div className="flex justify-between items-center pb-3 border-b">
                  <div>
                    <p className="font-medium">毛利提成</p>
                    <p className="text-sm text-muted-foreground">
                      毛利总额 × 毛利权重 (商超类核心指标)
                    </p>
                  </div>
                  <div className="text-xl font-bold">
                    ¥{data.data.commission.marginCommission.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}

              {/* 回款提成（WET_MARKET/WHOLESALE_B类别） */}
              {data.data.commission.collectionCommission !== undefined && data.data.commission.collectionCommission > 0 && (
                <div className="flex justify-between items-center pb-3 border-b">
                  <div>
                    <p className="font-medium">回款提成</p>
                    <p className="text-sm text-muted-foreground">
                      账期内收款 × 回款权重 (地推型/批发型核心指标)
                    </p>
                  </div>
                  <div className="text-xl font-bold">
                    ¥{data.data.commission.collectionCommission.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}

              {/* 新客户提成 */}
              {data.data.commission.newCustomerCommission !== undefined && data.data.commission.newCustomerCommission > 0 && (
                <div className="flex justify-between items-center pb-3 border-b">
                  <div>
                    <p className="font-medium">新客户奖励</p>
                    <p className="text-sm text-muted-foreground">
                      新增客户数 × 奖励基数 ({data.data.kpi.newCustomerCount} × ¥{data.data.rule.newCustomerBonus})
                    </p>
                  </div>
                  <div className="text-xl font-bold">
                    ¥{data.data.commission.newCustomerCommission.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}

              {/* 总提成 */}
              <div className="flex justify-between items-center pt-2">
                <div>
                  <p className="text-lg font-semibold">总提成</p>
                  <p className="text-sm text-muted-foreground">
                    基础提成 + 毛利提成 + 回款提成 + 新客户奖励
                  </p>
                </div>
                <div className="text-3xl font-bold text-primary">
                  ¥{data.data.commission.totalCommission.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 空状态 */}
      {!data && !isLoading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">请选择查询条件并点击查询按钮</p>
            <p className="text-sm text-muted-foreground mt-2">
              系统将根据您选择的日期范围和规则版本计算KPI指标和提成
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
