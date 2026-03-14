import { useParams, Link } from "wouter";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Copy, Package, QrCode, CheckCircle, XCircle, Clock, User, GitBranch, Paperclip, FileText, Image as ImageIcon, Download, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { OrderQRCode } from "@/components/OrderQRCode";
import { UploadAttachment, type UploadedFile } from "@/components/UploadAttachment";

// ─── 附件管理子组件 ──────────────────────────────────────────────────────────

function OrderAttachments({ orderId }: { orderId: number }) {
  const [showUpload, setShowUpload] = useState(false);
  const utils = trpc.useUtils();

  const { data: contracts = [], isLoading: loadingContracts } = trpc.fileStorage.getFileList.useQuery(
    { businessType: 'ORDER_CONTRACT', businessId: orderId },
    { enabled: orderId > 0 }
  );

  const { data: receipts = [], isLoading: loadingReceipts } = trpc.fileStorage.getFileList.useQuery(
    { businessType: 'PAYMENT_RECEIPT', businessId: orderId },
    { enabled: orderId > 0 }
  );

  const deleteFile = trpc.fileStorage.deleteFileRecord.useMutation({
    onSuccess: () => {
      utils.fileStorage.getFileList.invalidate({ businessType: 'ORDER_CONTRACT', businessId: orderId });
      utils.fileStorage.getFileList.invalidate({ businessType: 'PAYMENT_RECEIPT', businessId: orderId });
      toast.success("文件已删除");
    },
    onError: (e) => toast.error(`删除失败：${e.message}`),
  });

  const handleUploadComplete = (_file: UploadedFile) => {
    utils.fileStorage.getFileList.invalidate({ businessType: 'ORDER_CONTRACT', businessId: orderId });
    utils.fileStorage.getFileList.invalidate({ businessType: 'PAYMENT_RECEIPT', businessId: orderId });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
    return <ImageIcon className="h-4 w-4 text-blue-500" />;
  };

  const allFiles = [...contracts, ...receipts];
  const isLoading = loadingContracts || loadingReceipts;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              订单附件
            </CardTitle>
            <CardDescription>合同扫描件、付款水单等业务凭证（PDF/JPG/PNG，最大 20MB）</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpload((v) => !v)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {showUpload ? '收起上传' : '上传附件'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 上传区域（可折叠） */}
        {showUpload && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium mb-2">合同扫描件</p>
              <UploadAttachment
                businessType="ORDER_CONTRACT"
                businessId={orderId}
                onUploadComplete={handleUploadComplete}
                maxFiles={5}
              />
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2">付款水单</p>
              <UploadAttachment
                businessType="PAYMENT_RECEIPT"
                businessId={orderId}
                onUploadComplete={handleUploadComplete}
                maxFiles={5}
              />
            </div>
          </div>
        )}

        {/* 已上传文件列表 */}
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-md" />
            ))}
          </div>
        ) : allFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Paperclip className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">暂无附件，点击「上传附件」添加</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 合同扫描件 */}
            {contracts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                  合同扫描件 ({contracts.length})
                </p>
                {contracts.map((file: any) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onDelete={(id) => deleteFile.mutate({ id })}
                    getFileIcon={getFileIcon}
                    formatSize={formatSize}
                  />
                ))}
              </div>
            )}
            {/* 付款水单 */}
            {receipts.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                  付款水单 ({receipts.length})
                </p>
                {receipts.map((file: any) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onDelete={(id) => deleteFile.mutate({ id })}
                    getFileIcon={getFileIcon}
                    formatSize={formatSize}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FileRow({
  file,
  onDelete,
  getFileIcon,
  formatSize,
}: {
  file: any;
  onDelete: (id: number) => void;
  getFileIcon: (mimeType: string) => React.ReactNode;
  formatSize: (bytes: number) => string;
}) {
  const handleDownload = () => {
    if (file.downloadUrl) {
      window.open(file.downloadUrl, '_blank');
    } else {
      toast.warning("下载链接暂不可用，请刷新后重试");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors">
      {getFileIcon(file.mimeType)}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatSize(file.fileSize)} · {new Date(file.createdAt).toLocaleDateString('zh-CN')}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleDownload}
          title="下载"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(file.id)}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── 主页面组件 ──────────────────────────────────────────────────────────────

export default function OrderDetail() {
  const { id } = useParams();
  const orderId = parseInt(id || "0");

  const { data: order, isLoading } = trpc.orders.get.useQuery({ orderId });

  // 审批流转时间轴
  const { data: workflowInstance } = trpc.workflow.getInstanceByBusiness.useQuery(
    { businessType: 'ORDER', businessId: orderId },
    { enabled: orderId > 0, retry: false }
  );

  const handleCopyTraceLink = () => {
    const traceUrl = `${window.location.origin}/public/trace/${orderId}`;
    navigator.clipboard.writeText(traceUrl);
    toast.success("追溯链接已复制到剪贴板");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">订单不存在</p>
            <div className="flex justify-center mt-4">
              <Link href="/orders/review">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回订单列表
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      PENDING_REVIEW: { label: "待审核", variant: "secondary" },
      APPROVED: { label: "已批准", variant: "default" },
      REJECTED: { label: "已拒绝", variant: "destructive" },
      FULFILLED: { label: "已履行", variant: "outline" },
    };
    const config = statusMap[status] || { label: status, variant: "default" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders/review">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">订单详情</h1>
            <p className="text-sm text-muted-foreground">订单编号：{order.id}</p>
          </div>
        </div>
        {getStatusBadge(order.status)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：订单信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">客户名称</p>
                  <p className="font-medium">{order.customer?.name || "未知客户"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">客户类型</p>
                  <p className="font-medium">
                    {order.customer?.category === "WET_MARKET"
                      ? "菜市场"
                      : order.customer?.category === "SUPERMARKET"
                      ? "商超"
                      : order.customer?.category === "WHOLESALE_B"
                      ? "批发商"
                      : "未知"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">订单日期</p>
                  <p className="font-medium">{new Date(order.orderDate).toLocaleDateString("zh-CN")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">订单金额</p>
                  <p className="font-medium text-lg">¥{order.totalAmount.toLocaleString()}</p>
                </div>
              </div>

              <Separator />

              {/* 批次号 */}
              <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Package className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">生产批次号</p>
                  <p className="font-mono font-bold text-amber-900">{order.batchNo || "未分配"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 订单项列表 */}
          <Card>
            <CardHeader>
              <CardTitle>订单明细</CardTitle>
              <CardDescription>本订单包含的产品清单</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>产品名称</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.product?.name || "未知产品"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">¥{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">¥{item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        暂无订单项
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">
                      总计
                    </TableCell>
                    <TableCell className="text-right font-bold">¥{order.totalAmount.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：质量追溯 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                质量追溯
              </CardTitle>
              <CardDescription>扫描二维码查看产品追溯信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 二维码 */}
              <div className="flex justify-center p-4 bg-white border-2 border-dashed rounded-lg">
                <OrderQRCode orderId={order.id} size={200} />
              </div>

              {/* 追溯链接 */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">追溯链接</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/public/trace/${order.id}`}
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-gray-50"
                  />
                  <Button size="icon" variant="outline" onClick={handleCopyTraceLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* 追溯说明 */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>追溯信息包含：</strong>
                </p>
                <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>原料来源和检验报告</li>
                  <li>生产日期和灭菌参数</li>
                  <li>物流时间和温度记录</li>
                  <li>客户评价和反馈</li>
                </ul>
              </div>

              {/* 查看追溯按钮 */}
              <Link href={`/public/trace/${order.id}`}>
                <Button className="w-full" variant="outline">
                  查看完整追溯信息
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 附件管理区域 */}
      <OrderAttachments orderId={orderId} />

      {/* 审批流转时间轴 */}
      {workflowInstance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> 审批流转记录
            </CardTitle>
            <CardDescription>
              流程：{workflowInstance.definitionName ?? workflowInstance.workflowCode}
              　状态：
              <span className={`font-medium ${
                workflowInstance.status === 'APPROVED' ? 'text-emerald-600' :
                workflowInstance.status === 'REJECTED' ? 'text-red-600' :
                workflowInstance.status === 'RUNNING' ? 'text-blue-600' : 'text-muted-foreground'
              }`}>
                {workflowInstance.status === 'APPROVED' ? '已通过' :
                 workflowInstance.status === 'REJECTED' ? '已拒绝' :
                 workflowInstance.status === 'RUNNING' ? '审批中' :
                 workflowInstance.status === 'PENDING' ? '待审批' : workflowInstance.status}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* 垂直连线 */}
              <div className="absolute left-5 top-6 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {/* 发起节点 */}
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 z-10">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-sm">发起审批</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {workflowInstance.initiatorName ?? '系统'}于{' '}
                      {workflowInstance.createdAt
                        ? new Date(workflowInstance.createdAt).toLocaleString('zh-CN')
                        : '未知时间'}提交审批申请
                    </p>
                  </div>
                </div>

                {/* 审批日志节点 */}
                {(workflowInstance.logs ?? []).map((log: any, idx: number) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      log.action === 'APPROVE' ? 'bg-emerald-100' :
                      log.action === 'REJECT' ? 'bg-red-100' :
                      log.action === 'WITHDRAW' ? 'bg-amber-100' : 'bg-slate-100'
                    }`}>
                      {log.action === 'APPROVE' ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : log.action === 'REJECT' ? (
                        <XCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {log.action === 'APPROVE' ? '审批通过' :
                           log.action === 'REJECT' ? '审批拒绝' :
                           log.action === 'WITHDRAW' ? '撤回申请' : log.action}
                        </p>
                        <span className="text-xs text-muted-foreground">— {log.operatorName ?? '审批人'}</span>
                      </div>
                      {log.comment && (
                        <p className="text-sm text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                          "{log.comment}"
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.nodeName && <span className="mr-2">[{log.nodeName}]</span>}
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : ''}
                      </p>
                    </div>
                  </div>
                ))}

                {/* 当前节点（如果进行中） */}
                {workflowInstance.status === 'RUNNING' && (
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 z-10 animate-pulse">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-amber-700">待审批</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        当前节点：{workflowInstance.currentNodeName ?? '审批中'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
