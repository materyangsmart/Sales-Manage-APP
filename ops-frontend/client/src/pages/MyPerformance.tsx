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
import { TrendingUp, DollarSign, Users, Package, Info, Store, ShoppingCart, Warehouse } from "lucide-react";
import { trpc } from "@/lib/trpc";

// 客户类型图标和颜色映射
const CATEGORY_CONFIG: Record<string, {
  icon: typeof Store;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  WET_MARKET: {
    icon: Store,
    label: '菜市场',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  SUPERMARKET: {
    icon: ShoppingCart,
    label: '商超',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  WHOLESALE_B: {
    icon: Warehouse,
    label: '批发商',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
};

export default function MyPerformance() {
  const [showFormulaDialog, setShowFormulaDialog] = useState(false);
  
  // 获取当前用户的个人业绩数据（后端返回categoryBreakdown分类统计）
  const { data: performance, isLoading, error } = trpc.commission.myPerformance.useQuery();

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

  if (error) {
    return (
      <div className="container py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600">
            <p className="font-medium">加载业绩数据失败</p>
            <p className="text-sm mt-1">{error.message}</p>
          </CardContent>
        </Card>
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

  // 从后端返回的categoryBreakdown中提取分类提成数据
  const categoryBreakdown: any[] = performance?.categoryBreakdown || [];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">我的业绩</h1>
        <p className="text-muted-foreground mt-2">
          查看您的个人销售业绩和按客户类型分类的提成明细
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

      {/* 分类提成明细卡片（核心：按客户类型分别展示） */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>分类提成明细</CardTitle>
              <CardDescription>按客户类型（菜市场 / 商超 / 批发商）分别聚合计算</CardDescription>
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
          <div className="space-y-6">
            {categoryBreakdown.length > 0 ? (
              categoryBreakdown.map((cat: any) => {
                const config = CATEGORY_CONFIG[cat.category] || {
                  icon: Package,
                  label: cat.categoryLabel || cat.category,
                  color: 'text-gray-700',
                  bgColor: 'bg-gray-50',
                  borderColor: 'border-gray-200',
                };
                const CatIcon = config.icon;

                return (
                  <div
                    key={cat.category}
                    className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-5`}
                  >
                    {/* 分类标题 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CatIcon className={`h-5 w-5 ${config.color}`} />
                        <span className={`text-lg font-bold ${config.color}`}>
                          {config.label}
                        </span>
                        <Badge variant="outline" className="ml-2">
                          {cat.orderCount || 0} 单
                        </Badge>
                      </div>
                      <div className={`text-2xl font-bold ${config.color}`}>
                        ¥{(cat.netCommission || 0).toLocaleString()}
                      </div>
                    </div>

                    {/* 分类明细网格 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-white/60 rounded-lg p-3">
                        <div className="text-muted-foreground">发货总额</div>
                        <div className="font-semibold text-lg">
                          ¥{(cat.deliveryAmount || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3">
                        <div className="text-muted-foreground">
                          基础提成 ({((cat.baseRate || 0) * 100).toFixed(1)}%)
                        </div>
                        <div className="font-semibold text-lg text-green-600">
                          +¥{(cat.baseCommission || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3">
                        <div className="text-muted-foreground">
                          逾期扣减 ({((cat.overdueDeductionRate || 0) * 100).toFixed(1)}%)
                        </div>
                        <div className="font-semibold text-lg text-red-600">
                          {(cat.overdueDeduction || 0) > 0 ? `-¥${(cat.overdueDeduction || 0).toLocaleString()}` : '¥0'}
                        </div>
                        {(cat.overdueAmount || 0) > 0 && (
                          <div className="text-xs text-red-500 mt-1">
                            逾期金额: ¥{(cat.overdueAmount || 0).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="bg-white/60 rounded-lg p-3">
                        <div className="text-muted-foreground">
                          新客奖金 (¥{cat.newCustomerBonus || 0}/人)
                        </div>
                        <div className="font-semibold text-lg text-blue-600">
                          +¥{(cat.newCustomerCommission || 0).toLocaleString()}
                        </div>
                        {(cat.newCustomerCount || 0) > 0 && (
                          <div className="text-xs text-blue-500 mt-1">
                            新增 {cat.newCustomerCount} 个客户
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无分类提成数据
              </div>
            )}

            {/* 总提成汇总 */}
            <div className="flex items-center justify-between p-5 rounded-lg bg-primary/10 border-2 border-primary">
              <div>
                <div className="text-lg font-bold">实时提成总额</div>
                <div className="text-sm text-muted-foreground">
                  = Σ (各分类发货额 × 分类利率) - Σ (分类逾期额 × 分类扣减率) + Σ (分类新客数 × 分类奖金)
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
            <DialogTitle>多维度提成计算公式</DialogTitle>
            <DialogDescription>
              按客户类型分别应用不同利率和扣减率
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">核心公式</h3>
              <div className="p-4 bg-muted rounded-lg font-mono text-sm leading-relaxed">
                <div>分类提成 = (分类发货额 × 分类基础利率)</div>
                <div className="ml-12">- (分类逾期额 × 分类逾期扣减率)</div>
                <div className="ml-12">+ (分类新客数 × 分类新客奖金)</div>
                <div className="mt-2 border-t pt-2">总提成 = Σ 各分类提成</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">各客户类型参数</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">客户类型</th>
                      <th className="text-right p-2 font-medium">基础利率</th>
                      <th className="text-right p-2 font-medium">逾期扣减率</th>
                      <th className="text-right p-2 font-medium">新客奖金</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-orange-50">
                      <td className="p-2 flex items-center gap-2">
                        <Store className="h-4 w-4 text-orange-600" />
                        菜市场
                      </td>
                      <td className="text-right p-2 font-medium">2.0%</td>
                      <td className="text-right p-2 text-red-600">0.5%</td>
                      <td className="text-right p-2 text-blue-600">¥300</td>
                    </tr>
                    <tr className="border-b bg-blue-50">
                      <td className="p-2 flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                        商超
                      </td>
                      <td className="text-right p-2 font-medium">1.5%</td>
                      <td className="text-right p-2 text-red-600">0.3%</td>
                      <td className="text-right p-2 text-blue-600">¥800</td>
                    </tr>
                    <tr className="bg-purple-50">
                      <td className="p-2 flex items-center gap-2">
                        <Warehouse className="h-4 w-4 text-purple-600" />
                        批发商
                      </td>
                      <td className="text-right p-2 font-medium">1.0%</td>
                      <td className="text-right p-2 text-red-600">0.2%</td>
                      <td className="text-right p-2 text-blue-600">¥1,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>注意：</strong>提成数据实时计算，基于后端 commission_rules 表配置。
                不同客户类型的利率和扣减率由管理员在提成规则中设定。最终以财务部门核算为准。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
