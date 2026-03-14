import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Edit, Trash2, UserPlus } from "lucide-react";
// import { useToast } from "@/hooks/use-toast";

export default function EmployeeManagement() {
  // const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedJobPosition, setSelectedJobPosition] = useState<string>("");
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone: "",
    department: "",
    job_position_id: "",
  });

  // 查询员工列表
  const { data: employees, isLoading, refetch } = trpc.employee.list.useQuery();
  
  // 查询职位模板列表
  const { data: jobPositions } = trpc.employee.getJobPositions.useQuery();

  // 创建员工
  const createMutation = trpc.employee.create.useMutation({
    onSuccess: () => {
      alert("创建成功：员工账号已创建，权限已自动关联");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      alert(`创建失败：${error.message}`);
    },
  });

  // 删除员工
  const deleteMutation = trpc.employee.delete.useMutation({
    onSuccess: () => {
      alert("删除成功：员工账号已删除");
      refetch();
    },
    onError: (error) => {
      alert(`删除失败：${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      username: "",
      email: "",
      password: "",
      full_name: "",
      phone: "",
      department: "",
      job_position_id: "",
    });
    setSelectedJobPosition("");
  };

  const handleCreate = () => {
    if (!formData.username || !formData.email || !formData.password || !formData.job_position_id) {
      alert("表单验证失败：请填写所有必填字段");
      return;
    }

    createMutation.mutate(formData);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这个员工账号吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleJobPositionChange = (jobPositionId: string) => {
    setSelectedJobPosition(jobPositionId);
    setFormData({ ...formData, job_position_id: jobPositionId });
    
    // 自动填充部门信息
    const position = jobPositions?.find((p) => p.id.toString() === jobPositionId);
    if (position) {
      setFormData((prev) => ({
        ...prev,
        department: position.department,
        job_position_id: jobPositionId,
      }));
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "CEO":
        return "destructive";
      case "SALES_DIRECTOR":
        return "default";
      case "FINANCE_MANAGER":
        return "secondary";
      case "SALES":
        return "outline";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">员工管理</CardTitle>
              <CardDescription>管理员工账号和权限分配</CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              新增员工
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>职位</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees?.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>{employee.id}</TableCell>
                  <TableCell className="font-medium">{employee.username}</TableCell>
                  <TableCell>{employee.full_name || "-"}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.department || "-"}</TableCell>
                  <TableCell>{employee.job_position?.position_name || "-"}</TableCell>
                  <TableCell>
                    {employee.roles?.map((role: any) => (
                      <Badge key={role.id} variant={getRoleBadgeVariant(role.code)} className="mr-1">
                        {role.name}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.status === "ACTIVE" ? "default" : "secondary"}>
                      {employee.status === "ACTIVE" ? "激活" : "禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" disabled>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(employee.id)}
                        disabled={employee.username === "admin"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 创建员工对话框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>新增员工</DialogTitle>
            <DialogDescription>
              选择职位后，系统将自动关联对应的角色和权限
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">用户名 *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="登录用户名"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="full_name">姓名</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="员工真实姓名"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">邮箱 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">手机号</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="手机号码"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">密码 *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="初始密码"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="job_position">职位模板 *</Label>
              <Select value={selectedJobPosition} onValueChange={handleJobPositionChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择职位（自动关联权限）" />
                </SelectTrigger>
                <SelectContent>
                  {jobPositions?.map((position: any) => (
                    <SelectItem key={position.id} value={position.id.toString()}>
                      {position.department} - {position.position_name}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({position.role?.name})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedJobPosition && (
              <div className="rounded-lg border p-4 bg-muted/50">
                <h4 className="text-sm font-medium mb-2">权限预览</h4>
                <div className="text-sm text-muted-foreground">
                  {(() => {
                    const position = jobPositions?.find((p: any) => p.id.toString() === selectedJobPosition);
                    return position?.role?.permissions?.map((perm: any) => (
                      <Badge key={perm.id} variant="outline" className="mr-1 mb-1">
                        {perm.name}
                      </Badge>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建账号"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
