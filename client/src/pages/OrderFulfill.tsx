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
import { toast } from "sonner";
import { Package, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function OrderFulfill() {
  // 使用tRPC查询已审核订单
  const { data: ordersData, isLoading: loading, refetch } = trpc.orders.list.useQuery({
    orgId: 2, // TODO: 从用户context获取orgId
    status: "APPROVED",
    page: 1,
    pageSize: 20,
  });

  // 履行订单mutation
  const fulfillMutation = trpc.orders.fulfill.useMutation({
    onSuccess: () => {
      toast.success("订单履行成功，已生成发票");
      refetch();
    },
    onError: (error) => {
      toast.error("履行失败: " + error.message);
    },
  });

  const handleFulfill = (orderId: number) => {
    if (confirm("确认履行此订单并生成发票？")) {
      fulfillMutation.mutate({ orderId });
    }
  };

  const orders = ordersData?.data || [];
  const fulfilling = fulfillMutation.variables?.orderId || null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">订单履行</h1>
          <p className="text-muted-foreground mt-2">
            履行已审核订单，生成应收发票
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>已审核订单列表</CardTitle>
            <CardDescription>
              状态为 APPROVED 的订单
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
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.orderNo}</TableCell>
                      <TableCell>{order.customerName || `客户${order.customerId}`}</TableCell>
                      <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">¥{order.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        {order.reviewedAt ? new Date(order.reviewedAt).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell>{order.reviewComment || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleFulfill(order.id)}
                          disabled={fulfilling === order.id}
                        >
                          {fulfilling === order.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              履行中...
                            </>
                          ) : (
                            <>
                              <Package className="h-4 w-4 mr-1" />
                              履行
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">操作说明</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-800 space-y-2">
            <p>• 点击"履行"按钮将执行订单履行操作</p>
            <p>• 系统会自动生成应收发票（ARInvoice）</p>
            <p>• 订单状态将变更为 FULFILLED</p>
            <p>• 生成的发票可在"发票管理"页面查看</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
