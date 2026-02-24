import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TrendingUp, DollarSign, Users, Package, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function MyPerformance() {
  const [showFormulaDialog, setShowFormulaDialog] = useState(false);
  
  // 获取当前用户的个人业绩数据
  const { data: performance, isLoading } = trpc.commission.myPerformance.useQuery();

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      title: "发货总额",
      value: `¥${(performance?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "订单数",
      value: performance?.orderCount || 0,
      icon: Package,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "新增客户数",
      value: performance?.newCustomerCount || 0,
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "回款率",
      value: `${((performance?.paymentRate || 0) * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">我的业绩</h1>
        <p className="text-muted-foreground mt-2">
          查看您的个人销售业绩和提成明细
        </p>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 提成明细卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>提成明细</CardTitle>
              <CardDescription>基于您的业绩计算的实时提成</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFormulaDialog(true)}
            >
              <Info className="h-4 w-4 mr-2" />
              查看公式
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 基础提成 */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <div className="font-medium">基础提成 (2%)</div>
                <div className="text-sm text-muted-foreground">
                  发货总额 × 2%
                </div>
              </div>
              <div className="text-xl font-bold text-green-600">
                +¥{((performance?.totalRevenue || 0) * 0.02).toLocaleString()}
              </div>
            </div>

            {/* 逾期扣减 */}
            {(performance?.overdueAmount || 0) > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50">
                <div>
                  <div className="font-medium text-red-700">逾期扣减 (0.5%)</div>
                  <div className="text-sm text-red-600">
                    逾期金额 × 0.5%
                  </div>
                </div>
                <div className="text-xl font-bold text-red-600">
                  -¥{((performance?.overdueAmount || 0) * 0.005).toLocaleString()}
                </div>
              </div>
            )}

            {/* 新客奖金 */}
            {(performance?.newCustomerCount || 0) > 0 && (
              <div className="flex items-center justify-between p-4 rounded-lg border border-blue-200 bg-blue-50">
                <div>
                  <div className="font-medium text-blue-700">新客奖金</div>
                  <div className="text-sm text-blue-600">
                    {performance?.newCustomerCount} 个新客户 × ¥500
                  </div>
                </div>
                <div className="text-xl font-bold text-blue-600">
                  +¥{((performance?.newCustomerCount || 0) * 500).toLocaleString()}
                </div>
              </div>
            )}

            {/* 总提成 */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10 border-2 border-primary">
              <div>
                <div className="text-lg font-bold">实时提成总额</div>
                <div className="text-sm text-muted-foreground">
                  规则版本: 2026-V1
                </div>
              </div>
              <div className="text-3xl font-bold text-primary">
                ¥{(performance?.totalCommission || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 提成计算公式对话框 */}
      <Dialog open={showFormulaDialog} onOpenChange={setShowFormulaDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>提成计算公式</DialogTitle>
            <DialogDescription>
              规则版本: 2026-V1 | 更新日期: 2026-01-01
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">计算公式</h3>
              <div className="p-4 bg-muted rounded-lg font-mono text-sm">
                总提成 = 基础提成 - 逾期扣减 + 新客奖金
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50">基础提成</Badge>
                </h4>
                <p className="text-sm text-muted-foreground">
                  发货总额 × 2%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  说明：基于您的总发货金额计算，按月结算
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-50">逾期扣减</Badge>
                </h4>
                <p className="text-sm text-muted-foreground">
                  逾期回款金额 × 0.5%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  说明：超过账期未回款的订单，将按逾期金额扣减提成
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50">新客奖金</Badge>
                </h4>
                <p className="text-sm text-muted-foreground">
                  新增客户数 × ¥500
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  说明：每开发一个新客户，奖励500元
                </p>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>注意：</strong>提成数据每日更新，最终以财务部门核算为准。如有疑问，请联系财务主管。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
