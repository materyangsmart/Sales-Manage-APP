import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ============================================================
// MS10 增长引擎管理台
// Epic 1: 自助下单激励统计
// Epic 2: B2B 裂变推荐管理
// Epic 3: 智能流失预警雷达
// ============================================================

export default function GrowthEngine() {
  const [activeTab, setActiveTab] = useState("incentive");

  // ---- Epic 1: 订单来源统计 ----
  const { data: incentiveStats, isLoading: statsLoading } =
    trpc.growthIncentive.getStats.useQuery();

  // ---- Epic 2: 推荐记录列表 ----
  const { data: referralList, isLoading: referralLoading, refetch: refetchReferral } =
    trpc.referral.list.useQuery({ limit: 50 });

  // ---- Epic 3: 流失预警列表 ----
  const { data: churnAlerts, isLoading: churnLoading, refetch: refetchChurn } =
    trpc.churnRadar.listAlerts.useQuery({ limit: 50 });

  const runScanMutation = trpc.churnRadar.runScan.useMutation({
    onSuccess: (data) => {
      toast.success(`流失扫描完成：扫描 ${data.scanned} 个客户，高风险 ${data.highRisk} 个，中风险 ${data.mediumRisk} 个，新建预警 ${data.alertsCreated} 条`);
      refetchChurn();
    },
    onError: (err) => {
      toast.error(`扫描失败：${err.message}`);
    },
  });

  const resolveAlertMutation = trpc.churnRadar.resolve.useMutation({
    onSuccess: () => {
      toast.success("预警已标记处理");
      refetchChurn();
    },
  });

  // 来源标签颜色
  const sourceColor: Record<string, string> = {
    WECHAT_H5: "bg-green-100 text-green-800",
    PORTAL: "bg-blue-100 text-blue-800",
    SALES_PORTAL: "bg-orange-100 text-orange-800",
    WEBSITE: "bg-gray-100 text-gray-800",
    MANUAL: "bg-purple-100 text-purple-800",
  };

  const sourceLabel: Record<string, string> = {
    WECHAT_H5: "微信H5",
    PORTAL: "客户门户",
    SALES_PORTAL: "销售代下",
    WEBSITE: "官网",
    MANUAL: "手工录入",
  };

  const riskBadge = (level: string) => {
    if (level === "HIGH") return <Badge variant="destructive">高风险</Badge>;
    if (level === "MEDIUM") return <Badge className="bg-yellow-500 text-white">中风险</Badge>;
    return <Badge variant="secondary">低风险</Badge>;
  };

  const referralStatusBadge = (status: string) => {
    if (status === "REWARDED") return <Badge className="bg-green-600 text-white">已奖励</Badge>;
    if (status === "EXPIRED") return <Badge variant="secondary">已过期</Badge>;
    return <Badge className="bg-blue-500 text-white">待奖励</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">增长引擎管理台</h1>
        <p className="text-gray-500 mt-1">
          Mega-Sprint 10 · 自助激励 · 裂变推荐 · 流失预警
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="incentive">Epic 1 · 自助激励</TabsTrigger>
          <TabsTrigger value="referral">Epic 2 · 裂变推荐</TabsTrigger>
          <TabsTrigger value="churn">Epic 3 · 流失预警</TabsTrigger>
        </TabsList>

        {/* ---- Epic 1: 自助下单激励统计 ---- */}
        <TabsContent value="incentive" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">提成规则说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">微信H5 / 客户门户</span>
                    <span className="font-bold text-green-600">1.2x 提成</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">销售代下单</span>
                    <span className="font-bold text-orange-600">0.8x 提成</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">官网 / 手工</span>
                    <span className="font-bold text-gray-600">1.0x 提成</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">线上补贴规则</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <p className="text-gray-600">适用渠道：微信H5 / 客户门户</p>
                  <p className="font-bold text-blue-600 text-lg">满 100 元 减 5 元</p>
                  <p className="text-gray-400 text-xs">每笔订单自动计算，无需手动申请</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">渠道订单统计</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <p className="text-gray-400 text-sm">加载中...</p>
                ) : incentiveStats && Object.keys(incentiveStats).length > 0 ? (
                  <div className="space-y-1">
                    {Object.entries(incentiveStats).map(([src, stat]: [string, any]) => (
                      <div key={src} className="flex justify-between text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${sourceColor[src] || "bg-gray-100"}`}>
                          {sourceLabel[src] || src}
                        </span>
                        <span className="text-gray-700">{stat.count} 单</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">暂无数据</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Epic 2: 裂变推荐管理 ---- */}
        <TabsContent value="referral" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">推荐记录列表</CardTitle>
              <p className="text-sm text-gray-500">
                推荐人邀请新客户注册，被推荐人完成首单付款后，推荐人获得 50 元信用额度奖励
              </p>
            </CardHeader>
            <CardContent>
              {referralLoading ? (
                <p className="text-gray-400 text-sm">加载中...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邀请码</TableHead>
                      <TableHead>推荐人</TableHead>
                      <TableHead>被推荐人</TableHead>
                      <TableHead>奖励金额</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>奖励时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referralList && referralList.length > 0 ? (
                      referralList.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-xs">{record.referralCode}</TableCell>
                          <TableCell>{record.referrerName || `用户#${record.referrerId}`}</TableCell>
                          <TableCell>
                            {record.refereeId === 0 ? (
                              <span className="text-gray-400 text-xs">待绑定</span>
                            ) : (
                              record.refereeName || `用户#${record.refereeId}`
                            )}
                          </TableCell>
                          <TableCell className="font-bold text-green-600">
                            ¥{record.rewardAmount}
                          </TableCell>
                          <TableCell>{referralStatusBadge(record.status)}</TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {record.rewardedAt
                              ? new Date(record.rewardedAt).toLocaleDateString("zh-CN")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                          暂无推荐记录
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Epic 3: 流失预警雷达 ---- */}
        <TabsContent value="churn" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800">流失预警雷达</h3>
              <p className="text-sm text-gray-500">
                当客户距上次下单天数 &gt; 平均复购周期 × 1.5 时触发预警
              </p>
            </div>
            <Button
              onClick={() => runScanMutation.mutate()}
              disabled={runScanMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {runScanMutation.isPending ? "扫描中..." : "立即扫描"}
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              {churnLoading ? (
                <p className="text-gray-400 text-sm">加载中...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户</TableHead>
                      <TableHead>负责销售</TableHead>
                      <TableHead>距上次下单</TableHead>
                      <TableHead>平均复购周期</TableHead>
                      <TableHead>预警阈值</TableHead>
                      <TableHead>风险等级</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {churnAlerts && churnAlerts.length > 0 ? (
                      churnAlerts.map((alert: any) => (
                        <TableRow key={alert.id}>
                          <TableCell className="font-medium">{alert.customerName}</TableCell>
                          <TableCell className="text-gray-600">{alert.salesName || "未分配"}</TableCell>
                          <TableCell className="font-bold text-red-600">
                            {parseFloat(alert.daysSinceLastOrder).toFixed(0)} 天
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {parseFloat(alert.avgRepurchaseDays).toFixed(1)} 天
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {parseFloat(alert.thresholdDays).toFixed(1)} 天
                          </TableCell>
                          <TableCell>{riskBadge(alert.riskLevel)}</TableCell>
                          <TableCell>
                            {alert.resolvedAt ? (
                              <Badge variant="secondary">已处理</Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800">待跟进</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!alert.resolvedAt && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveAlertMutation.mutate({ alertId: alert.id })}
                                disabled={resolveAlertMutation.isPending}
                              >
                                标记处理
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                          暂无流失预警记录，点击"立即扫描"开始检测
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
