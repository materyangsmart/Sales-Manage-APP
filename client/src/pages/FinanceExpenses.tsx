/**
 * 财务报销审核工作台 (Finance Expense Portal)
 * Mega-Sprint 8 Epic 2
 *
 * 功能：
 * - 仅限 FINANCE / ADMIN 角色访问
 * - 展示所有待审核报销单（含发票预览）
 * - 财务一键打款（APPROVED → PAID）
 * - 关联出差申请详情展示
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ============================================================
// 状态颜色映射
// ============================================================
const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
  PAID: "bg-green-100 text-green-800 border-green-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "待打款",
  PAID: "已打款",
  REJECTED: "已驳回",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  TRAVEL: "差旅费",
  ENTERTAINMENT: "招待费",
  LOGISTICS_SUBSIDY: "物流补贴",
  OTHER: "其他",
};

// ============================================================
// 主页面组件
// ============================================================
export default function FinanceExpenses() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("APPROVED");
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [financeRemark, setFinanceRemark] = useState("");
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");

  // 权限检查
  if (user && user.role !== "admin" && (user as any).role !== "finance") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-semibold text-gray-700">访问受限</h2>
            <p className="text-gray-500 mt-2">仅限财务部门或管理员访问此页面</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { data: claims, isLoading, refetch } = trpc.financeExpenses.listWithTrip.useQuery({
    status: statusFilter || undefined,
  });

  const financeApproveMutation = trpc.financeExpenses.financeApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`✅ 报销单 ${data.claimNo} 已打款 ¥${Number(data.amount).toFixed(2)}`);
      setIsPayDialogOpen(false);
      setFinanceRemark("");
      setSelectedClaim(null);
      refetch();
    },
    onError: (err) => {
      toast.error(`打款失败：${err.message}`);
    },
  });

  const handlePayClick = (claim: any) => {
    setSelectedClaim(claim);
    setFinanceRemark("");
    setIsPayDialogOpen(true);
  };

  const handleConfirmPay = () => {
    if (!selectedClaim) return;
    financeApproveMutation.mutate({
      claimId: selectedClaim.id,
      financeRemark,
    });
  };

  const handleInvoicePreview = (url: string) => {
    setPreviewImageUrl(url);
    setIsInvoicePreviewOpen(true);
  };

  const filterButtons = [
    { label: "待打款", value: "APPROVED" },
    { label: "已打款", value: "PAID" },
    { label: "待审核", value: "PENDING" },
    { label: "全部", value: "" },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">财务报销审核工作台</h1>
            <p className="text-sm text-gray-500 mt-1">
              审核并打款报销单 · 仅限财务部门 / 管理员
            </p>
          </div>
          <div className="flex gap-2">
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={statusFilter === btn.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(btn.value)}
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-700">
                {claims?.filter((c) => c.status === "APPROVED").length ?? 0}
              </div>
              <div className="text-sm text-yellow-600">待打款单据</div>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-700">
                ¥{claims
                  ?.filter((c) => c.isPaid)
                  .reduce((sum, c) => sum + Number(c.amount), 0)
                  .toFixed(2) ?? "0.00"}
              </div>
              <div className="text-sm text-green-600">本月已打款金额</div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-700">
                ¥{claims
                  ?.filter((c) => !c.isPaid && c.status === "APPROVED")
                  .reduce((sum, c) => sum + Number(c.amount), 0)
                  .toFixed(2) ?? "0.00"}
              </div>
              <div className="text-sm text-blue-600">待打款金额</div>
            </CardContent>
          </Card>
        </div>

        {/* 报销单列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              报销单列表
              {statusFilter && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  · {STATUS_LABELS[statusFilter] ?? statusFilter}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : !claims || claims.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p>暂无报销单</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* 左侧信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold text-gray-700">
                            {claim.claimNo}
                          </span>
                          <Badge
                            className={`text-xs border ${STATUS_COLORS[claim.status] ?? "bg-gray-100"}`}
                          >
                            {STATUS_LABELS[claim.status] ?? claim.status}
                          </Badge>
                          {claim.isPaid && (
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                              ✓ 已打款
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {EXPENSE_TYPE_LABELS[claim.expenseType] ?? claim.expenseType}
                          </Badge>
                        </div>

                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="text-gray-400">申请人：</span>
                            {claim.submittedByName}
                          </div>
                          <div>
                            <span className="text-gray-400">金额：</span>
                            <span className="font-semibold text-gray-900">
                              ¥{Number(claim.amount).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">费用日期：</span>
                            {claim.expenseDate
                              ? new Date(claim.expenseDate as unknown as string).toLocaleDateString()
                              : "-"}
                          </div>
                          <div>
                            <span className="text-gray-400">关联客户：</span>
                            {claim.associatedCustomerName ?? "-"}
                          </div>
                        </div>

                        <div className="mt-1 text-sm text-gray-500 truncate">
                          <span className="text-gray-400">说明：</span>
                          {claim.description}
                        </div>

                        {/* 关联出差申请 */}
                        {claim.businessTrip && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700 flex items-center gap-2">
                            <span>✈️</span>
                            <span>
                              关联出差：{claim.businessTrip.tripNo} ·{" "}
                              {claim.businessTrip.destination} ·{" "}
                              {new Date(claim.businessTrip.startDate as unknown as string).toLocaleDateString()}
                              {" ~ "}
                              {new Date(claim.businessTrip.endDate as unknown as string).toLocaleDateString()}
                            </span>
                            <Badge className="text-xs bg-green-100 text-green-700 border-green-200">
                              {claim.businessTrip.status}
                            </Badge>
                          </div>
                        )}

                        {/* 打款信息 */}
                        {claim.isPaid && claim.paidByName && (
                          <div className="mt-1 text-xs text-green-600">
                            打款人：{claim.paidByName} ·{" "}
                            {claim.paidAt
                              ? new Date(claim.paidAt as unknown as string).toLocaleString()
                              : ""}
                            {claim.financeRemark && ` · 备注：${claim.financeRemark}`}
                          </div>
                        )}
                      </div>

                      {/* 右侧操作 */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {claim.invoiceImageUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInvoicePreview(claim.invoiceImageUrl!)}
                          >
                            🧾 查看发票
                          </Button>
                        )}
                        {claim.status === "APPROVED" && !claim.isPaid && (
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handlePayClick(claim)}
                          >
                            💰 确认打款
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 打款确认 Dialog */}
      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认财务打款</DialogTitle>
          </DialogHeader>
          {selectedClaim && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                <div>
                  <span className="text-gray-500">报销单号：</span>
                  <span className="font-mono font-semibold">{selectedClaim.claimNo}</span>
                </div>
                <div>
                  <span className="text-gray-500">申请人：</span>
                  {selectedClaim.submittedByName}
                </div>
                <div>
                  <span className="text-gray-500">打款金额：</span>
                  <span className="text-xl font-bold text-green-600">
                    ¥{Number(selectedClaim.amount).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">费用说明：</span>
                  {selectedClaim.description}
                </div>
              </div>
              <div>
                <Label htmlFor="financeRemark">财务备注（可选）</Label>
                <Textarea
                  id="financeRemark"
                  value={financeRemark}
                  onChange={(e) => setFinanceRemark(e.target.value)}
                  placeholder="如：已转账至员工银行卡，流水号 xxx"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirmPay}
              disabled={financeApproveMutation.isPending}
            >
              {financeApproveMutation.isPending ? "处理中..." : "确认打款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 发票预览 Dialog */}
      <Dialog open={isInvoicePreviewOpen} onOpenChange={setIsInvoicePreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>发票预览</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img
              src={previewImageUrl}
              alt="发票"
              className="max-w-full max-h-[60vh] object-contain rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af'%3E图片加载失败%3C/text%3E%3C/svg%3E";
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoicePreviewOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
