/**
 * 订单审核页 (RC6 Epic 3 重构)
 * 新增：状态 Tab 切换 + 高级搜索栏（订单号/客户名称/时间段）
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, Loader2, Search, Filter, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { Order } from "@/lib/types";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_TABS = [
  { value: "PENDING_REVIEW", label: "待审核", color: "bg-yellow-100 text-yellow-800" },
  { value: "APPROVED", label: "已审核", color: "bg-green-100 text-green-800" },
  { value: "REJECTED", label: "已拒绝", color: "bg-red-100 text-red-800" },
];

export default function OrderReview() {
  const [activeTab, setActiveTab] = useState("PENDING_REVIEW");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | null>(null);

  // 高级搜索状态
  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [appliedSearch, setAppliedSearch] = useState({
    orderNo: "", customer: "", dateFrom: "", dateTo: "",
  });

  const queryInput = useMemo(() => ({
    orgId: 2,
    status: activeTab,
    page: 1,
    pageSize: 50,
  }), [activeTab]);

  const { data: ordersData, isLoading, error: listError, refetch } = trpc.orders.list.useQuery(queryInput);
  useErrorHandler(listError, "加载订单列表");

  const approveMutation = trpc.orders.approve.useMutation({
    onSuccess: () => {
      toast.success("订单已批准");
      setSelectedOrder(null);
      setReviewComment("");
      setReviewAction(null);
      refetch();
    },
    onError: () => {},
  });

  const rejectMutation = trpc.orders.reject.useMutation({
    onSuccess: () => {
      toast.success("订单已拒绝");
      setSelectedOrder(null);
      setReviewComment("");
      setReviewAction(null);
      refetch();
    },
    onError: () => {},
  });

  useErrorHandler(approveMutation.error, "批准订单");
  useErrorHandler(rejectMutation.error, "拒绝订单");

  const handleApplySearch = () => {
    setAppliedSearch({
      orderNo: searchOrderNo,
      customer: searchCustomer,
      dateFrom: searchDateFrom,
      dateTo: searchDateTo,
    });
  };

  const handleClearSearch = () => {
    setSearchOrderNo("");
    setSearchCustomer("");
    setSearchDateFrom("");
    setSearchDateTo("");
    setAppliedSearch({ orderNo: "", customer: "", dateFrom: "", dateTo: "" });
  };

  const handleReview = async (action: "APPROVE" | "REJECT") => {
    if (!selectedOrder) return;
    if (action === "APPROVE") {
      approveMutation.mutate({ orderId: selectedOrder.id, remark: reviewComment || undefined });
    } else {
      rejectMutation.mutate({ orderId: selectedOrder.id, remark: reviewComment || undefined });
    }
  };

  // 前端过滤（后端 API 暂不支持多条件搜索，在前端实现）
  const allOrders: Order[] = (ordersData as any)?.data || [];
  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      if (appliedSearch.orderNo && !String(order.id).includes(appliedSearch.orderNo) &&
          !(order as any).orderNo?.includes(appliedSearch.orderNo)) return false;
      if (appliedSearch.customer && !(order as any).customerName?.toLowerCase().includes(appliedSearch.customer.toLowerCase())) return false;
      if (appliedSearch.dateFrom && new Date((order as any).createdAt) < new Date(appliedSearch.dateFrom)) return false;
      if (appliedSearch.dateTo && new Date((order as any).createdAt) > new Date(appliedSearch.dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [allOrders, appliedSearch]);

  const submitting = approveMutation.isPending || rejectMutation.isPending;
  const hasActiveSearch = Object.values(appliedSearch).some(Boolean);

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      PENDING_REVIEW: { label: "待审核", className: "bg-yellow-100 text-yellow-800" },
      APPROVED: { label: "已审核", className: "bg-green-100 text-green-800" },
      REJECTED: { label: "已拒绝", className: "bg-red-100 text-red-800" },
    };
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-800" };
    return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${s.className}`}>{s.label}</span>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">订单审核</h1>
          <p className="text-muted-foreground mt-1">审核待处理的订单，支持批准或拒绝操作</p>
        </div>

        {/* 高级搜索栏 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">高级搜索</CardTitle>
              {hasActiveSearch && (
                <Badge variant="secondary" className="text-xs">已筛选 {filteredOrders.length} 条</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">订单号</Label>
                <Input
                  placeholder="输入订单号搜索"
                  value={searchOrderNo}
                  onChange={(e) => setSearchOrderNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplySearch()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">客户名称</Label>
                <Input
                  placeholder="输入客户名称搜索"
                  value={searchCustomer}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplySearch()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">开始日期</Label>
                <Input
                  type="date"
                  value={searchDateFrom}
                  onChange={(e) => setSearchDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">结束日期</Label>
                <Input
                  type="date"
                  value={searchDateTo}
                  onChange={(e) => setSearchDateTo(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleApplySearch}>
                <Search className="h-4 w-4 mr-1" /> 搜索
              </Button>
              {hasActiveSearch && (
                <Button size="sm" variant="outline" onClick={handleClearSearch}>
                  <X className="h-4 w-4 mr-1" /> 清除筛选
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
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">加载中...</span>
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {hasActiveSearch ? "未找到匹配的订单，请调整搜索条件" : `暂无${tab.label}订单`}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>订单号</TableHead>
                          <TableHead>客户</TableHead>
                          <TableHead>金额</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>提交时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-sm">
                              {(order as any).orderNo || `#${order.id}`}
                            </TableCell>
                            <TableCell>{(order as any).customerName || `客户#${(order as any).customerId}`}</TableCell>
                            <TableCell>
                              ¥{((order as any).totalAmount || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(order as any).createdAt ? new Date((order as any).createdAt).toLocaleString("zh-CN") : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setSelectedOrder(order); setReviewAction(null); }}
                                >
                                  <Eye className="h-4 w-4 mr-1" /> 查看
                                </Button>
                                {tab.value === "PENDING_REVIEW" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => { setSelectedOrder(order); setReviewAction("APPROVE"); }}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-1" /> 批准
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => { setSelectedOrder(order); setReviewAction("REJECT"); }}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" /> 拒绝
                                    </Button>
                                  </>
                                )}
                              </div>
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

        {/* 审核 Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) { setSelectedOrder(null); setReviewAction(null); setReviewComment(""); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {reviewAction === "APPROVE" ? "批准订单" : reviewAction === "REJECT" ? "拒绝订单" : "订单详情"}
              </DialogTitle>
              <DialogDescription>
                订单号: {(selectedOrder as any)?.orderNo || `#${selectedOrder?.id}`}
              </DialogDescription>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">客户：</span>{(selectedOrder as any).customerName || "-"}</div>
                  <div><span className="text-muted-foreground">金额：</span>¥{((selectedOrder as any).totalAmount || 0).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">状态：</span>{getStatusBadge(selectedOrder.status)}</div>
                  <div><span className="text-muted-foreground">来源：</span>{(selectedOrder as any).source || "-"}</div>
                </div>
                {(selectedOrder as any).remark && (
                  <div className="text-sm bg-muted/50 rounded p-3">
                    <span className="text-muted-foreground">备注：</span>{(selectedOrder as any).remark}
                  </div>
                )}
                {reviewAction && (
                  <div className="space-y-2">
                    <Label>审核意见（可选）</Label>
                    <Textarea
                      placeholder={reviewAction === "APPROVE" ? "批准备注..." : "拒绝原因..."}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedOrder(null); setReviewAction(null); }}>
                取消
              </Button>
              {reviewAction === "APPROVE" && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleReview("APPROVE")}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  确认批准
                </Button>
              )}
              {reviewAction === "REJECT" && (
                <Button
                  variant="destructive"
                  onClick={() => handleReview("REJECT")}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  确认拒绝
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
