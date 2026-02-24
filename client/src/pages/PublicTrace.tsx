import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, Factory, Truck, CheckCircle, AlertCircle } from 'lucide-react';

export default function PublicTrace() {
  const params = useParams();
  const orderId = params.id ? parseInt(params.id) : 0;

  const { data: traceData, isLoading } = trpc.public.getTraceData.useQuery(
    { orderId },
    { enabled: orderId > 0 }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center">加载中...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!traceData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
              <p>未找到订单追溯信息</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* 标题卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>质量追溯详情</span>
              <Badge variant={traceData.status === 'FULFILLED' ? 'default' : 'secondary'}>
                {traceData.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">订单编号</div>
                <div className="font-medium">{traceData.orderNo}</div>
              </div>
              <div>
                <div className="text-muted-foreground">客户名称</div>
                <div className="font-medium">{traceData.customerName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">订单金额</div>
                <div className="font-medium">¥{traceData.totalAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">下单时间</div>
                <div className="font-medium">{new Date(traceData.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 原料端 */}
        {traceData.rawMaterial && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                原料端
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">黄豆批次</div>
                  <div className="font-medium">{traceData.rawMaterial.soybeanBatch}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">水质检测</div>
                  <div className="font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {traceData.rawMaterial.waterQuality}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 制造端 */}
        {traceData.production && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5" />
                制造端
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">生产批次</div>
                  <div className="font-medium">{traceData.production.batchNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">生产日期</div>
                  <div className="font-medium">{new Date(traceData.production.productionDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">车间温度</div>
                  <div className="font-medium">{traceData.production.workshopTemp}°C</div>
                </div>
                <div>
                  <div className="text-muted-foreground">灭菌参数</div>
                  <div className="font-medium">{traceData.production.sterilizationParams}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 物流端 */}
        {traceData.logistics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                物流端
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {traceData.logistics.pickingTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div>
                      <span className="text-muted-foreground">拣货完成：</span>
                      <span className="ml-2">{new Date(traceData.logistics.pickingTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {traceData.logistics.shippingTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div>
                      <span className="text-muted-foreground">出库发货：</span>
                      <span className="ml-2">{new Date(traceData.logistics.shippingTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {traceData.logistics.deliveryTime && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    <div>
                      <span className="text-muted-foreground">客户签收：</span>
                      <span className="ml-2">{new Date(traceData.logistics.deliveryTime).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                {traceData.logistics.driverName && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">司机信息：</span>
                    <span className="ml-2">{traceData.logistics.driverName} ({traceData.logistics.driverPhone})</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 客户评价 */}
        <Card>
          <CardHeader>
            <CardTitle>客户评价与质量反馈</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-4">
              暂无评价，扫码后可提交质量反馈
            </div>
          </CardContent>
        </Card>

        <Separator />

        <div className="text-center text-xs text-muted-foreground pb-4">
          <p>千张销售管理系统 - 质量追溯平台</p>
          <p className="mt-1">如有质量问题，请联系客服：400-xxx-xxxx</p>
        </div>
      </div>
    </div>
  );
}
