import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Users, Package } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';

export default function CEORadar() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = trpc.auth.me.useQuery();

  // 限制仅CEO角色可见
  if (currentUser && currentUser.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const { data: radarData, isLoading } = trpc.ceo.getRadarData.useQuery(
    undefined,
    { enabled: !!currentUser && currentUser.role === 'admin' }
  );

  if (isLoading) {
    return (
      <div className="container py-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold">经营异常雷达</h1>
        <p className="text-muted-foreground mt-2">
          实时监控经营红线，只抓取"不对劲"的数据
        </p>
      </div>

      {/* 坏账风险对冲 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            坏账风险对冲
          </CardTitle>
          <CardDescription>
            15天以上未核销金额 × 客户信用分 = 预估损失额
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
                      预估损失: ¥{risk.estimatedLoss.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    <div>
                      <div>未核销金额</div>
                      <div className="font-medium text-foreground">¥{risk.unpaidAmount.toFixed(2)}</div>
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
            <div className="text-center py-8 text-muted-foreground">
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
          </CardTitle>
          <CardDescription>
            实时计算黄豆投入与成品产出比例，偏差超过2%立即标红
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
                  <div className="mt-2 text-sm text-muted-foreground">
                    生产时间: {new Date(anomaly.productionDate).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
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
          </CardTitle>
          <CardDescription>
            核心客户连续2天无订单自动弹出，防止业务员隐瞒流失
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
            <div className="text-center py-8 text-muted-foreground">
              暂无客户流失预警
            </div>
          )}
        </CardContent>
      </Card>

      {/* 实时刷新提示 */}
      <div className="text-center text-sm text-muted-foreground">
        <p>数据每5分钟自动刷新 | 最后更新: {radarData?.lastUpdate ? new Date(radarData.lastUpdate).toLocaleString() : '-'}</p>
      </div>
    </div>
  );
}
