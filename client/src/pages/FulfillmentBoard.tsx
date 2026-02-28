/**
 * 订单履约全链路工作台 (RC3 Epic 3)
 * 
 * 路由: /orders/fulfillment
 * 功能:
 * - 看板视图：按状态分列展示订单
 * - 状态流转：APPROVED → PRODUCTION → SHIPPED → COMPLETED
 * - 发货节点强制录入 batchNo（溯源批次号）
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, Factory, Truck, CheckCircle2, ClipboardCheck, Package, RefreshCw } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; nextStatus?: string; nextLabel?: string }> = {
  APPROVED: { label: "已审核", color: "bg-blue-100 text-blue-800 border-blue-200", icon: ClipboardCheck, nextStatus: "PRODUCTION", nextLabel: "开始生产" },
  PRODUCTION: { label: "生产中", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Factory, nextStatus: "SHIPPED", nextLabel: "发货" },
  SHIPPED: { label: "已发货", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Truck, nextStatus: "COMPLETED", nextLabel: "确认完成" },
  COMPLETED: { label: "已完成", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
};

interface TransitionDialogState {
  open: boolean;
  orderId: number | null;
  orderNo: string;
  currentStatus: string;
  nextStatus: string;
  nextLabel: string;
}

export default function FulfillmentBoard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [dialog, setDialog] = useState<TransitionDialogState>({
    open: false,
    orderId: null,
    orderNo: "",
    currentStatus: "",
    nextStatus: "",
    nextLabel: "",
  });
  const [batchNo, setBatchNo] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [transitionRemark, setTransitionRemark] = useState("");

  // 获取履约看板数据
  const { data: dashboardData, isLoading, refetch } = trpc.fulfillment.getDashboard.useQuery({ orgId: 1 });

  // 获取可用批次
  const { data: availableBatches } = trpc.fulfillment.getAvailableBatches.useQuery();

  // 状态流转
  const updateStatus = trpc.fulfillment.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(`订单 ${dialog.orderNo} 已流转至「${STATUS_CONFIG[dialog.nextStatus]?.label}」`);
      setDialog(prev => ({ ...prev, open: false }));
      setBatchNo("");
      setSelectedBatch("");
      setTransitionRemark("");
      refetch();
    },
    onError: (err: any) => {
      toast.error(`流转失败: ${err.message}`);
    },
  });

  const openTransitionDialog = (order: any, currentStatus: string) => {
    const config = STATUS_CONFIG[currentStatus];
    if (!config?.nextStatus) return;
    setDialog({
      open: true,
      orderId: order.id,
      orderNo: order.orderNo || `#${order.id}`,
      currentStatus,
      nextStatus: config.nextStatus,
      nextLabel: config.nextLabel || "",
    });
  };

  const handleTransition = () => {
    if (!dialog.orderId || !dialog.nextStatus) return;

    // 发货节点强制要求 batchNo
    const finalBatchNo = batchNo || selectedBatch;
    if (dialog.nextStatus === "SHIPPED" && !finalBatchNo) {
      toast.error("发货操作必须录入溯源批次号 (batchNo)");
      return;
    }

    updateStatus.mutate({
      orderId: dialog.orderId,
      status: dialog.nextStatus as any,
      batchNo: finalBatchNo || undefined,
      remark: transitionRemark || undefined,
    });
  };

  const statuses = ["APPROVED", "PRODUCTION", "SHIPPED", "COMPLETED"];

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">订单履约工作台</h1>
            <p className="text-muted-foreground mt-1">管理订单从审核到完成的全链路流转</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        {/* 流程指示器 */}
        <div className="flex items-center justify-center gap-2 mb-6 py-3 bg-gray-50 rounded-lg">
          {statuses.map((status, idx) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <div key={status} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}>
                  <Icon className="w-4 h-4" />
                  {config.label}
                  {dashboardData && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {(dashboardData[status] || []).length}
                    </Badge>
                  )}
                </div>
                {idx < statuses.length - 1 && (
                  <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* 看板列 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statuses.map(status => (
              <div key={status} className="space-y-3">
                <div className="animate-pulse h-8 bg-gray-200 rounded" />
                <div className="animate-pulse h-24 bg-gray-200 rounded" />
                <div className="animate-pulse h-24 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statuses.map(status => {
              const config = STATUS_CONFIG[status];
              const orders = dashboardData?.[status] || [];
              const Icon = config.icon;
              return (
                <div key={status} className="space-y-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm ${config.color}`}>
                    <Icon className="w-4 h-4" />
                    {config.label}
                    <Badge variant="secondary" className="ml-auto">{orders.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[200px]">
                    {orders.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                        暂无订单
                      </div>
                    ) : (
                      orders.map((order: any) => (
                        <Card key={order.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-1">
                              <span className="font-mono text-xs text-muted-foreground">
                                {order.orderNo || `#${order.id}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                ¥{parseFloat(order.totalAmount || 0).toFixed(0)}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium truncate">
                              {order.customer?.name || order.customer?.customerName || `客户#${order.customerId}`}
                            </p>
                            {order.batchNo && (
                              <p className="text-xs text-muted-foreground mt-1">
                                批次: {order.batchNo}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ""}
                            </p>
                            {config.nextStatus && (
                              <Button
                                size="sm"
                                className="w-full mt-2"
                                variant="outline"
                                onClick={() => openTransitionDialog(order, status)}
                              >
                                <ArrowRight className="w-3 h-3 mr-1" />
                                {config.nextLabel}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 状态流转对话框 */}
        <Dialog open={dialog.open} onOpenChange={open => setDialog(prev => ({ ...prev, open }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                订单流转: {dialog.orderNo}
              </DialogTitle>
              <DialogDescription>
                {STATUS_CONFIG[dialog.currentStatus]?.label} → {STATUS_CONFIG[dialog.nextStatus]?.label}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* 发货节点：强制录入 batchNo */}
              {dialog.nextStatus === "SHIPPED" && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    发货操作必须录入溯源批次号，用于打通质量追溯闭环。
                  </div>

                  {/* 选择已有批次 */}
                  {availableBatches && Array.isArray(availableBatches) && availableBatches.length > 0 && (
                    <div>
                      <Label className="text-sm">选择已有批次</Label>
                      <Select value={selectedBatch} onValueChange={v => { setSelectedBatch(v); setBatchNo(""); }}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="从已有批次中选择..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBatches.map((batch: any) => (
                            <SelectItem key={batch.batchNo || batch.id} value={batch.batchNo || `BT-${batch.id}`}>
                              {batch.batchNo || `BT-${batch.id}`} - {batch.productionDate ? new Date(batch.productionDate).toLocaleDateString() : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm">或手动输入批次号 <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="例如: BT-2026-0301"
                      value={batchNo}
                      onChange={e => { setBatchNo(e.target.value); setSelectedBatch(""); }}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}

              {/* 备注 */}
              <div>
                <Label className="text-sm">备注（可选）</Label>
                <Textarea
                  placeholder="流转备注..."
                  value={transitionRemark}
                  onChange={e => setTransitionRemark(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(prev => ({ ...prev, open: false }))}>
                取消
              </Button>
              <Button onClick={handleTransition} disabled={updateStatus.isPending}>
                {updateStatus.isPending ? "处理中..." : `确认${dialog.nextLabel}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
