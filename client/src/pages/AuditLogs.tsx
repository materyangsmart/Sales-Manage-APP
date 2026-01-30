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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Loader2, Filter, GitBranch } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { AuditLog } from "@/lib/types";

export default function AuditLogs() {
  const [showTraceDialog, setShowTraceDialog] = useState(false);
  const [traceResourceType, setTraceResourceType] = useState<string>("");
  const [traceResourceId, setTraceResourceId] = useState<number>(0);
  
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [resourceIdFilter, setResourceIdFilter] = useState<string>("");

  // 使用tRPC查询审计日志
  const { data: logsData, isLoading: loading } = trpc.auditLogs.list.useQuery({
    resourceType: resourceTypeFilter === "ALL" ? undefined : resourceTypeFilter,
    action: actionFilter === "ALL" ? undefined : actionFilter,
    resourceId: resourceIdFilter ? parseInt(resourceIdFilter) : undefined,
    page: 1,
    pageSize: 50,
  });

  // 追踪查询
  const { data: traceData, isLoading: tracing } = trpc.auditLogs.trace.useQuery(
    { resourceType: traceResourceType, resourceId: traceResourceId },
    { enabled: showTraceDialog && !!traceResourceType && !!traceResourceId }
  );

  const logs = logsData?.data || [];
  const traceLogs = traceData || [];

  const handleTrace = (resourceType: string, resourceId: number) => {
    setTraceResourceType(resourceType);
    setTraceResourceId(resourceId);
    setShowTraceDialog(true);
  };



  const resourceTypes = ["ALL", "ORDER", "INVOICE", "PAYMENT"];
  const actions = ["ALL", "CREATE", "REVIEW", "FULFILL", "CREATE_PAYMENT", "APPLY"];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">审计日志</h1>
          <p className="text-muted-foreground mt-2">
            查询系统操作记录，追踪业务流程
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
            <CardDescription>
              按资源类型、操作类型或资源ID筛选日志
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="resourceType">资源类型</Label>
                <Select
                  value={resourceTypeFilter}
                  onValueChange={setResourceTypeFilter}
                >
                  <SelectTrigger id="resourceType">
                    <SelectValue placeholder="选择资源类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {resourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === "ALL" ? "全部类型" : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">操作类型</Label>
                <Select
                  value={actionFilter}
                  onValueChange={setActionFilter}
                >
                  <SelectTrigger id="action">
                    <SelectValue placeholder="选择操作类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {actions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action === "ALL" ? "全部操作" : action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="resourceId">资源ID</Label>
                <Input
                  id="resourceId"
                  type="number"
                  placeholder="输入资源ID"
                  value={resourceIdFilter}
                  onChange={(e) => setResourceIdFilter(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={loadLogs} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  查询
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>审计日志列表</CardTitle>
            <CardDescription>
              显示符合筛选条件的审计记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无审计日志
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>资源类型</TableHead>
                    <TableHead>资源ID</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.resourceType}</TableCell>
                      <TableCell>{log.resourceId}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>{log.userName || `用户${log.userId}`}</TableCell>
                      <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTrace(log.resourceType, log.resourceId)}
                          disabled={tracing}
                        >
                          <GitBranch className="h-4 w-4 mr-1" />
                          追踪
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 追踪对话框 */}
      <Dialog open={showTraceDialog} onOpenChange={setShowTraceDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>审计追踪</DialogTitle>
            <DialogDescription>
              显示该资源的完整操作历史
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {traceLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无追踪记录
              </div>
            ) : (
              <div className="space-y-4">
                {traceLogs.map((log, index) => (
                  <div
                    key={log.id}
                    className="relative border-l-2 border-blue-500 pl-4 pb-4"
                  >
                    {index < traceLogs.length - 1 && (
                      <div className="absolute left-0 top-6 bottom-0 w-0.5 bg-blue-200" />
                    )}
                    <div className="absolute left-[-9px] top-0 h-4 w-4 rounded-full bg-blue-500 border-2 border-white" />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                            {log.action}
                          </span>
                          <span className="text-sm font-medium">
                            {log.resourceType} #{log.resourceId}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        操作人: {log.userName || `用户${log.userId}`}
                      </div>
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="text-sm">
                          <div className="font-medium mb-1">变更内容:</div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
