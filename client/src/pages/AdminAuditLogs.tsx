/**
 * 审计日志看板页面 (/admin/audit-logs)
 *
 * 功能：
 * 1. 分页展示全局操作审计日志（由 AuditLogInterceptor 自动记录）
 * 2. 按操作人 userId、时间段、HTTP 方法、资源类型过滤
 * 3. 展示脱敏后的请求体（password 等字段已替换为 ***）
 * 4. 仅超级管理员可访问
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Search, RefreshCw, Eye, ChevronLeft, ChevronRight } from "lucide-react";

const HTTP_METHOD_COLORS: Record<string, string> = {
  POST: "bg-green-100 text-green-800 border-green-200",
  PUT: "bg-blue-100 text-blue-800 border-blue-200",
  PATCH: "bg-yellow-100 text-yellow-800 border-yellow-200",
  DELETE: "bg-red-100 text-red-800 border-red-200",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  CREATE_FAILED: "bg-red-50 text-red-500",
  UPDATE_FAILED: "bg-orange-50 text-orange-500",
  DELETE_FAILED: "bg-red-50 text-red-500",
};

interface FilterState {
  userId: string;
  startDate: string;
  endDate: string;
  action: string;
  page: number;
  pageSize: number;
}

export default function AdminAuditLogs() {
  const [filters, setFilters] = useState<FilterState>({
    userId: "",
    startDate: "",
    endDate: "",
    action: "",
    page: 1,
    pageSize: 20,
  });
  const [pendingFilters, setPendingFilters] = useState<FilterState>({ ...filters });
  const [detailLog, setDetailLog] = useState<any>(null);

  const queryInput = useMemo(() => ({
    userId: filters.userId ? parseInt(filters.userId) : undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    action: filters.action && filters.action !== "ALL" ? filters.action : undefined,
    page: filters.page,
    pageSize: filters.pageSize,
  }), [filters]);

  const { data, isLoading, refetch } = trpc.auditLogs.list.useQuery(queryInput, {
    refetchOnWindowFocus: false,
  });

  const logs: any[] = (data as any)?.items ?? [];
  const total: number = (data as any)?.total ?? 0;
  const totalPages = Math.ceil(total / filters.pageSize);

  const handleSearch = () => {
    setFilters({ ...pendingFilters, page: 1 });
  };

  const handleReset = () => {
    const reset: FilterState = { userId: "", startDate: "", endDate: "", action: "", page: 1, pageSize: 20 };
    setPendingFilters(reset);
    setFilters(reset);
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Shield className="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">全局操作审计日志</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            自动记录所有 POST / PUT / PATCH / DELETE 请求，敏感字段已脱敏
          </p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </Button>
        </div>
      </div>

      {/* 过滤器 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">操作人 ID</Label>
              <Input
                placeholder="输入用户 ID"
                value={pendingFilters.userId}
                onChange={(e) => setPendingFilters((p) => ({ ...p, userId: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">操作类型</Label>
              <Select
                value={pendingFilters.action}
                onValueChange={(v) => setPendingFilters((p) => ({ ...p, action: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="全部操作" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部操作</SelectItem>
                  <SelectItem value="CREATE">CREATE（创建）</SelectItem>
                  <SelectItem value="UPDATE">UPDATE（修改）</SelectItem>
                  <SelectItem value="DELETE">DELETE（删除）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">开始日期</Label>
              <Input
                type="date"
                value={pendingFilters.startDate}
                onChange={(e) => setPendingFilters((p) => ({ ...p, startDate: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">结束日期</Label>
              <Input
                type="date"
                value={pendingFilters.endDate}
                onChange={(e) => setPendingFilters((p) => ({ ...p, endDate: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleSearch} className="gap-2">
              <Search className="w-4 h-4" />
              查询
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset}>
              重置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 统计摘要 */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>共 <strong className="text-slate-900">{total}</strong> 条审计记录</span>
        <span>第 {filters.page} / {totalPages || 1} 页</span>
      </div>

      {/* 日志表格 */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-16 text-xs">ID</TableHead>
                <TableHead className="w-24 text-xs">HTTP 方法</TableHead>
                <TableHead className="text-xs">API 路径</TableHead>
                <TableHead className="w-20 text-xs">操作类型</TableHead>
                <TableHead className="w-24 text-xs">资源类型</TableHead>
                <TableHead className="w-20 text-xs">操作人 ID</TableHead>
                <TableHead className="w-32 text-xs">IP 地址</TableHead>
                <TableHead className="w-36 text-xs">操作时间</TableHead>
                <TableHead className="w-16 text-xs">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-400">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>暂无审计日志</p>
                    <p className="text-xs mt-1">系统将自动记录所有写操作</p>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-slate-50 text-sm">
                    <TableCell className="font-mono text-xs text-slate-500">{log.id}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${HTTP_METHOD_COLORS[log.httpMethod] ?? "bg-gray-100 text-gray-700"}`}>
                        {log.httpMethod ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-48 truncate" title={log.apiPath}>
                      {log.apiPath ?? log.resourceType ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600"}`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{log.resourceType}</TableCell>
                    <TableCell className="text-xs">
                      {log.userId === 0 ? (
                        <Badge variant="secondary" className="text-xs">系统</Badge>
                      ) : log.userId ? (
                        <span className="font-mono">{log.userId}</span>
                      ) : (
                        <span className="text-slate-400">匿名</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{log.ipAddress ?? "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("zh-CN") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setDetailLog(log)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
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
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1}
            onClick={() => handlePageChange(filters.page - 1)}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </Button>
          <span className="text-sm text-slate-600">
            {filters.page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages}
            onClick={() => handlePageChange(filters.page + 1)}
            className="gap-1"
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 日志详情弹窗 */}
      <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              审计日志详情 #{detailLog?.id}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">HTTP 方法</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${HTTP_METHOD_COLORS[detailLog.httpMethod] ?? "bg-gray-100 text-gray-700"}`}>
                    {detailLog.httpMethod ?? "—"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">操作类型</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[detailLog.action] ?? "bg-slate-100 text-slate-600"}`}>
                    {detailLog.action}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-1">API 路径</p>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{detailLog.apiPath ?? detailLog.resourceType}</code>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">操作人 ID</p>
                  <p className="font-mono">{detailLog.userId ?? "匿名"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">IP 地址</p>
                  <p className="font-mono">{detailLog.ipAddress ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">资源类型</p>
                  <p>{detailLog.resourceType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">资源 ID</p>
                  <p className="font-mono">{detailLog.resourceId}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-1">操作时间</p>
                  <p>{detailLog.createdAt ? new Date(detailLog.createdAt).toLocaleString("zh-CN") : "—"}</p>
                </div>
              </div>

              {detailLog.requestBody && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 font-medium">请求体（敏感字段已脱敏）</p>
                  <pre className="text-xs bg-slate-900 text-green-400 p-3 rounded-lg overflow-auto max-h-48 font-mono">
                    {JSON.stringify(detailLog.requestBody, null, 2)}
                  </pre>
                </div>
              )}

              {detailLog.newValue && (
                <div>
                  <p className="text-xs text-slate-500 mb-1.5 font-medium">变更内容</p>
                  <pre className="text-xs bg-slate-100 p-3 rounded-lg overflow-auto max-h-32 font-mono">
                    {JSON.stringify(detailLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {detailLog.userAgent && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">User Agent</p>
                  <p className="text-xs text-slate-600 break-all">{detailLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
