/**
 * 客户管理页面 (Customer Management)
 * MS14 - 完整 CRUD + 客户类型编号自动生成 + 字段级权限隔离
 *
 * 功能：
 * 1. 客户列表（搜索、分页、类型过滤）
 * 2. 新建客户（销售可调用，不含财务字段）
 * 3. 编辑客户基本信息
 * 4. 编辑客户财务信息（仅 admin/finance）
 * 5. 停用客户
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Search, Edit, DollarSign, Ban, Building2, User, Phone, MapPin,
  ChevronLeft, ChevronRight, Users, Filter
} from "lucide-react";

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const CUSTOMER_TYPE_OPTIONS = [
  { value: "ENTERPRISE", label: "企业", prefix: "ENT" },
  { value: "INDIVIDUAL", label: "个人", prefix: "IND" },
  { value: "CHANNEL", label: "渠道", prefix: "CH" },
  { value: "RESTAURANT", label: "餐饮", prefix: "RST" },
  { value: "WHOLESALE", label: "批发", prefix: "WS" },
  { value: "RETAIL", label: "零售", prefix: "RT" },
  { value: "FACTORY", label: "加工厂", prefix: "FAC" },
  { value: "OTHER", label: "其他", prefix: "OTH" },
];

const TYPE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CUSTOMER_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

const TYPE_COLOR_MAP: Record<string, string> = {
  ENTERPRISE: "bg-blue-100 text-blue-700",
  INDIVIDUAL: "bg-green-100 text-green-700",
  CHANNEL: "bg-purple-100 text-purple-700",
  RESTAURANT: "bg-orange-100 text-orange-700",
  WHOLESALE: "bg-indigo-100 text-indigo-700",
  RETAIL: "bg-teal-100 text-teal-700",
  FACTORY: "bg-amber-100 text-amber-700",
  OTHER: "bg-gray-100 text-gray-700",
};

// ─── 新建客户表单 ──────────────────────────────────────────────────────────────

function CreateCustomerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: "",
    customerType: "ENTERPRISE" as string,
    contactName: "",
    contactPhone: "",
    address: "",
    remark: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = trpc.customerMgmt.create.useMutation({
    onSuccess: (data) => {
      toast.success(`客户创建成功！编号: ${data.customerCode}`);
      utils.customerMgmt.list.invalidate();
      onOpenChange(false);
      setForm({ name: "", customerType: "ENTERPRISE", contactName: "", contactPhone: "", address: "", remark: "" });
      setErrors({});
    },
    onError: (err) => {
      toast.error(err.message || "创建失败");
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "请输入客户名称";
    if (form.name.trim().length > 0 && form.name.trim().length < 2) errs.name = "客户名称至少2个字符";
    if (!form.contactPhone.trim()) errs.contactPhone = "请输入联系电话";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createMutation.mutate({
      name: form.name.trim(),
      customerType: form.customerType as any,
      contactName: form.contactName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      address: form.address.trim() || undefined,
      remark: form.remark.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> 新建客户
          </DialogTitle>
          <DialogDescription>
            填写客户基本信息，系统将根据客户类型自动生成编号
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 客户类型 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              客户类型 <span className="text-red-500">*</span>
            </Label>
            <Select value={form.customerType} onValueChange={(v) => setForm((f) => ({ ...f, customerType: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}（编号前缀: {opt.prefix}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 客户名称 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">
              客户名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="请输入客户名称"
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setErrors((e2) => ({ ...e2, name: "" })); }}
              className={errors.name ? "border-red-400" : ""}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 联系人 + 电话 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">联系人</Label>
              <Input
                placeholder="联系人姓名"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">
                联系电话 <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="请输入联系电话"
                value={form.contactPhone}
                onChange={(e) => { setForm((f) => ({ ...f, contactPhone: e.target.value })); setErrors((e2) => ({ ...e2, contactPhone: "" })); }}
                className={errors.contactPhone ? "border-red-400" : ""}
              />
              {errors.contactPhone && <p className="text-xs text-red-500">{errors.contactPhone}</p>}
            </div>
          </div>

          {/* 地址 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">地址</Label>
            <Input
              placeholder="客户地址"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>

          {/* 备注 */}
          <div className="space-y-1">
            <Label className="text-sm font-medium">备注</Label>
            <Textarea
              placeholder="备注信息"
              value={form.remark}
              onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
            <strong>提示：</strong>信用额度和折扣率由管理员或财务人员在客户创建后单独设置。
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? "创建中..." : "确认创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 编辑客户基本信息 ──────────────────────────────────────────────────────────

function EditBasicDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: customer?.name || "",
    contactName: customer?.contactName || "",
    contactPhone: customer?.contactPhone || "",
    address: customer?.address || "",
    remark: customer?.remark || "",
  });

  const updateMutation = trpc.customerMgmt.updateBasic.useMutation({
    onSuccess: () => {
      toast.success("客户信息更新成功");
      utils.customerMgmt.list.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message || "更新失败"),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("客户名称不能为空");
      return;
    }
    updateMutation.mutate({
      id: customer.id,
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      address: form.address.trim() || undefined,
      remark: form.remark.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" /> 编辑客户信息
          </DialogTitle>
          <DialogDescription>
            编号: {customer?.customerCode} · 类型: {TYPE_LABEL_MAP[customer?.customerType] || customer?.customerType}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>客户名称 <span className="text-red-500">*</span></Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>联系人</Label>
              <Input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>联系电话</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>地址</Label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>备注</Label>
            <Textarea value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 编辑客户财务信息（仅 admin/finance） ──────────────────────────────────────

function EditFinanceDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [creditLimit, setCreditLimit] = useState(String(customer?.creditLimit || "0"));
  const [discountRate, setDiscountRate] = useState(String(customer?.discountRate || "1"));

  const updateMutation = trpc.customerMgmt.updateFinance.useMutation({
    onSuccess: () => {
      toast.success("财务信息更新成功");
      utils.customerMgmt.list.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message || "更新失败"),
  });

  const handleSubmit = () => {
    const cl = Number(creditLimit);
    const dr = Number(discountRate);
    if (isNaN(cl) || cl < 0) {
      toast.error("请输入有效的信用额度");
      return;
    }
    if (isNaN(dr) || dr < 0 || dr > 1) {
      toast.error("折扣率必须在 0~1 之间（如 0.95 表示 95 折）");
      return;
    }
    updateMutation.mutate({
      id: customer.id,
      creditLimit: cl,
      discountRate: dr,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> 设置财务信息
          </DialogTitle>
          <DialogDescription>
            {customer?.customerCode} · {customer?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>信用额度（元）</Label>
            <Input
              type="number"
              placeholder="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">当前已用: ¥{Number(customer?.usedCredit || 0).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <Label>折扣率</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              placeholder="1.0000"
              value={discountRate}
              onChange={(e) => setDiscountRate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              输入 0~1 之间的数值，如 0.95 表示 95 折，1 表示不打折
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────

export default function CustomerManagement() {
  const { user } = useAuth();
  const isAdminOrFinance = user?.role === "admin" || user?.role === "finance";

  // 搜索 & 过滤
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const { data, isLoading } = trpc.customerMgmt.list.useQuery({
    keyword: keyword || undefined,
    customerType: typeFilter !== "ALL" ? typeFilter : undefined,
    status: "ACTIVE",
    page,
    pageSize,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Modal 状态
  const [showCreate, setShowCreate] = useState(false);
  const [editBasicCustomer, setEditBasicCustomer] = useState<any>(null);
  const [editFinanceCustomer, setEditFinanceCustomer] = useState<any>(null);

  // 停用
  const utils = trpc.useUtils();
  const deactivateMutation = trpc.customerMgmt.deactivate.useMutation({
    onSuccess: () => {
      toast.success("客户已停用");
      utils.customerMgmt.list.invalidate();
    },
    onError: (err: any) => toast.error(err.message || "操作失败"),
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" /> 客户管理
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              管理所有客户信息，支持按类型自动生成编号
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="h-4 w-4" /> 新建客户
          </Button>
        </div>

        {/* 搜索 & 过滤 */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索客户名称、编号或电话..."
                  className="pl-9"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">全部类型</SelectItem>
                  {CUSTOMER_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 统计摘要 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{total}</p>
              <p className="text-xs text-muted-foreground">客户总数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">
                {items.filter((c: any) => c.customerType === "ENTERPRISE").length}
              </p>
              <p className="text-xs text-muted-foreground">企业客户</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">
                {items.filter((c: any) => c.customerType === "CHANNEL").length}
              </p>
              <p className="text-xs text-muted-foreground">渠道客户</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">
                {items.filter((c: any) => c.customerType === "INDIVIDUAL").length}
              </p>
              <p className="text-xs text-muted-foreground">个人客户</p>
            </CardContent>
          </Card>
        </div>

        {/* 客户列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">客户列表</CardTitle>
            <CardDescription>共 {total} 条记录，第 {page}/{totalPages} 页</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">加载中...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>暂无客户数据</p>
                <Button variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 新建第一个客户
                </Button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">客户编号</TableHead>
                        <TableHead>客户名称</TableHead>
                        <TableHead className="w-[80px]">类型</TableHead>
                        <TableHead>联系人</TableHead>
                        <TableHead>联系电话</TableHead>
                        {isAdminOrFinance && <TableHead className="text-right">信用额度</TableHead>}
                        {isAdminOrFinance && <TableHead className="text-right">折扣率</TableHead>}
                        <TableHead className="text-right w-[200px]">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">{c.customerCode}</TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={TYPE_COLOR_MAP[c.customerType] || ""}>
                              {TYPE_LABEL_MAP[c.customerType] || c.customerType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.contactName || "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{c.contactPhone || "-"}</TableCell>
                          {isAdminOrFinance && (
                            <TableCell className="text-right font-mono">
                              ¥{Number(c.creditLimit || 0).toLocaleString()}
                            </TableCell>
                          )}
                          {isAdminOrFinance && (
                            <TableCell className="text-right">
                              {Number(c.discountRate || 1) < 1
                                ? `${(Number(c.discountRate) * 100).toFixed(0)}折`
                                : "无折扣"}
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditBasicCustomer(c)}
                                title="编辑基本信息"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              {isAdminOrFinance && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditFinanceCustomer(c)}
                                  title="设置财务信息"
                                  className="text-amber-600 hover:text-amber-700"
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {user?.role === "admin" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(`确定要停用客户 ${c.name}（${c.customerCode}）吗？`)) {
                                      deactivateMutation.mutate({ id: c.id });
                                    }
                                  }}
                                  title="停用客户"
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 分页 */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    共 {total} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">{page} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <CreateCustomerDialog open={showCreate} onOpenChange={setShowCreate} />
      {editBasicCustomer && (
        <EditBasicDialog
          customer={editBasicCustomer}
          open={!!editBasicCustomer}
          onOpenChange={(v) => { if (!v) setEditBasicCustomer(null); }}
        />
      )}
      {editFinanceCustomer && (
        <EditFinanceDialog
          customer={editFinanceCustomer}
          open={!!editFinanceCustomer}
          onOpenChange={(v) => { if (!v) setEditFinanceCustomer(null); }}
        />
      )}
    </DashboardLayout>
  );
}
