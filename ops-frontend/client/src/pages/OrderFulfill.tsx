/**
 * 订单履行页 (RC6 Epic 3 重构)
 * 新增：状态 Tab（待发货/履行中/已完成）+ 高级搜索栏（订单号/客户名称）
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Package, Loader2, Search, Filter, RefreshCw, X, Truck, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_TABS = [
  { value: "APPROVED", label: "待发货", icon: Package },
  { value: "PRODUCTION", label: "生产中", icon: Loader2 },
  { value: "SHIPPED", label: "已发货", icon: Truck },
  { value: "COMPLETED", label: "已完成", icon: CheckCircle2 },
];

export default function OrderFulfill() {
  const [activeTab, setActiveTab] = useState("APPROVED");
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedBatchNo, setSelectedBatchNo] = useState<string>("");
  const [manualBatchNo, setManualBatchNo] = useState<string>("");

  // 高级搜索状态
  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [appliedSearch, setAppliedSearch] = useState({ orderNo: "", customer: "" });

  const { data: ordersData, isLoading: loading, refetch } = trpc.orders.list.useQuery({
    orgId: 2,
    status: activeTab,
    page: 1,
    pageSize: 50,
  });

  const { data: batchesData } = trpc.orders.getAvailableBatches.useQuery(
    undefined,
    { enabled: fulfillDialogOpen }
  );

  const fulfillMutation = trpc.orders.fulfill.useMutation({
    onSuccess: () => {
      toast.success("订单履行成功，已关联生产批次并生成发票");
      setFulfillDialogOpen(false);
      setSelectedOrder(null);
      setSelectedBatchNo("");
      setManualBatchNo("");
      refetch();
    },
    onError: (error) => {
      toast.error("履行失败: " + error.message);
    },
  });

  const handleApplySearch = () => {
    setAppliedSearch({ orderNo: searchOrderNo, customer: searchCustomer });
  };

  const handleClearSearch = () => {
    setSearchOrderNo("");
    setSearchCustomer("");
    setAppliedSearch({ orderNo: "", customer: "" });
  };

  const openFulfillDialog = (order: any) => {
    setSelectedOrder(order);
    setSelectedBatchNo("");
    setManualBatchNo("");
    setFulfillDialogOpen(true);
  };

  const handleConfirmFulfill = () => {
    const batchNo = selectedBatchNo || manualBatchNo;
    if (!batchNo) {
      toast.error("必须选择或输入生产批次号才能发货！");
      return;
    }
    if (!selectedOrder) return;
    fulfillMutation.mutate({ orderId: selectedOrder.id, batchNo });
  };

  const allOrders: any[] = (ordersData as any)?.data || [];
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      if (appliedSearch.orderNo && !String(order.id).includes(appliedSearch.orderNo) &&
          !order.orderNo?.includes(appliedSearch.orderNo)) return false;
      if (appliedSearch.customer && !order.customerName?.toLowerCase().includes(appliedSearch.customer.toLowerCase())) return false;
      return true;
    });
  }, [allOrders, appliedSearch]);

  const hasActiveSearch = Object.values(appliedSearch).some(Boolean);
  const batches: any[] = (batchesData as any) || [];

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      APPROVED: { label: "待发货", className: "bg-blue-100 text-blue-800" },
      PRODUCTION: { label: "生产中", className: "bg-orange-100 text-orange-800" },
      SHIPPED: { label: "已发货", className: "bg-purple-100 text-purple-800" },
      COMPLETED: { label: "已完成", className: "bg-green-100 text-green-800" },
    };
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${s.className}`}>{s.label}</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">订单履行</h1>
          <p className="text-muted-foreground mt-1">管理订单从审核到完成的全流程，发货时必须关联生产批次号</p>
        </div>

        {/* 高级搜索栏 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">精准过滤</CardTitle>
              {hasActiveSearch && (
                <Badge variant="secondary" className="text-xs">已筛选 {filteredOrders.length} 条</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">订单号精准过滤</Label>
                <Input
                  placeholder="输入订单号"
                  value={searchOrderNo}
                  onChange={(e) => setSearchOrderNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplySearch()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">客户名称精准过滤</Label>
                <Input
                  placeholder="输入客户名称"
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplySearch()}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleApplySearch}>
                <Search className="h-4 w-4 mr-1" /> 过滤
              </Button>
              {hasActiveSearch && (
                <Button size="sm" variant="outline" onClick={handleClearSearch}>
                  <X className="h-4 w-4 mr-1" /> 清除
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> 刷新
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 状态 Tab */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card>
                <CardHeader>
                  <CardTitle>{tab.label}订单</CardTitle>
                  <CardDescription>
                    共 {filteredOrders.length} 条记录
                    {hasActiveSearch && <span className="text-blue-600 ml-1">（已筛选）</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">加载中...</span>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {hasActiveSearch ? "未找到匹配的订单" : `暂无${tab.label}订单`}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>订单号</TableHead>
                          <TableHead>客户</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>批次号</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">
                              {order.orderNo || `#${order.id}`}
                            </TableCell>
                            <TableCell>{order.customerName || `客户#${order.customerId}`}</TableCell>
                            <TableCell>¥{(order.totalAmount || 0).toLocaleString()}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {order.batchNo || "-"}
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>
                              {tab.value === "APPROVED" && (
                                <Button size="sm" onClick={() => openFulfillDialog(order)}>
                                  <Package className="h-4 w-4 mr-1" /> 发货
                                </Button>
                              )}
                              {tab.value !== "APPROVED" && (
                                <span className="text-xs text-muted-foreground">
                                  {order.updatedAt ? new Date(order.updatedAt).toLocaleDateString("zh-CN") : "-"}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* 发货 Dialog */}
        <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认发货</DialogTitle>
              <DialogDescription>
                订单 {selectedOrder?.orderNo || `#${selectedOrder?.id}`} — 发货时必须关联生产批次号
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>选择已有批次号</Label>
                <Select value={selectedBatchNo} onValueChange={(v) => { setSelectedBatchNo(v); setManualBatchNo(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择生产批次..." />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b: any) => (
                      <SelectItem key={b.batchNo || b.id} value={b.batchNo || String(b.id)}>
                        {b.batchNo || b.id} — {b.productName || ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">或手动输入</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>手动录入批次号</Label>
                <Input
                  placeholder="如: BT-2026-0201"
                  value={manualBatchNo}
                  onChange={(e) => { setManualBatchNo(e.target.value); setSelectedBatchNo(""); }}
                />
              </div>
              {(selectedBatchNo || manualBatchNo) && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                  <span className="text-green-700 font-medium">已选批次: </span>
                  <span className="font-mono">{selectedBatchNo || manualBatchNo}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFulfillDialogOpen(false)}>取消</Button>
              <Button
                onClick={handleConfirmFulfill}
                disabled={fulfillMutation.isPending || (!selectedBatchNo && !manualBatchNo)}
              >
                {fulfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Truck className="h-4 w-4 mr-1" />}
                确认发货
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
