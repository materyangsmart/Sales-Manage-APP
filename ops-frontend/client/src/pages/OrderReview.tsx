import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
import { CheckCircle, XCircle, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { Order } from "@/lib/types";
import { useErrorHandler } from "@/hooks/useErrorHandler";

export default function OrderReview() {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | null>(null);

  // 使用tRPC查询待审核订单
  const { data: ordersData, isLoading, error: listError, refetch } = trpc.orders.list.useQuery({
    orgId: 2, // TODO: 从用户context获取orgId
    status: "PENDING_REVIEW",
    page: 1,
    pageSize: 20,
  });

  // 统一错误处理
  useErrorHandler(listError, "加载订单列表");

  // 审核订单mutation
  const approveMutation = trpc.orders.approve.useMutation({
    onSuccess: () => {
      toast.success("订单已批准");
      setSelectedOrder(null);
      setReviewComment("");
      refetch();
    },
    onError: () => {
      // 错误处理由useErrorHandler统一处理
    },
  });

  const rejectMutation = trpc.orders.reject.useMutation({
    onSuccess: () => {
      toast.success("订单已拒绝");
      setSelectedOrder(null);
      setReviewComment("");
      refetch();
    },
    onError: () => {
      // 错误处理由useErrorHandler统一处理
    },
  });

  // 统一错误处理
  useErrorHandler(approveMutation.error, "批准订单");
  useErrorHandler(rejectMutation.error, "拒绝订单");

  const handleReview = async (action: "APPROVE" | "REJECT") => {
    if (!selectedOrder) return;

    if (action === "APPROVE") {
      approveMutation.mutate({
        orderId: selectedOrder.id,
        remark: reviewComment || undefined,
      });
    } else {
      rejectMutation.mutate({
        orderId: selectedOrder.id,
        remark: reviewComment || undefined,
      });
    }
  };

  const orders = ordersData?.data || [];
  const submitting = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">订单审核</h1>
        <p className="text-muted-foreground mt-2">
          审核待处理的订单，支持批准或拒绝操作
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>待审核订单列表</CardTitle>
          <CardDescription>
            当前有 {orders.length} 个订单等待审核
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无待审核订单
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>订单号</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>订单日期</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNo}</TableCell>
                    <TableCell>{order.customerName || `客户#${order.customerId}`}</TableCell>
                    <TableCell>{new Date(order.orderDate).toLocaleDateString('zh-CN')}</TableCell>
                    <TableCell>¥{order.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">待审核</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedOrder(order);
                          setReviewAction("APPROVE");
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        批准
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedOrder(order);
                          setReviewAction("REJECT");
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        拒绝
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 订单详情对话框 */}
      <Dialog
        open={selectedOrder !== null && reviewAction === null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrder(null);
            setReviewComment("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
            <DialogDescription>
              订单号: {selectedOrder?.orderNo}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">客户</Label>
                  <p className="font-medium">{selectedOrder.customerName || `客户#${selectedOrder.customerId}`}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">订单日期</Label>
                  <p className="font-medium">{new Date(selectedOrder.orderDate).toLocaleDateString('zh-CN')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">订单金额</Label>
                  <p className="font-medium text-lg">¥{selectedOrder.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <p className="font-medium">
                    <Badge variant="outline">待审核</Badge>
                  </p>
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <Label className="text-muted-foreground mb-2 block">订单明细</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>产品</TableHead>
                        <TableHead>数量</TableHead>
                        <TableHead>单价</TableHead>
                        <TableHead>小计</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.productName || `产品#${item.productId}`}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>¥{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell>¥{item.totalPrice.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedOrder(null)}
            >
              关闭
            </Button>
            <Button
              variant="default"
              onClick={() => setReviewAction("APPROVE")}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              批准
            </Button>
            <Button
              variant="destructive"
              onClick={() => setReviewAction("REJECT")}
            >
              <XCircle className="h-4 w-4 mr-1" />
              拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审核确认对话框 */}
      <Dialog
        open={reviewAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReviewAction(null);
            setReviewComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVE" ? "批准订单" : "拒绝订单"}
            </DialogTitle>
            <DialogDescription>
              订单号: {selectedOrder?.orderNo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="comment">备注（可选）</Label>
              <Textarea
                id="comment"
                placeholder={reviewAction === "APPROVE" ? "输入批准备注..." : "输入拒绝原因..."}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewAction(null);
                setReviewComment("");
              }}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              variant={reviewAction === "APPROVE" ? "default" : "destructive"}
              onClick={() => reviewAction && handleReview(reviewAction)}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {reviewAction === "APPROVE" ? "确认批准" : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
