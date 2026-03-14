/**
 * 发票管理页 (RC6 Epic 3 重构)
 * 新增：高级搜索栏（客户名称/订单编号）+ 状态 Tab
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FileText, Loader2, Filter, Search, RefreshCw, X, CreditCard } from "lucide-react";
import { useState as useDialogState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import type { InvoiceStatus } from "@/lib/types";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "OPEN", label: "未结清" },
  { value: "CLOSED", label: "已结清" },
];

export default function ARInvoices() {
  const [activeTab, setActiveTab] = useState<"ALL" | InvoiceStatus>("ALL");
  const [searchCustomer, setSearchCustomer] = useState("");
  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [appliedSearch, setAppliedSearch] = useState({ customer: "", orderNo: "" });

  // 核销 Dialog
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [writeOffAmount, setWriteOffAmount] = useState("");

  const { data: invoicesData, isLoading: loading, refetch } = trpc.invoices.list.useQuery({
    orgId: 2,
    status: activeTab === "ALL" ? undefined : activeTab,
    page: 1,
    pageSize: 100,
  });

  const createPaymentMutation = trpc.payments.writeOff.useMutation({
    onSuccess: () => {
      toast.success("核邀成功！发票状态已更新");
      setWriteOffDialogOpen(false);
      setSelectedInvoice(null);
      setWriteOffAmount("");
      refetch();
    },
    onError: (err: any) => {
      toast.error("核邀失败: " + err.message);
    },
  });

  const handleApplySearch = () => {
    setAppliedSearch({ customer: searchCustomer, orderNo: searchOrderNo });
  };

  const handleClearSearch = () => {
    setSearchCustomer("");
    setSearchOrderNo("");
    setAppliedSearch({ customer: "", orderNo: "" });
  };

  const handleWriteOff = () => {
    if (!selectedInvoice || !writeOffAmount) {
      toast.error("请输入核销金额");
      return;
    }
    createPaymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      amount: parseFloat(writeOffAmount),
      paymentMethod: "BANK_TRANSFER",
      remark: "手动核销",
    });
  };

  const allInvoices: any[] = (invoicesData as any)?.data || [];
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      if (appliedSearch.customer && !inv.customerName?.toLowerCase().includes(appliedSearch.customer.toLowerCase())) return false;
      if (appliedSearch.orderNo && !String(inv.orderId).includes(appliedSearch.orderNo) &&
          !inv.orderNo?.includes(appliedSearch.orderNo)) return false;
      return true;
    });
  }, [allInvoices, appliedSearch]);

  const hasActiveSearch = Object.values(appliedSearch).some(Boolean);

  const getStatusBadge = (status: InvoiceStatus) => {
    const styles: Record<string, string> = {
      OPEN: "bg-green-100 text-green-800",
      CLOSED: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, string> = { OPEN: "未结清", CLOSED: "已结清" };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">发票管理</h1>
          <p className="text-muted-foreground mt-1">管理应收发票，查看发票状态和余额，支持手动核销</p>
        </div>

        {/* 高级搜索栏 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">高级搜索</CardTitle>
              {hasActiveSearch && (
                <Badge variant="secondary" className="text-xs">已筛选 {filteredInvoices.length} 条</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label className="text-xs text-muted-foreground">订单编号</Label>
                <Input
                  placeholder="输入订单编号搜索"
                  value={searchOrderNo}
                  onChange={(e) => setSearchOrderNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleApplySearch()}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={handleApplySearch}>
                <Search className="h-4 w-4 mr-1" /> 搜索
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>

          {STATUS_TABS.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card>
                <CardHeader>
                  <CardTitle>{tab.label}发票</CardTitle>
                  <CardDescription>
                    共 {filteredInvoices.length} 条记录
                    {hasActiveSearch && <span className="text-blue-600 ml-1">（已筛选）</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredInvoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      {hasActiveSearch ? "未找到匹配的发票" : `暂无${tab.label}发票`}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>发票号</TableHead>
                          <TableHead>客户名称</TableHead>
                          <TableHead>订单编号</TableHead>
                          <TableHead>发票金额</TableHead>
                          <TableHead>已付金额</TableHead>
                          <TableHead>余额</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvoices.map((invoice) => {
                          const balance = (invoice.totalAmount || 0) - (invoice.paidAmount || 0);
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell className="font-mono text-sm">INV-{invoice.id}</TableCell>
                              <TableCell>{invoice.customerName || `客户#${invoice.customerId}`}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {invoice.orderNo || `#${invoice.orderId}`}
                              </TableCell>
                              <TableCell>¥{(invoice.totalAmount || 0).toLocaleString()}</TableCell>
                              <TableCell>¥{(invoice.paidAmount || 0).toLocaleString()}</TableCell>
                              <TableCell className={balance > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                                ¥{balance.toLocaleString()}
                              </TableCell>
                              <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                              <TableCell>
                                {invoice.status === "OPEN" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setSelectedInvoice(invoice); setWriteOffAmount(String(balance)); setWriteOffDialogOpen(true); }}
                                  >
                                    <CreditCard className="h-4 w-4 mr-1" /> 核销
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* 核销 Dialog */}
        <Dialog open={writeOffDialogOpen} onOpenChange={setWriteOffDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>发票核销</DialogTitle>
              <DialogDescription>
                发票 INV-{selectedInvoice?.id} — 客户: {selectedInvoice?.customerName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 rounded p-3">
                <div><span className="text-muted-foreground">发票金额: </span>¥{(selectedInvoice?.totalAmount || 0).toLocaleString()}</div>
                <div><span className="text-muted-foreground">已付金额: </span>¥{(selectedInvoice?.paidAmount || 0).toLocaleString()}</div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">待核销余额: </span>
                  <span className="text-red-600 font-medium">
                    ¥{((selectedInvoice?.totalAmount || 0) - (selectedInvoice?.paidAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>核销金额</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="输入核销金额"
                  value={writeOffAmount}
                  onChange={(e) => setWriteOffAmount(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWriteOffDialogOpen(false)}>取消</Button>
              <Button onClick={handleWriteOff} disabled={createPaymentMutation.isPending}>
                {createPaymentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CreditCard className="h-4 w-4 mr-1" />}
                确认核销
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
