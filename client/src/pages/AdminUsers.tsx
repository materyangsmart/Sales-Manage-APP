import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Users, Building2, Shield, Search, UserCog } from "lucide-react";

// 递归渲染组织树节点
function OrgTreeNode({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: any;
  selectedId: number | null;
  onSelect: (id: number, name: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm hover:bg-accent ${selectedId === node.id ? "bg-primary/10 text-primary font-medium" : ""}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(node.id, node.name)}
      >
        {hasChildren && (
          <span
            className="text-muted-foreground w-4 text-center"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child: any) => (
            <OrgTreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedOrgName, setSelectedOrgName] = useState<string>("全部");

  // 分配角色对话框
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  // 分配部门对话框
  const [orgDialog, setOrgDialog] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });
  const [orgPickId, setOrgPickId] = useState<number | null>(null);
  const [orgPickName, setOrgPickName] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: orgTree = [], isLoading: orgLoading } = trpc.rbac.getOrgTree.useQuery();
  const { data: rolesData = [], isLoading: rolesLoading } = trpc.rbac.getRoles.useQuery();
  const { data: usersData, isLoading: usersLoading } = trpc.rbac.getUsers.useQuery(
    selectedOrgId ? { orgId: selectedOrgId, pageSize: 100 } : { pageSize: 100 }
  );

  const assignRoleMut = trpc.rbac.assignRole.useMutation({
    onSuccess: () => {
      toast.success("角色分配成功");
      utils.rbac.getUsers.invalidate();
      setAssignDialog({ open: false, user: null });
      setSelectedRoleId("");
    },
    onError: (e) => toast.error(`分配失败：${e.message}`),
  });

  const removeRoleMut = trpc.rbac.removeUserRole.useMutation({
    onSuccess: () => {
      toast.success("角色已移除");
      utils.rbac.getUsers.invalidate();
    },
    onError: (e) => toast.error(`移除失败：${e.message}`),
  });

  const updateOrgMut = trpc.rbac.updateUserOrg.useMutation({
    onSuccess: () => {
      toast.success("部门分配成功");
      utils.rbac.getUsers.invalidate();
      setOrgDialog({ open: false, user: null });
    },
    onError: (e) => toast.error(`分配失败：${e.message}`),
  });

  const users = usersData?.items ?? [];
  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u: any) =>
        u.username?.toLowerCase().includes(q) ||
        u.realName?.toLowerCase().includes(q) ||
        u.orgName?.toLowerCase().includes(q)
    );
  }, [users, search]);

  return (
    <div className="flex h-full gap-4 p-6">
      {/* 左侧：组织树 */}
      <Card className="w-64 shrink-0 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4" /> 组织架构
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-2">
          {orgLoading ? (
            <div className="text-xs text-muted-foreground p-2">加载中...</div>
          ) : (
            <>
              <div
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-sm hover:bg-accent mb-1 ${!selectedOrgId ? "bg-primary/10 text-primary font-medium" : ""}`}
                onClick={() => { setSelectedOrgId(null); setSelectedOrgName("全部"); }}
              >
                <Users className="h-3.5 w-3.5" /> 全部人员
              </div>
              {orgTree.map((node: any) => (
                <OrgTreeNode
                  key={node.id}
                  node={node}
                  selectedId={selectedOrgId}
                  onSelect={(id, name) => { setSelectedOrgId(id); setSelectedOrgName(name); }}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* 右侧：用户列表 */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <UserCog className="h-5 w-5" /> 用户管理
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              当前部门：<span className="font-medium">{selectedOrgName}</span>
              {usersData && <span className="ml-2">共 {usersData.total} 人</span>}
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索姓名/用户名/部门..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Card className="flex-1">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>所属部门</TableHead>
                  <TableHead>岗位</TableHead>
                  <TableHead>当前角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      暂无用户数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.realName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{user.username}</TableCell>
                      <TableCell>
                        <span className="text-sm">{user.orgName || <span className="text-muted-foreground">未分配</span>}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.jobPosition || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles?.length > 0 ? (
                            user.roles.map((r: any) => (
                              <Badge
                                key={r.id}
                                variant="secondary"
                                className="cursor-pointer hover:bg-destructive/20 text-xs"
                                onClick={() => removeRoleMut.mutate({ userId: user.id, roleId: r.id })}
                                title="点击移除此角色"
                              >
                                {r.name} ✕
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">无角色</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>
                          {user.status === "ACTIVE" ? "在职" : "离职"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setOrgDialog({ open: true, user });
                              setOrgPickId(user.orgId ?? null);
                              setOrgPickName(user.orgName ?? "");
                            }}
                          >
                            <Building2 className="h-3.5 w-3.5 mr-1" /> 分配部门
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssignDialog({ open: true, user });
                              setSelectedRoleId("");
                            }}
                          >
                            <Shield className="h-3.5 w-3.5 mr-1" /> 分配角色
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
      </div>

      {/* 分配角色对话框 */}
      <Dialog open={assignDialog.open} onOpenChange={(v) => setAssignDialog({ open: v, user: assignDialog.user })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>为「{assignDialog.user?.realName}」分配角色</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择角色..." />
              </SelectTrigger>
              <SelectContent>
                {rolesData.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                    <span className="ml-2 text-xs text-muted-foreground">({r.dataScope})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, user: null })}>取消</Button>
            <Button
              disabled={!selectedRoleId || assignRoleMut.isPending}
              onClick={() => {
                if (!assignDialog.user || !selectedRoleId) return;
                assignRoleMut.mutate({ userId: assignDialog.user.id, roleId: parseInt(selectedRoleId) });
              }}
            >
              {assignRoleMut.isPending ? "分配中..." : "确认分配"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 分配部门对话框 */}
      <Dialog open={orgDialog.open} onOpenChange={(v) => setOrgDialog({ open: v, user: orgDialog.user })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>为「{orgDialog.user?.realName}」分配部门</DialogTitle>
          </DialogHeader>
          <div className="py-2 max-h-72 overflow-auto border rounded-md">
            {orgTree.map((node: any) => (
              <OrgTreeNode
                key={node.id}
                node={node}
                selectedId={orgPickId}
                onSelect={(id, name) => { setOrgPickId(id); setOrgPickName(name); }}
              />
            ))}
          </div>
          {orgPickId && (
            <p className="text-sm text-muted-foreground">
              已选择：<span className="font-medium text-foreground">{orgPickName}</span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgDialog({ open: false, user: null })}>取消</Button>
            <Button
              disabled={!orgPickId || updateOrgMut.isPending}
              onClick={() => {
                if (!orgDialog.user || !orgPickId) return;
                updateOrgMut.mutate({ userId: orgDialog.user.id, orgId: orgPickId });
              }}
            >
              {updateOrgMut.isPending ? "分配中..." : "确认分配"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
