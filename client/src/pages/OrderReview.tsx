import DashboardLayout from "@/components/DashboardLayout";
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
import { Input } from "@/components/ui/input";
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
import { useEffect, useState } from "react";
import { orderApi, type Order } from "@/lib/api";

export default function OrderReview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAction, setReviewAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await orderApi.list({ status: "PENDING_REVIEW" });
      setOrders(response.data);
    } catch (error) {
      toast.error("加载订单失败: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedOrder || !reviewAction) return;

    try {
      setSubmitting(true);
      await orderApi.review(selectedOrder.id, {
        action: reviewAction,
        reviewComment: reviewComment || undefined,
      });
      toast.success(reviewAction === "APPROVE" ? "订单已批准" : "订单已拒绝");
      setSelectedOrder(null);
      setReviewComment("");
      setReviewAction(null);
      loadOrders();
    } catch (error) {
      toast.error("审核失败: " + (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">订单审核</h1>
          <p className="text-muted-foreground mt-2">
            审核待处理的订单，支持批准或拒绝
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>待审核订单列表</CardTitle>
            <CardDescription>
              状态为 PENDING_REVIEW 的订单
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
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
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNo}</TableCell>
                      <TableCell>{order.customerName || `客户${order.customerId}`}</TableCell>
                      <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">¥{order.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800">
                          待审核
                        </span>
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
      </div>

      {/* 审核对话框 */}
      <Dialog open={!!reviewAction} onOpenChange={() => {
        setReviewAction(null);
        setReviewComment("");
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVE" ? "批准订单" : "拒绝订单"}
            </DialogTitle>
            <DialogDescription>
              订单号: {selectedOrder?.orderNo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>审核备注（可选）</Label>
              <Textarea
                placeholder="输入审核备注..."
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
              onClick={handleReview}
              disabled={submitting}
              variant={reviewAction === "APPROVE" ? "default" : "destructive"}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              确认{reviewAction === "APPROVE" ? "批准" : "拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 订单详情对话框 */}
      <Dialog open={!!selectedOrder && !reviewAction} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>订单详情</DialogTitle>
            <DialogDescription>
              订单号: {selectedOrder?.orderNo}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">客户</Label>
                  <p className="font-medium">{selectedOrder.customerName || `客户${selectedOrder.customerId}`}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">订单日期</Label>
                  <p className="font-medium">{new Date(selectedOrder.orderDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">总金额</Label>
                  <p className="font-medium text-lg">¥{selectedOrder.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">状态</Label>
                  <p className="font-medium">{selectedOrder.status}</p>
                </div>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">订单项</Label>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>产品</TableHead>
                        <TableHead className="text-right">数量</TableHead>
                        <TableHead className="text-right">单价</TableHead>
                        <TableHead className="text-right">小计</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.productName || `产品${item.productId}`}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">¥{item.totalPrice.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              关闭
            </Button>
            <Button
              onClick={() => {
                setReviewAction("APPROVE");
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              批准
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setReviewAction("REJECT");
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
