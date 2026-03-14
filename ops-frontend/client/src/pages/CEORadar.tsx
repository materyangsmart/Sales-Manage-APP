import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, TrendingDown, Users, Package, MessageSquareWarning, Bell, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

export default function CEORadar() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = trpc.auth.me.useQuery();

  // 限制仅CEO角色可见
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      setLocation('/');
    }
  }, [currentUser, setLocation]);

  const { data: radarData, isLoading, refetch } = trpc.ceo.getRadarData.useQuery(
    undefined,
    {
      enabled: !!currentUser && currentUser.role === 'admin',
      refetchInterval: 30000, // 每30秒自动刷新
    }
  );

  if (!currentUser || currentUser.role !== 'admin') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  const unreadCount = radarData?.unreadComplaintCount || 0;
  const totalAlerts =
    (radarData?.badDebtRisks?.length || 0) +
    (radarData?.yieldAnomalies?.length || 0) +
    (radarData?.churnRisks?.length || 0) +
    (radarData?.complaintAlerts?.length || 0);

  return (
    <div className="container py-6 space-y-6">
      {/* 页面标题 + 总览 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            经营异常雷达
            {totalAlerts > 0 && (
              <Badge variant="destructive" className="text-lg px-3 py-1 animate-pulse">
                {totalAlerts} 项异常
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-2">
            实时监控经营红线，只抓取"不对劲"的数据 | 仅CEO可见
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          手动刷新
        </Button>
      </div>

      {/* 投诉红点闪烁提醒 —— P25核心：质量投诉直达CEO */}
      {unreadCount > 0 && (
        <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Bell className="w-6 h-6 animate-bounce" />
              <span className="animate-pulse">质量投诉警报</span>
              <Badge variant="destructive" className="animate-pulse ml-2">
                {unreadCount} 条未读
              </Badge>
            </CardTitle>
            <CardDescription className="text-red-500">
              终端客户投诉直达CEO看板，跳过销售和片区中层
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {radarData?.complaintAlerts?.map((alert: any) => (
                <div
                  key={alert.id}
                  className="border border-red-400 rounded-lg p-4 bg-white dark:bg-red-950/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquareWarning className="w-4 h-4 text-red-500" />
                      <span className="font-medium">投诉 #{alert.id}</span>
                      <Badge
                        variant={
                          alert.severity === 'CRITICAL'
                            ? 'destructive'
                            : alert.severity === 'HIGH'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {alert.severity === 'CRITICAL'
                          ? '紧急'
                          : alert.severity === 'HIGH'
                          ? '高危'
                          : alert.severity === 'MEDIUM'
                          ? '中等'
                          : '低'}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">批次号: </span>
                    <span className="font-mono font-medium">{alert.batchNo}</span>
                  </div>
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">投诉人: </span>
                    <span className="font-medium">{alert.complainantName}</span>
                  </div>
                  <div className="text-sm bg-red-100 dark:bg-red-900/20 rounded p-2">
                    {alert.complaintContent}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 坏账风险对冲 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            坏账风险对冲
            {radarData?.badDebtRisks && radarData.badDebtRisks.length > 0 && (
              <Badge variant="destructive">{radarData.badDebtRisks.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            15天以上未核销金额 × 客户信用分 = 预估损失额（真实SQL聚合查询ar_invoices）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {radarData?.badDebtRisks && radarData.badDebtRisks.length > 0 ? (
            <div className="space-y-3">
              {radarData.badDebtRisks.map((risk: any) => (
                <div
                  key={risk.customerId}
                  className={`border rounded-lg p-4 ${
                    risk.estimatedLoss > 10000 ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{risk.customerName}</div>
                    <Badge variant={risk.estimatedLoss > 10000 ? 'destructive' : 'secondary'}>
                      预估损失: ¥{Number(risk.estimatedLoss).toFixed(2)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>
                      <div>未核销金额</div>
                      <div className="font-medium text-foreground">¥{Number(risk.unpaidAmount).toFixed(2)}</div>
                    </div>
                    <div>
                      <div>逾期天数</div>
                      <div className="font-medium text-foreground">{risk.overdueDays} 天</div>
                    </div>
                    <div>
                      <div>信用评分</div>
                      <div className="font-medium text-foreground">{risk.creditScore}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              暂无坏账风险预警
            </div>
          )}
        </CardContent>
      </Card>

      {/* 得率异动审计 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500" />
            得率异动审计
            {radarData?.yieldAnomalies && radarData.yieldAnomalies.length > 0 && (
              <Badge variant="destructive">{radarData.yieldAnomalies.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            实时计算黄豆投入与成品产出比例，偏差超过2%立即标红（查询production_plans表）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {radarData?.yieldAnomalies && radarData.yieldAnomalies.length > 0 ? (
            <div className="space-y-3">
              {radarData.yieldAnomalies.map((anomaly: any) => (
                <div
                  key={anomaly.batchNo}
                  className={`border rounded-lg p-4 ${
                    Math.abs(anomaly.deviation) > 2 ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">批次号: {anomaly.batchNo}</div>
                    <Badge variant={Math.abs(anomaly.deviation) > 2 ? 'destructive' : 'secondary'}>
                      偏差: {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation.toFixed(2)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div>
                      <div>黄豆投入</div>
                      <div className="font-medium text-foreground">{anomaly.soybeanInput} kg</div>
                    </div>
                    <div>
                      <div>成品产出</div>
                      <div className="font-medium text-foreground">{anomaly.productOutput} kg</div>
                    </div>
                    <div>
                      <div>实际得率</div>
                      <div className="font-medium text-foreground">{anomaly.actualYield.toFixed(2)}%</div>
                    </div>
                    <div>
                      <div>标准得率</div>
                      <div className="font-medium text-foreground">{anomaly.standardYield.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              暂无得率异动预警
            </div>
          )}
        </CardContent>
      </Card>

      {/* 客户流失预警 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            客户流失预警
            {radarData?.churnRisks && radarData.churnRisks.length > 0 && (
              <Badge variant="destructive">{radarData.churnRisks.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            核心客户连续2天无订单自动弹出，防止业务员隐瞒流失（查询orders表MAX(order_date)）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {radarData?.churnRisks && radarData.churnRisks.length > 0 ? (
            <div className="space-y-3">
              {radarData.churnRisks.map((risk: any) => (
                <div
                  key={risk.customerId}
                  className="border border-blue-500 bg-blue-50 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{risk.customerName}</div>
                    <Badge variant="outline">
                      {risk.daysSinceLastOrder} 天未下单
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>
                      <div>客户类型</div>
                      <div className="font-medium text-foreground">{risk.customerCategory}</div>
                    </div>
                    <div>
                      <div>最后订单日期</div>
                      <div className="font-medium text-foreground">
                        {new Date(risk.lastOrderDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div>历史月均订单</div>
                      <div className="font-medium text-foreground">{risk.avgMonthlyOrders} 单</div>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    负责业务员: {risk.salesRepName}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              暂无客户流失预警
            </div>
          )}
        </CardContent>
      </Card>

      {/* 实时刷新提示 */}
      <div className="text-center text-sm text-muted-foreground">
        <p>数据每30秒自动刷新 | 最后更新: {radarData?.lastUpdate ? new Date(radarData.lastUpdate).toLocaleString() : '-'}</p>
      </div>
    </div>
  );
}
