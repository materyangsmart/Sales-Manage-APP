import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Receipt, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ARApply() {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [appliedAmount, setAppliedAmount] = useState<string>("");

  // 使用tRPC查询收款和发票
  const { data: paymentsData, isLoading: loadingPayments, refetch: refetchPayments } = trpc.payments.list.useQuery({
    orgId: 2,
    page: 1,
    pageSize: 100,
  });

  const { data: invoicesData, isLoading: loadingInvoices, refetch: refetchInvoices } = trpc.invoices.list.useQuery({
    orgId: 2,
    status: "OPEN",
    page: 1,
    pageSize: 100,
  });

  // 只显示有未核销金额的收款
  const payments = (paymentsData?.data || []).filter((p: any) => p.unappliedAmount > 0);
  const invoices = invoicesData?.data || [];
  const loading = loadingPayments || loadingInvoices;

  const selectedPayment = payments.find((p: any) => p.id.toString() === selectedPaymentId);
  const selectedInvoice = invoices.find((i: any) => i.id.toString() === selectedInvoiceId);

  // 核销mutation
  const applyMutation = trpc.arApply.create.useMutation({
    onSuccess: () => {
      toast.success("核销成功");
      setSelectedPaymentId("");
      setSelectedInvoiceId("");
      setAppliedAmount("");
      refetchPayments();
      refetchInvoices();
    },
    onError: (error) => {
      toast.error("核销失败: " + error.message);
    },
  });

  const submitting = applyMutation.isPending;

  const handleApply = () => {
    if (!selectedPaymentId || !selectedInvoiceId || !appliedAmount) {
      toast.error("请填写完整信息");
      return;
    }

    const amount = parseFloat(appliedAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("请输入有效的核销金额");
      return;
    }

    if (selectedPayment && amount > (selectedPayment as any).unappliedAmount) {
      toast.error("核销金额不能超过收款的未核销金额");
      return;
    }

    if (selectedInvoice && amount > (selectedInvoice as any).balance) {
      toast.error("核销金额不能超过发票的未付余额");
      return;
    }

    applyMutation.mutate({
      paymentId: parseInt(selectedPaymentId),
      invoiceId: parseInt(selectedInvoiceId),
      appliedAmount: amount,
    });
  };



  const suggestAmount = () => {
    if (!selectedPayment || !selectedInvoice) return;
    
    const maxAmount = Math.min(
      (selectedPayment as any).unappliedAmount,
      (selectedInvoice as any).balance
    );
    setAppliedAmount(maxAmount.toFixed(2));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">核销操作</h1>
          <p className="text-muted-foreground mt-2">
            将收款与发票进行核销，更新余额
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>核销信息</CardTitle>
                <CardDescription>
                  选择收款和发票，输入核销金额
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="payment">选择收款</Label>
                  <Select
                    value={selectedPaymentId}
                    onValueChange={setSelectedPaymentId}
                  >
                    <SelectTrigger id="payment">
                      <SelectValue placeholder="请选择收款记录" />
                    </SelectTrigger>
                    <SelectContent>
                      {payments.length === 0 ? (
                        <SelectItem value="none" disabled>
                          暂无可用收款
                        </SelectItem>
                      ) : (
                        payments.map((payment: any) => (
                          <SelectItem key={payment.id} value={payment.id.toString()}>
                            {payment.paymentNo} - {payment.customerName || `客户${payment.customerId}`} 
                            (未核销: ¥{payment.unappliedAmount.toFixed(2)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedPayment && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <p>收款金额: ¥{selectedPayment.amount.toFixed(2)}</p>
                      <p>未核销金额: ¥{selectedPayment.unappliedAmount.toFixed(2)}</p>
                      <p>收款日期: {new Date(selectedPayment.paymentDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice">选择发票</Label>
                  <Select
                    value={selectedInvoiceId}
                    onValueChange={setSelectedInvoiceId}
                  >
                    <SelectTrigger id="invoice">
                      <SelectValue placeholder="请选择发票" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoices.length === 0 ? (
                        <SelectItem value="none" disabled>
                          暂无未结清发票
                        </SelectItem>
                      ) : (
                        invoices.map((invoice: any) => (
                          <SelectItem key={invoice.id} value={invoice.id.toString()}>
                            {invoice.invoiceNo} - {invoice.customerName || `客户${invoice.customerId}`}
                            (余额: ¥{invoice.balance.toFixed(2)})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedInvoice && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <p>发票金额: ¥{selectedInvoice.totalAmount.toFixed(2)}</p>
                      <p>未付余额: ¥{selectedInvoice.balance.toFixed(2)}</p>
                      <p>发票日期: {new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount">核销金额</Label>
                    {selectedPayment && selectedInvoice && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={suggestAmount}
                        className="h-auto p-0 text-xs"
                      >
                        使用最大可核销金额
                      </Button>
                    )}
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="输入核销金额"
                    value={appliedAmount}
                    onChange={(e) => setAppliedAmount(e.target.value)}
                  />
                  {selectedPayment && selectedInvoice && appliedAmount && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <p>
                        最大可核销: ¥
                        {Math.min(
                          selectedPayment.unappliedAmount,
                          selectedInvoice.balance
                        ).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>

                {selectedPayment && selectedInvoice && appliedAmount && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      核销后，收款未核销金额将减少 ¥{parseFloat(appliedAmount).toFixed(2)}，
                      发票余额将减少 ¥{parseFloat(appliedAmount).toFixed(2)}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleApply}
                  disabled={!selectedPaymentId || !selectedInvoiceId || !appliedAmount || submitting}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      核销中...
                    </>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4 mr-2" />
                      执行核销
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">操作说明</CardTitle>
              </CardHeader>
              <CardContent className="text-blue-800 space-y-2">
                <p>• 选择一个有未核销金额的收款记录</p>
                <p>• 选择一个未结清的发票</p>
                <p>• 输入核销金额（不能超过收款的未核销金额和发票的未付余额）</p>
                <p>• 点击"执行核销"完成操作</p>
                <p>• 核销后，收款和发票的状态会自动更新</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
