import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CreditCard, Loader2, Filter } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { PaymentAppliedStatus } from "@/lib/types";

export default function ARPayments() {
  const [statusFilter, setStatusFilter] = useState<PaymentAppliedStatus | "ALL">("ALL");

  // 使用tRPC查询收款
  const { data: paymentsData, isLoading: loading } = trpc.payments.list.useQuery({
    orgId: 2,
    appliedStatus: statusFilter === "ALL" ? undefined : statusFilter,
    page: 1,
    pageSize: 50,
  });

  const payments = paymentsData?.data || [];

  const getStatusBadge = (status: PaymentAppliedStatus) => {
    const styles = {
      UNAPPLIED: "bg-blue-100 text-blue-800",
      PARTIAL: "bg-yellow-100 text-yellow-800",
      APPLIED: "bg-green-100 text-green-800",
    };
    const labels = {
      UNAPPLIED: "未核销",
      PARTIAL: "部分核销",
      APPLIED: "已核销",
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">收款管理</h1>
          <p className="text-muted-foreground mt-2">
            管理客户收款记录，查看核销状态
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>收款记录列表</CardTitle>
                <CardDescription>
                  查看所有收款记录及核销状态
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as any)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="筛选状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部状态</SelectItem>
                    <SelectItem value="UNAPPLIED">未核销</SelectItem>
                    <SelectItem value="PARTIAL">部分核销</SelectItem>
                    <SelectItem value="APPLIED">已核销</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无收款记录
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>收款号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>收款日期</TableHead>
                    <TableHead>收款方式</TableHead>
                    <TableHead className="text-right">收款金额</TableHead>
                    <TableHead className="text-right">未核销金额</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.paymentNo}</TableCell>
                      <TableCell>{payment.customerName || `客户${payment.customerId}`}</TableCell>
                      <TableCell>{new Date(payment.paymentDate).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.paymentMethod}</TableCell>
                      <TableCell className="text-right">¥{payment.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ¥{payment.unappliedAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                未核销收款
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {payments.filter((p: any) => p.status === "UNAPPLIED").length}
              </div>
              <p className="text-xs text-muted-foreground">
                总金额: ¥{payments
                  .filter((p: any) => p.status === "UNAPPLIED")
                  .reduce((sum: number, p: any) => sum + p.amount, 0)
                  .toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                未核销余额
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ¥{payments
                  .reduce((sum: number, p: any) => sum + p.unappliedAmount, 0)
                  .toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                可用于核销的金额
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                已核销收款
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {payments.filter((p: any) => p.status === "APPLIED").length}
              </div>
              <p className="text-xs text-muted-foreground">
                已完成核销
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
