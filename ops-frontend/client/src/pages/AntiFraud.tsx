import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export function AntiFraud() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedAnomaly, setSelectedAnomaly] = useState<any>(null);
  const [specialReason, setSpecialReason] = useState("");

  // Redirect if not admin
  if (user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: priceAnomalies, isLoading: loadingPrice, refetch: refetchPrice } = trpc.antiFraud.getPriceAnomalies.useQuery({});
  const { data: settlementAudits, isLoading: loadingSettlement, refetch: refetchSettlement } = trpc.antiFraud.getSettlementAudits.useQuery({});

  const approvePriceMutation = trpc.antiFraud.approvePriceAnomaly.useMutation({
    onSuccess: () => {
      toast.success("价格异常已审批");
      refetchPrice();
      setSelectedAnomaly(null);
      setSpecialReason("");
    },
    onError: (error) => {
      toast.error(`审批失败: ${error.message}`);
    },
  });

  const rejectPriceMutation = trpc.antiFraud.rejectPriceAnomaly.useMutation({
    onSuccess: () => {
      toast.success("价格异常已拒绝");
      refetchPrice();
      setSelectedAnomaly(null);
      setSpecialReason("");
    },
    onError: (error) => {
      toast.error(`拒绝失败: ${error.message}`);
    },
  });

  const handleApprove = () => {
    if (!selectedAnomaly) return;
    if (!specialReason.trim()) {
      toast.error("请填写特价原因");
      return;
    }
    approvePriceMutation.mutate({
      id: selectedAnomaly.id,
      specialReason: specialReason.trim(),
    });
  };

  const handleReject = () => {
    if (!selectedAnomaly) return;
    rejectPriceMutation.mutate({ id: selectedAnomaly.id });
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">反舞弊与偏差预警系统</h1>
        <p className="text-muted-foreground">
          通过算法消灭主观偏见，实现"人性防线"监控
        </p>
      </div>

      {/* Price Anomalies Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            价格洼地监控
          </CardTitle>
          <CardDescription>
            自动标记低于片区均值3%以上的订单，强制要求填写特价原因
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPrice ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : !priceAnomalies || priceAnomalies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无价格异常</div>
          ) : (
            <div className="space-y-4">
              {priceAnomalies.map((anomaly: any) => (
                <div
                  key={anomaly.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{anomaly.customerName}</span>
                        <Badge variant="outline">{anomaly.productName}</Badge>
                        {anomaly.status === "PENDING" && (
                          <Badge variant="destructive">
                            <Clock className="h-3 w-3 mr-1" />
                            待审批
                          </Badge>
                        )}
                        {anomaly.status === "APPROVED" && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            已批准
                          </Badge>
                        )}
                        {anomaly.status === "REJECTED" && (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            已拒绝
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">订单单价：</span>
                          <span className="font-medium">¥{anomaly.unitPrice}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">片区均价：</span>
                          <span className="font-medium">¥{anomaly.regionAvgPrice}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">偏差：</span>
                          <span className="font-medium text-red-500">
                            {anomaly.deviationPercent}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">业务员：</span>
                          <span className="font-medium">{anomaly.salesRepName}</span>
                        </div>
                      </div>
                      {anomaly.specialReason && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <span className="text-muted-foreground">特价原因：</span>
                          <span className="ml-2">{anomaly.specialReason}</span>
                        </div>
                      )}
                    </div>
                    {anomaly.status === "PENDING" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAnomaly(anomaly)}
                          >
                            审批
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>审批价格异常</DialogTitle>
                            <DialogDescription>
                              请填写特价原因并选择批准或拒绝
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>客户信息</Label>
                              <div className="text-sm">
                                <div>客户：{anomaly.customerName}</div>
                                <div>产品：{anomaly.productName}</div>
                                <div>单价：¥{anomaly.unitPrice}（片区均价：¥{anomaly.regionAvgPrice}）</div>
                                <div className="text-red-500">偏差：{anomaly.deviationPercent}%</div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="specialReason">特价原因 *</Label>
                              <Textarea
                                id="specialReason"
                                placeholder="请详细说明特价原因（必填）"
                                value={specialReason}
                                onChange={(e) => setSpecialReason(e.target.value)}
                                rows={4}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={handleReject}
                              disabled={rejectPriceMutation.isPending}
                            >
                              拒绝
                            </Button>
                            <Button
                              onClick={handleApprove}
                              disabled={approvePriceMutation.isPending || !specialReason.trim()}
                            >
                              批准
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Audit Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            结算行为审计
          </CardTitle>
          <CardDescription>
            监控核销时间点，标记提成统计截止前2小时内的疑似人为操控行为
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettlement ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : !settlementAudits || settlementAudits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无结算审计记录</div>
          ) : (
            <div className="space-y-4">
              {settlementAudits.map((audit: any) => (
                <div
                  key={audit.id}
                  className={`border rounded-lg p-4 ${
                    audit.isSuspicious ? "border-red-500 bg-red-50 dark:bg-red-950/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{audit.salesRepName}</span>
                        {audit.isSuspicious && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            疑似操控
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">核销金额：</span>
                          <span className="font-medium">¥{audit.applyAmount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">核销时间：</span>
                          <span className="font-medium">
                            {new Date(audit.applyTime).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">截止时间：</span>
                          <span className="font-medium">
                            {new Date(audit.commissionDeadline).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">距离截止：</span>
                          <span className={`font-medium ${audit.timeToDeadline < 7200 ? "text-red-500" : ""}`}>
                            {Math.floor(audit.timeToDeadline / 3600)}小时
                          </span>
                        </div>
                      </div>
                      {audit.suspiciousReason && (
                        <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
                          <span className="font-medium">疑似原因：</span>
                          <span className="ml-2">{audit.suspiciousReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
