import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, FileText, ChevronRight, RefreshCw } from "lucide-react";
import { Link } from "wouter";

type ApprovalAction = "approve" | "reject";

interface ActionDialogState {
  open: boolean;
  action: ApprovalAction;
  instanceId: number | null;
  businessTitle: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING: { label: "待审批", className: "bg-amber-50 text-amber-700 border-amber-200" },
    APPROVED: { label: "已通过", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    REJECTED: { label: "已拒绝", className: "bg-red-50 text-red-700 border-red-200" },
    RUNNING: { label: "进行中", className: "bg-blue-50 text-blue-700 border-blue-200" },
    CANCELLED: { label: "已撤销", className: "bg-slate-50 text-slate-500 border-slate-200" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function WorkflowTodos() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [dialog, setDialog] = useState<ActionDialogState>({
    open: false,
    action: "approve",
    instanceId: null,
    businessTitle: "",
  });
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.workflow.getMyTodos.useQuery({ page, pageSize });

  const approveMut = trpc.workflow.approve.useMutation({
    onSuccess: () => {
      toast.success("审批通过！流程已流转到下一节点。");
      utils.workflow.getMyTodos.invalidate();
      utils.notification.getUnreadCount.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`操作失败：${e.message}`),
  });

  const rejectMut = trpc.workflow.reject.useMutation({
    onSuccess: () => {
      toast.success("已拒绝该审批申请。");
      utils.workflow.getMyTodos.invalidate();
      utils.notification.getUnreadCount.invalidate();
      closeDialog();
    },
    onError: (e) => toast.error(`操作失败：${e.message}`),
  });

  const closeDialog = () => {
    setDialog({ open: false, action: "approve", instanceId: null, businessTitle: "" });
    setComment("");
    setCommentError("");
  };

  const openDialog = (action: ApprovalAction, item: any) => {
    setDialog({
      open: true,
      action,
      instanceId: item.id,
      businessTitle: item.businessTitle ?? `单据 #${item.businessId}`,
    });
    setComment("");
    setCommentError("");
  };

  const handleSubmit = () => {
    if (!comment.trim()) {
      setCommentError("审批意见不能为空，请填写后提交。");
      return;
    }
    if (!dialog.instanceId) return;
    if (dialog.action === "approve") {
      approveMut.mutate({ instanceId: dialog.instanceId, comment: comment.trim() });
    } else {
      rejectMut.mutate({ instanceId: dialog.instanceId, comment: comment.trim() });
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);
  const isPending = approveMut.isPending || rejectMut.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> 我的待办
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            需要您审批的工作流任务，共 <span className="font-medium text-foreground">{total}</span> 条
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> 刷新
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>流程名称</TableHead>
                <TableHead>当前节点</TableHead>
                <TableHead>业务单据</TableHead>
                <TableHead>发起人</TableHead>
                <TableHead>发起时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CheckCircle className="h-10 w-10 text-emerald-300" />
                      <p className="font-medium">暂无待办任务</p>
                      <p className="text-sm">您当前没有需要审批的工作流任务</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item: any) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-medium">
                      {item.definitionName ?? item.workflowCode ?? "工作流"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.currentNodeName ?? item.currentStep ?? "审批节点"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">
                          {item.businessType ?? "ORDER"} #{item.businessId}
                        </span>
                        {item.businessId && (
                          <Link
                            href={`/orders/${item.businessId}`}
                            className="text-primary hover:underline text-xs ml-1"
                          >
                            查看 <ChevronRight className="h-3 w-3 inline" />
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.initiatorName ?? item.createdByName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status ?? "PENDING"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => openDialog("reject", item)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> 拒绝
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => openDialog("approve", item)}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> 同意
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            下一页
          </Button>
        </div>
      )}

      {/* 审批操作对话框 */}
      <Dialog open={dialog.open} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${dialog.action === "approve" ? "text-emerald-700" : "text-red-700"}`}>
              {dialog.action === "approve" ? (
                <><CheckCircle className="h-5 w-5" /> 审批通过</>
              ) : (
                <><XCircle className="h-5 w-5" /> 拒绝申请</>
              )}
            </DialogTitle>
            <DialogDescription>
              {dialog.action === "approve"
                ? `确认通过「${dialog.businessTitle}」的审批申请？`
                : `确认拒绝「${dialog.businessTitle}」的审批申请？`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">
              审批意见 <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder={
                dialog.action === "approve"
                  ? "请填写同意原因或补充说明（必填）..."
                  : "请填写拒绝原因（必填）..."
              }
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (e.target.value.trim()) setCommentError("");
              }}
              rows={4}
              className={commentError ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {commentError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> {commentError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className={
                dialog.action === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {isPending ? "提交中..." : dialog.action === "approve" ? "确认通过" : "确认拒绝"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
