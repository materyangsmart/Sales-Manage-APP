import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { UserPlus, KeyRound, Trash2, Users, RefreshCw } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS, type AppRole } from "@shared/rbac";

/** 可分配的角色列表（创建/编辑用户时使用） */
const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'sales', 'fulfillment', 'finance', 'auditor'];

export default function UserManagement() {
  const utils = trpc.useUtils();
  const { data: userList, isLoading } = trpc.localAuth.listUsers.useQuery();

  // 创建用户 Dialog 状态
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<string>("sales");

  // 重置密码 Dialog 状态
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetUserName, setResetUserName] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // 删除确认 Dialog 状态
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deleteUserName, setDeleteUserName] = useState("");

  // Mutations
  const createUserMutation = trpc.localAuth.createUser.useMutation({
    onSuccess: () => {
      toast.success("用户创建成功");
      setCreateOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewName("");
      setNewEmail("");
      setNewRole("sales");
      utils.localAuth.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.localAuth.updateRole.useMutation({
    onSuccess: () => {
      toast.success("角色更新成功");
      utils.localAuth.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPasswordMutation = trpc.localAuth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密码重置成功");
      setResetOpen(false);
      setResetNewPassword("");
      setResetUserId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUserMutation = trpc.localAuth.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("用户已删除");
      setDeleteOpen(false);
      setDeleteUserId(null);
      utils.localAuth.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateUser = () => {
    if (!newUsername || !newPassword || !newName) {
      toast.error("请填写用户名、密码和姓名");
      return;
    }
    createUserMutation.mutate({
      username: newUsername,
      password: newPassword,
      name: newName,
      email: newEmail || undefined,
      role: newRole as any,
    });
  };

  const handleResetPassword = () => {
    if (!resetUserId || !resetNewPassword) {
      toast.error("请输入新密码");
      return;
    }
    resetPasswordMutation.mutate({
      userId: resetUserId,
      newPassword: resetNewPassword,
    });
  };

  const handleDeleteUser = () => {
    if (!deleteUserId) return;
    deleteUserMutation.mutate({ userId: deleteUserId });
  };

  const handleRoleChange = (userId: number, role: string) => {
    updateRoleMutation.mutate({ userId, role: role as any });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const extractUsername = (openId: string) => {
    return openId.startsWith("local:") ? openId.slice(6) : openId;
  };

  /** 统计各角色人数 */
  const roleCounts = ASSIGNABLE_ROLES.reduce((acc, role) => {
    acc[role] = userList?.filter((u: any) => u.role === role).length ?? 0;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            用户管理
          </h1>
          <p className="text-muted-foreground mt-1">
            管理系统用户账户，分配部门角色、创建新员工账号、重置密码
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => utils.localAuth.listUsers.invalidate()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            刷新
          </Button>

          {/* 创建用户按钮 */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-1" />
                创建新用户
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>创建新用户</DialogTitle>
                <DialogDescription>
                  填写以下信息创建本地登录账号并分配部门角色。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名 *</Label>
                  <Input
                    id="username"
                    placeholder="例如：zhangsan"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">初始密码 *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="至少6位"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input
                    id="name"
                    placeholder="例如：张三"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱（可选）</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="例如：zhangsan@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">所属部门/角色 *</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择角色" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map(role => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${ROLE_COLORS[role]?.split(' ')[0] || 'bg-gray-400'}`} />
                            <span>{ROLE_LABELS[role]}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    角色决定用户可访问的功能模块：销售（订单/提成）、交付（履约/库存）、财务（发票/收款/核销）、审计（日志/雷达）、管理员（全部）
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? "创建中..." : "确认创建"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 统计卡片 - 按角色分布 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-xs">总用户数</CardDescription>
            <CardTitle className="text-2xl">{userList?.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        {ASSIGNABLE_ROLES.map(role => (
          <Card key={role}>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardDescription className="text-xs">{ROLE_LABELS[role]}</CardDescription>
              <CardTitle className="text-2xl">{roleCounts[role] || 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>
            所有已注册的系统用户。管理员可以修改角色、重置密码或删除用户。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : !userList || userList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无用户，请点击右上角"创建新用户"按钮添加
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">ID</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>部门/角色</TableHead>
                    <TableHead>登录方式</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((user: any) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono">{user.id}</TableCell>
                      <TableCell className="font-medium">
                        {extractUsername(user.openId)}
                      </TableCell>
                      <TableCell>{user.name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {user.email || "-"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(v) => handleRoleChange(user.id, v)}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map(role => (
                              <SelectItem key={role} value={role}>
                                <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
                                  {ROLE_LABELS[role]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {user.loginMethod === "local" ? "本地账号" : "OAuth"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {/* 重置密码 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="重置密码"
                            onClick={() => {
                              setResetUserId(user.id);
                              setResetUserName(user.name || extractUsername(user.openId));
                              setResetNewPassword("");
                              setResetOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {/* 删除用户 */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="删除用户"
                            onClick={() => {
                              setDeleteUserId(user.id);
                              setDeleteUserName(user.name || extractUsername(user.openId));
                              setDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 重置密码 Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              重置密码
            </DialogTitle>
            <DialogDescription>
              为用户 <strong>{resetUserName}</strong> 设置新密码。重置后请通知该用户。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少6位"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "重置中..." : "确认重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              确认删除用户
            </DialogTitle>
            <DialogDescription>
              确定要删除用户 <strong>{deleteUserName}</strong> 吗？此操作不可撤销，该用户将无法再登录系统。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
