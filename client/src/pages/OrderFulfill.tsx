import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Package, Loader2, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function OrderFulfill() {
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedBatchNo, setSelectedBatchNo] = useState<string>("");

  // 使用tRPC查询已审核订单
  const { data: ordersData, isLoading: loading, refetch } = trpc.orders.list.useQuery({
    orgId: 2,
    status: "APPROVED",
    page: 1,
    pageSize: 20,
  });

  // 获取可用批次列表
  const { data: batchesData, isLoading: batchesLoading } = trpc.orders.getAvailableBatches.useQuery(
    undefined,
    { enabled: fulfillDialogOpen }
  );

  // 履行订单mutation - P29: 强制传入 batchNo
  const fulfillMutation = trpc.orders.fulfill.useMutation({
    onSuccess: () => {
      toast.success("订单履行成功，已关联生产批次并生成发票");
      setFulfillDialogOpen(false);
      setSelectedOrder(null);
      setSelectedBatchNo("");
      refetch();
    },
    onError: (error) => {
      toast.error("履行失败: " + error.message);
    },
  });

  const openFulfillDialog = (order: any) => {
    setSelectedOrder(order);
    setSelectedBatchNo("");
    setFulfillDialogOpen(true);
  };

  const handleConfirmFulfill = () => {
    if (!selectedBatchNo) {
      toast.error("必须选择生产批次号才能发货！");
      return;
    }
    if (!selectedOrder) return;
    fulfillMutation.mutate({
      orderId: selectedOrder.id,
      batchNo: selectedBatchNo,
    });
  };

  const orders = ordersData?.data || [];
  const batches: any[] = Array.isArray(batchesData) ? batchesData : [];
  const fulfilling = fulfillMutation.isPending;

  // 导出订单CSV
  const handleExportOrders = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const token = import.meta.env.VITE_INTERNAL_TOKEN || '';
    const url = `${backendUrl}/api/internal/export/orders?status=FULFILLED`;
    window.open(url, '_blank');
    toast.info("正在导出订单数据...");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">订单履行</h1>
            <p className="text-muted-foreground mt-2">
              履行已审核订单，<strong>必须选择生产批次号</strong>才能发货
            </p>
          </div>
          <Button variant="outline" onClick={handleExportOrders}>
            <Download className="h-4 w-4 mr-2" />
            导出订单CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>已审核订单列表</CardTitle>
            <CardDescription>
              状态为 APPROVED 的订单 — 点击"发货"后需选择对应的生产批次号
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无待履行订单
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>订单日期</TableHead>
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead>审核时间</TableHead>
                    <TableHead>审核备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNo}</TableCell>
                      <TableCell>{order.customerName || `客户${order.customerId}`}</TableCell>
                      <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">¥{(order.totalAmount / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        {order.reviewedAt ? new Date(order.reviewedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>{order.reviewComment || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => openFulfillDialog(order)}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          发货
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              P29 质量追溯规则
            </CardTitle>
          </CardHeader>
          <CardContent className="text-amber-800 dark:text-amber-300 space-y-2">
            <p>• 发货时<strong>必须选择</strong>对应的生产批次号（如 QZ202501110124）</p>
            <p>• 后端会校验批次号在 production_plans 表中<strong>真实存在</strong></p>
            <p>• 只有质检结果为 <strong>PASS</strong> 且<strong>未过期</strong>的批次才能发货</p>
            <p>• 批次号将精确写入 orders 表，用于全链路追溯</p>
          </CardContent>
        </Card>
      </div>

      {/* P29: 发货批次选择弹窗 */}
      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              选择生产批次号
            </DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <>
                  订单 <strong>{selectedOrder.orderNo}</strong> — 
                  金额 ¥{(selectedOrder.totalAmount / 100).toFixed(2)}
                </>
              )}
              <br />
              <span className="text-amber-600 font-medium flex items-center gap-1 mt-1">
                <AlertTriangle className="h-4 w-4" />
                必须选择生产批次号才能发货，不允许空值
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">生产批次号 *</label>
              {batchesLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载批次列表...
                </div>
              ) : (
                <Select value={selectedBatchNo} onValueChange={setSelectedBatchNo}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择生产批次号..." />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">暂无可用批次</div>
                    ) : (
                      batches.map((batch: any) => (
                        <SelectItem key={batch.batch_no} value={batch.batch_no}>
                          <div className="flex flex-col">
                            <span className="font-mono font-medium">{batch.batch_no}</span>
                            <span className="text-xs text-muted-foreground">
                              {batch.product_name} | 质检: {batch.quality_result} | 
                              生产: {batch.production_date ? new Date(batch.production_date).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedBatchNo && (
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <ShieldCheck className="h-4 w-4 inline mr-1" />
                  已选择批次: <strong className="font-mono">{selectedBatchNo}</strong>
                </p>
                {(() => {
                  const batch = batches.find((b: any) => b.batch_no === selectedBatchNo);
                  if (!batch) return null;
                  return (
                    <div className="text-xs text-green-700 dark:text-green-400 mt-1 space-y-0.5">
                      <p>产品: {batch.product_name}</p>
                      <p>质检员: {batch.quality_inspector || 'N/A'}</p>
                      <p>到期日: {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmFulfill}
              disabled={!selectedBatchNo || fulfilling}
            >
              {fulfilling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  发货中...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-1" />
                  确认发货
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
