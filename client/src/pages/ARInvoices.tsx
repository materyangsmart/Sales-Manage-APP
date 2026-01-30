import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
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
import { FileText, Loader2, Filter } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { InvoiceStatus } from "@/lib/types";

export default function ARInvoices() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");

  // 使用tRPC查询发票
  const { data: invoicesData, isLoading: loading } = trpc.invoices.list.useQuery({
    orgId: 2,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page: 1,
    pageSize: 50,
  });

  const invoices = invoicesData?.data || [];

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles = {
      OPEN: "bg-green-100 text-green-800",
      CLOSED: "bg-gray-100 text-gray-800",
    };
    const labels = {
      OPEN: "未结清",
      CLOSED: "已结清",
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
          <h1 className="text-3xl font-bold tracking-tight">发票管理</h1>
          <p className="text-muted-foreground mt-2">
            管理应收发票，查看发票状态和余额
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>应收发票列表</CardTitle>
                <CardDescription>
                  查看所有应收发票及其状态
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as InvoiceStatus | "ALL")}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="筛选状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">全部状态</SelectItem>
                    <SelectItem value="OPEN">未结清</SelectItem>
                    <SelectItem value="CLOSED">已结清</SelectItem>
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
            ) : invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无发票记录
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>发票号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>关联订单</TableHead>
                    <TableHead>发票日期</TableHead>
                    <TableHead>到期日期</TableHead>
                    <TableHead className="text-right">总金额</TableHead>
                    <TableHead className="text-right">余额</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNo}</TableCell>
                      <TableCell>{invoice.customerName || `客户${invoice.customerId}`}</TableCell>
                      <TableCell>{invoice.orderNo || "-"}</TableCell>
                      <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">¥{invoice.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ¥{invoice.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
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
                未结清发票
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {invoices.filter(inv => inv.status === "OPEN").length}
              </div>
              <p className="text-xs text-muted-foreground">
                总金额: ¥{invoices
                  .filter(inv => inv.status === "OPEN")
                  .reduce((sum, inv) => sum + inv.totalAmount, 0)
                  .toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                未收余额
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                ¥{invoices
                  .reduce((sum, inv) => sum + inv.balance, 0)
                  .toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                需要核销的金额
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                已结清发票
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {invoices.filter(inv => inv.status === "CLOSED").length}
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
