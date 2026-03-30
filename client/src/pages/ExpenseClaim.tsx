/**
 * 费用报销页面 (Expense Claim)
 * Mega-Sprint 7 Epic 3
 *
 * 功能：
 * 1. 移动端友好的报销单提交（差旅/招待/物流补贴）
 * 2. 发票图片上传（调用 OSS 直传）
 * 3. 绑定到具体客户
 * 4. 报销列表查看
 * 5. 单客真实毛利查询（P&L）
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Receipt,
  Camera,
  Upload,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  RotateCcw,
  MessageSquare,
} from "lucide-react";

// ─── 状态徽章 ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PENDING: { label: "待审批", variant: "secondary" },
    APPROVED: { label: "已通过", variant: "default" },
    REJECTED: { label: "已拒绝", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "outline" };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

// ─── 费用类型标签 ─────────────────────────────────────────────────────────────
const EXPENSE_TYPE_LABELS: Record<string, string> = {
  TRAVEL: "差旅费",
  ENTERTAINMENT: "招待费",
  LOGISTICS_SUBSIDY: "物流补贴",
  OTHER: "其他",
};

// ─── 提交报销表单 ─────────────────────────────────────────────────────────────
function SubmitExpenseForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    expenseType: "ENTERTAINMENT" as "TRAVEL" | "ENTERTAINMENT" | "LOGISTICS_SUBSIDY" | "OTHER",
    amount: "",
    description: "",
    associatedCustomerId: "",
    associatedCustomerName: "",
    expenseDate: new Date().toISOString().split("T")[0],
    invoiceImageUrl: "",
    invoiceImageKey: "",
  });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const submitMutation = trpc.expenses.submit.useMutation({
    onSuccess: () => {
      toast.success("报销单提交成功", { description: "等待审批中..." });
      utils.expenses.list.invalidate();
      onSuccess?.();
      setForm({
        expenseType: "ENTERTAINMENT",
        amount: "",
        description: "",
        associatedCustomerId: "",
        associatedCustomerName: "",
        expenseDate: new Date().toISOString().split("T")[0],
        invoiceImageUrl: "",
        invoiceImageKey: "",
      });
      setPreviewUrl("");
    },
    onError: (err) => toast.error("提交失败", { description: err.message }),
  });

  const uploadMutation = trpc.storage.uploadImage.useMutation({
    onSuccess: (data) => {
      setForm((f) => ({ ...f, invoiceImageUrl: data.url, invoiceImageKey: data.fileKey }));
      setPreviewUrl(data.url);
      toast.success("发票上传成功");
    },
    onError: (err) => toast.error("上传失败", { description: err.message }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("文件过大", { description: "发票图片不能超过 5MB" });
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadMutation.mutate({
        filename: file.name,
        contentType: file.type,
        base64Data: base64,
      });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!form.amount || isNaN(Number(form.amount))) {
      toast.error("请输入有效金额");
      return;
    }
    if (!form.description) {
      toast.error("请填写费用说明");
      return;
    }
    if (!form.associatedCustomerName.trim()) {
      toast.error("请填写客户名称");
      return;
    }
    submitMutation.mutate({
      expenseType: form.expenseType,
      amount: Number(form.amount),
      description: form.description,
      associatedCustomerId: form.associatedCustomerId ? Number(form.associatedCustomerId) : undefined,
      associatedCustomerName: form.associatedCustomerName,
      expenseDate: form.expenseDate,
      invoiceImageUrl: form.invoiceImageUrl || undefined,
      invoiceImageKey: form.invoiceImageKey || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* 费用类型 */}
      <div className="grid grid-cols-2 gap-3">
        {(["TRAVEL", "ENTERTAINMENT", "LOGISTICS_SUBSIDY", "OTHER"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setForm((f) => ({ ...f, expenseType: type }))}
            className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
              form.expenseType === type
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-border bg-card text-muted-foreground hover:border-blue-300"
            }`}
          >
            {EXPENSE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      {/* 金额 */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">报销金额（元）</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-bold">¥</span>
          <Input
            type="number"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="pl-8 text-xl font-bold h-12"
          />
        </div>
      </div>

      {/* 费用说明 */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">费用说明</Label>
        <Textarea
          placeholder="例如：拜访客户张老板，招待费用..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
        />
      </div>

      {/* 关联客户 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm font-medium">关联客户ID（选填）</Label>
          <Input
            type="number"
            placeholder="客户ID"
            value={form.associatedCustomerId}
            onChange={(e) => setForm((f) => ({ ...f, associatedCustomerId: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm font-medium">客户名称 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="请输入客户名称"
            value={form.associatedCustomerName}
            onChange={(e) => setForm((f) => ({ ...f, associatedCustomerName: e.target.value }))}
            className={!form.associatedCustomerName.trim() && form.amount ? "border-red-300" : ""}
          />
          {!form.associatedCustomerName.trim() && form.amount && (
            <p className="text-xs text-red-500">客户名称为必填项</p>
          )}
        </div>
      </div>

      {/* 费用日期 */}
      <div className="space-y-1">
        <Label className="text-sm font-medium">费用日期</Label>
        <Input
          type="date"
          value={form.expenseDate}
          onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
        />
      </div>

      {/* 发票上传 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">上传发票（选填）</Label>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {previewUrl ? (
          <div className="relative">
            <img src={previewUrl} alt="发票" className="w-full max-h-48 object-cover rounded-lg border" />
            <button
              onClick={() => { setPreviewUrl(""); setForm((f) => ({ ...f, invoiceImageUrl: "", invoiceImageKey: "" })); }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            {uploading ? (
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span className="text-sm">拍照或选择发票图片</span>
              </>
            )}
          </button>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitMutation.isPending}
        className="w-full h-12 text-base font-semibold"
      >
        {submitMutation.isPending ? "提交中..." : "提交报销申请"}
      </Button>
    </div>
  );
}

// ─── 报销列表 ─────────────────────────────────────────────────────────────────
function ExpenseList() {
  const { data, isLoading } = trpc.expenses.list.useQuery({});
  const utils = trpc.useUtils();
  const { user } = useAuth();

  // 退回原因弹窗状态
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingClaimId, setRejectingClaimId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState("");

  // 重新提交编辑弹窗状态
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [resubmitItem, setResubmitItem] = useState<any>(null);
  const [resubmitForm, setResubmitForm] = useState({
    amount: "",
    description: "",
  });

  const approveMutation = trpc.expenses.approve.useMutation({
    onSuccess: (result) => {
      utils.expenses.list.invalidate();
      if (result.status === "APPROVED") {
        toast.success("审批通过", { description: `报销单 ${result.claimNo} 已通过` });
      } else {
        toast.success("已退回", { description: `报销单 ${result.claimNo} 已退回给申请人` });
      }
      setRejectDialogOpen(false);
      setRejectReason("");
      setRejectReasonError("");
      setRejectingClaimId(null);
    },
    onError: (err) => toast.error("审批失败", { description: err.message }),
  });

  const resubmitMutation = trpc.expenses.resubmit.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      toast.success("重新提交成功", { description: "报销单已重新提交，等待审批" });
      setResubmitDialogOpen(false);
      setResubmitItem(null);
    },
    onError: (err: any) => toast.error("重新提交失败", { description: err.message }),
  });

  const handleRejectClick = (claimId: number) => {
    setRejectingClaimId(claimId);
    setRejectReason("");
    setRejectReasonError("");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      setRejectReasonError("请填写退回原因");
      return;
    }
    if (rejectReason.trim().length < 5) {
      setRejectReasonError("退回原因至少 5 个字");
      return;
    }
    if (rejectingClaimId) {
      approveMutation.mutate({
        claimId: rejectingClaimId,
        approved: false,
        approvalRemark: rejectReason.trim(),
      });
    }
  };

  const handleResubmitClick = (item: any) => {
    setResubmitItem(item);
    setResubmitForm({
      amount: String(parseFloat(item.amount || "0")),
      description: item.description || "",
    });
    setResubmitDialogOpen(true);
  };

  const handleConfirmResubmit = () => {
    if (!resubmitItem) return;
    const amount = Number(resubmitForm.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error("请输入有效金额");
      return;
    }
    if (!resubmitForm.description.trim()) {
      toast.error("请填写费用说明");
      return;
    }
    resubmitMutation.mutate({
      claimId: resubmitItem.id,
      amount,
      description: resubmitForm.description.trim(),
    });
  };

  // 格式化日期（防止 Date 对象直接渲染）
  const formatDate = (d: any) => {
    if (!d) return "-";
    if (d instanceof Date) return d.toLocaleDateString("zh-CN");
    if (typeof d === "string") return d;
    try { return new Date(d).toLocaleDateString("zh-CN"); } catch { return String(d); }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const items = data?.items || [];
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>暂无报销记录</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {items.map((item: any) => (
          <Card key={item.id} className={`overflow-hidden ${
            item.status === "REJECTED" ? "border-red-200" : ""
          }`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">¥{parseFloat(item.amount || "0").toFixed(2)}</span>
                    <Badge variant="outline" className="text-xs">{EXPENSE_TYPE_LABELS[item.expenseType] || item.expenseType}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>提交人：{item.submittedByName}</span>
                {item.associatedCustomerName && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {item.associatedCustomerName}
                  </span>
                )}
                <span>{formatDate(item.expenseDate)}</span>
              </div>
              {item.invoiceImageUrl && (
                <a href={item.invoiceImageUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:underline">
                  <Receipt className="w-3 h-3" />查看发票
                </a>
              )}

              {/* 退回原因展示（所有人可见） */}
              {item.status === "REJECTED" && item.approvalRemark && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-red-700 mb-1">退回原因：</p>
                      <p className="text-sm text-red-600">{item.approvalRemark}</p>
                      {item.approvedByName && (
                        <p className="text-xs text-red-400 mt-1">审批人：{item.approvedByName} · {formatDate(item.approvedAt)}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 审批通过信息展示 */}
              {item.status === "APPROVED" && item.approvedByName && (
                <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  审批人：{item.approvedByName} · {formatDate(item.approvedAt)}
                  {item.approvalRemark && ` · 备注：${item.approvalRemark}`}
                </div>
              )}

              {/* 管理员审批按钮（仅 PENDING 状态） */}
              {user?.role === "admin" && item.status === "PENDING" && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => approveMutation.mutate({ claimId: item.id, approved: true })}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />通过
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => handleRejectClick(item.id)}
                    disabled={approveMutation.isPending}
                  >
                    <XCircle className="w-3 h-3 mr-1" />退回
                  </Button>
                </div>
              )}

              {/* 销售员重新提交按钮（仅 REJECTED 状态 + 本人提交的） */}
              {item.status === "REJECTED" && user && item.submittedBy === user.id && (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
                    onClick={() => handleResubmitClick(item)}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />修改并重新提交
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 退回原因弹窗 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退回报销单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              退回后，申请人将看到退回原因，并可以修改后重新提交。
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectReason" className="text-sm font-semibold">
                退回原因 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (e.target.value.trim()) setRejectReasonError("");
                }}
                placeholder="请详细说明退回原因，例如：发票金额与报销金额不符、缺少发票附件..."
                rows={3}
                className={rejectReasonError ? "border-red-500" : ""}
              />
              {rejectReasonError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />{rejectReasonError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? "处理中..." : "确认退回"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重新提交弹窗 */}
      <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改并重新提交</DialogTitle>
          </DialogHeader>
          {resubmitItem && (
            <div className="space-y-4">
              {/* 显示上次退回原因 */}
              {resubmitItem.approvalRemark && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">上次退回原因：</p>
                  <p className="text-sm text-red-600">{resubmitItem.approvalRemark}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">报销金额（元）</Label>
                <Input
                  type="number"
                  value={resubmitForm.amount}
                  onChange={(e) => setResubmitForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">费用说明</Label>
                <Textarea
                  value={resubmitForm.description}
                  onChange={(e) => setResubmitForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="费用说明"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleConfirmResubmit}
              disabled={resubmitMutation.isPending}
            >
              {resubmitMutation.isPending ? "提交中..." : "重新提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── 单客 P&L 核算 ────────────────────────────────────────────────────────────
function CustomerPnL() {
  const [customerId, setCustomerId] = useState("");
  const [queryId, setQueryId] = useState<number | null>(null);

  const { data, isLoading } = trpc.expenses.getCustomerPnL.useQuery(
    { customerId: queryId! },
    { enabled: queryId !== null }
  );

  const handleQuery = () => {
    const id = Number(customerId);
    if (!id || isNaN(id)) {
      toast.error("请输入有效的客户ID");
      return;
    }
    setQueryId(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="输入客户ID"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="flex-1"
        />
        <Button onClick={handleQuery} disabled={isLoading}>
          {isLoading ? "查询中..." : "查询P&L"}
        </Button>
      </div>

      {data && (
        <div className="space-y-3">
          {/* 核心指标卡片 */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <p className="text-xs text-blue-600 font-medium">订单总毛利</p>
                <p className="text-xl font-bold text-blue-700">¥{data.summary.grossProfit.toLocaleString()}</p>
                <p className="text-xs text-blue-500 mt-0.5">营收 ¥{data.summary.totalRevenue.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className={`${data.summary.netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <CardContent className="p-3">
                <p className={`text-xs font-medium ${data.summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>真实净利润</p>
                <p className={`text-xl font-bold ${data.summary.netProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {data.summary.netProfit >= 0 ? "+" : ""}¥{data.summary.netProfit.toLocaleString()}
                </p>
                <p className={`text-xs mt-0.5 ${data.summary.netProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {data.summary.orderCount} 笔订单
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 扣减明细 */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">利润扣减明细</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-orange-500" />售后赔款
                </span>
                <span className="font-medium text-orange-600">-¥{data.summary.totalRmaClaims.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-purple-500" />归属费用
                </span>
                <span className="font-medium text-purple-600">-¥{data.summary.totalExpenses.toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between items-center text-sm font-semibold">
                <span>净利润</span>
                <span className={data.summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                  ¥{data.summary.netProfit.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 费用明细 */}
          {data.breakdown.expenseItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold">费用明细（{data.breakdown.expenseItems.length}笔）</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {data.breakdown.expenseItems.map((e: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{e.description} ({EXPENSE_TYPE_LABELS[e.type]})</span>
                    <span className="font-medium">¥{e.amount.toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 主页面（重构为“列表 + 新建”经典结构）──────────────────────────────────────────
export default function ExpenseClaimPage() {
  const [activeTab, setActiveTab] = useState("list");

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">费用报销</h1>
            <p className="text-sm text-muted-foreground">我的报销申请 · 历史记录</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full mb-4">
          <TabsTrigger value="list">报销记录</TabsTrigger>
          <TabsTrigger value="submit">新建报销</TabsTrigger>
          <TabsTrigger value="pnl">单客P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ExpenseList />
        </TabsContent>

        <TabsContent value="submit">
          <SubmitExpenseForm onSuccess={() => setActiveTab("list")} />
        </TabsContent>

        <TabsContent value="pnl">
          <CustomerPnL />
        </TabsContent>
      </Tabs>
    </div>
  );
}