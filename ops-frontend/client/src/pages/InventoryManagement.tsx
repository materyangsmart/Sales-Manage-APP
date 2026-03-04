/**
 * ATP 可承诺产能与库存看板 (RC5 重构)
 * 
 * 路由: /admin/inventory
 * 核心指标:
 * - 物理库存 (Physical Stock)
 * - 待交付量 (Pending Delivery)
 * - 锁定配额 (Locked Capacity)
 * - 剩余闲置产能 (Idle Capacity)
 * - ATP 可承诺量 = 物理库存 + 闲置产能 - 待交付量 - 锁定配额
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Package, AlertTriangle, TrendingUp, ArrowDownUp, Search,
  Warehouse, Truck, Lock, Factory, Zap, Settings2,
  ArrowUp, ArrowDown, History, RefreshCw
} from "lucide-react";

type ViewMode = "dashboard" | "table";

export default function InventoryManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // ATP 编辑 Modal
  const [showATPModal, setShowATPModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editPendingDelivery, setEditPendingDelivery] = useState("");
  const [editLockedCapacity, setEditLockedCapacity] = useState("");
  const [editIdleCapacity, setEditIdleCapacity] = useState("");

  // 库存调整 Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<string>("INBOUND");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustRemark, setAdjustRemark] = useState("");

  // 流水 Modal
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logsProductId, setLogsProductId] = useState<number | undefined>();

  const { data: inventoryData, isLoading } = trpc.inventory.getList.useQuery(
    showLowStockOnly ? { lowStockOnly: true } : {}
  );
  const { data: logs } = trpc.inventory.getLogs.useQuery(
    { productId: logsProductId, limit: 50 },
    { enabled: showLogsModal }
  );

  const adjustMutation = trpc.inventory.adjust.useMutation({
    onSuccess: () => {
      toast.success("库存调整成功");
      setShowAdjustModal(false);
      setAdjustQuantity("");
      setAdjustRemark("");
      utils.inventory.getList.invalidate();
    },
    onError: (err: any) => toast.error(`调整失败: ${err.message}`),
  });

  const updateATPMutation = trpc.inventory.updateATP.useMutation({
    onSuccess: () => {
      toast.success("ATP 参数更新成功");
      setShowATPModal(false);
      utils.inventory.getList.invalidate();
    },
    onError: (err: any) => toast.error(`更新失败: ${err.message}`),
  });

  const items = inventoryData || [];

  const filteredItems = useMemo(() => {
    if (!searchKeyword) return items;
    const kw = searchKeyword.toLowerCase();
    return items.filter((i: any) =>
      i.productName?.toLowerCase().includes(kw) ||
      i.sku?.toLowerCase().includes(kw)
    );
  }, [items, searchKeyword]);

  // 汇总统计
  const summary = useMemo(() => {
    const all = items as any[];
    return {
      totalPhysical: all.reduce((s, i) => s + (i.physicalStock || 0), 0),
      totalPending: all.reduce((s, i) => s + (i.pendingDelivery || 0), 0),
      totalLocked: all.reduce((s, i) => s + (i.lockedCapacity || 0), 0),
      totalIdle: all.reduce((s, i) => s + (i.dailyIdleCapacity || 0), 0),
      totalATP: all.reduce((s, i) => s + (i.atp || 0), 0),
      lowStockCount: all.filter(i => i.isATPCritical).length,
      totalProducts: all.length,
    };
  }, [items]);

  const openATPEdit = (item: any) => {
    setEditingProduct(item);
    setEditPendingDelivery(String(item.pendingDelivery || 0));
    setEditLockedCapacity(String(item.lockedCapacity || 0));
    setEditIdleCapacity(String(item.dailyIdleCapacity || 0));
    setShowATPModal(true);
  };

  const handleATPUpdate = () => {
    if (!editingProduct) return;
    updateATPMutation.mutate({
      productId: editingProduct.productId,
      pendingDelivery: parseInt(editPendingDelivery) || 0,
      lockedCapacity: parseInt(editLockedCapacity) || 0,
      dailyIdleCapacity: parseInt(editIdleCapacity) || 0,
    });
  };

  const openAdjust = (item: any) => {
    setAdjustProduct(item);
    setAdjustType("INBOUND");
    setAdjustQuantity("");
    setAdjustRemark("");
    setShowAdjustModal(true);
  };

  const handleAdjust = () => {
    if (!adjustProduct || !adjustQuantity) return;
    adjustMutation.mutate({
      productId: adjustProduct.productId,
      adjustType: adjustType as any,
      quantity: parseInt(adjustQuantity),
      remark: adjustRemark || undefined,
    });
  };

  const openLogs = (productId?: number) => {
    setLogsProductId(productId);
    setShowLogsModal(true);
  };

  // ATP 进度条颜色
  const getATPColor = (item: any) => {
    if (item.atp <= 0) return "bg-red-500";
    if (item.isATPCritical) return "bg-amber-500";
    return "bg-green-500";
  };

  const getATPBadge = (item: any) => {
    if (item.atp <= 0) return <Badge variant="destructive" className="text-xs">售罄</Badge>;
    if (item.isATPCritical) return <Badge className="bg-amber-500 text-white text-xs">低位</Badge>;
    return <Badge className="bg-green-600 text-white text-xs">充足</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" />
              ATP 可承诺产能与库存看板
            </h1>
            <p className="text-muted-foreground mt-1">
              ATP = 物理库存 + 剩余闲置产能 - 待交付量 - 锁定配额
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "dashboard" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("dashboard")}
            >
              看板视图
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              表格视图
            </Button>
            <Button variant="outline" size="sm" onClick={() => openLogs()}>
              <History className="w-4 h-4 mr-1" />
              全部流水
            </Button>
            <Button variant="outline" size="sm" onClick={() => utils.inventory.getList.invalidate()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ════════ 汇总卡片 ════════ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Warehouse className="w-3.5 h-3.5" />
                物理库存
              </div>
              <div className="text-2xl font-bold text-blue-600">{summary.totalPhysical.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Truck className="w-3.5 h-3.5" />
                待交付量
              </div>
              <div className="text-2xl font-bold text-amber-600">{summary.totalPending.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Lock className="w-3.5 h-3.5" />
                锁定配额
              </div>
              <div className="text-2xl font-bold text-red-600">{summary.totalLocked.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Factory className="w-3.5 h-3.5" />
                闲置产能
              </div>
              <div className="text-2xl font-bold text-purple-600">{summary.totalIdle.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Zap className="w-3.5 h-3.5" />
                ATP 总量
              </div>
              <div className="text-2xl font-bold text-green-600">{summary.totalATP.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${summary.lowStockCount > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                ATP 预警
              </div>
              <div className={`text-2xl font-bold ${summary.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {summary.lowStockCount} / {summary.totalProducts}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 筛选栏 */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索商品名称或 SKU..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showLowStockOnly ? "destructive" : "outline"}
            size="sm"
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            {showLowStockOnly ? "显示全部" : "仅显示预警"}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse h-48 bg-muted rounded-lg" />
            ))}
          </div>
        ) : viewMode === "dashboard" ? (
          /* ════════ 看板视图 ════════ */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item: any) => {
              const maxVal = Math.max(item.physicalStock, item.dailyIdleCapacity, item.pendingDelivery, item.lockedCapacity, 1);
              return (
                <Card key={item.id} className={`relative overflow-hidden ${item.isATPCritical ? 'ring-2 ring-red-300' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">{item.productName}</CardTitle>
                        <CardDescription className="text-xs">{item.sku} · {item.warehouseCode}</CardDescription>
                      </div>
                      {getATPBadge(item)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* ATP 核心指标 */}
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">ATP 可承诺量</div>
                      <div className={`text-3xl font-bold ${item.atp <= 0 ? 'text-red-600' : item.isATPCritical ? 'text-amber-600' : 'text-green-600'}`}>
                        {item.atp.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.unit}</div>
                    </div>

                    {/* 分项指标条形图 */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Warehouse className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="w-16 text-muted-foreground">物理库存</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(item.physicalStock / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-medium">{item.physicalStock}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Factory className="w-3 h-3 text-purple-500 shrink-0" />
                        <span className="w-16 text-muted-foreground">闲置产能</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(item.dailyIdleCapacity / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-medium text-purple-600">+{item.dailyIdleCapacity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="w-16 text-muted-foreground">待交付</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(item.pendingDelivery / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-medium text-amber-600">-{item.pendingDelivery}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="w-16 text-muted-foreground">锁定配额</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${(item.lockedCapacity / maxVal) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-medium text-red-600">-{item.lockedCapacity}</span>
                      </div>
                    </div>

                    {/* ATP 进度条 */}
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>ATP 利用率</span>
                        <span>{item.physicalStock > 0 ? Math.round((item.atp / (item.physicalStock + item.dailyIdleCapacity)) * 100) : 0}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getATPColor(item)}`}
                          style={{ width: `${Math.min(100, Math.max(0, (item.atp / Math.max(1, item.physicalStock + item.dailyIdleCapacity)) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => openATPEdit(item)}>
                        <Settings2 className="w-3 h-3 mr-1" />
                        ATP 参数
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => openAdjust(item)}>
                        <ArrowDownUp className="w-3 h-3 mr-1" />
                        出入库
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => openLogs(item.productId)}>
                        <History className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-16 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>暂无库存数据</p>
              </div>
            )}
          </div>
        ) : (
          /* ════════ 表格视图 ════════ */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">商品</th>
                      <th className="text-right p-3 font-medium">
                        <span className="flex items-center justify-end gap-1"><Warehouse className="w-3 h-3" />物理库存</span>
                      </th>
                      <th className="text-right p-3 font-medium">
                        <span className="flex items-center justify-end gap-1"><Factory className="w-3 h-3" />闲置产能</span>
                      </th>
                      <th className="text-right p-3 font-medium">
                        <span className="flex items-center justify-end gap-1"><Truck className="w-3 h-3" />待交付</span>
                      </th>
                      <th className="text-right p-3 font-medium">
                        <span className="flex items-center justify-end gap-1"><Lock className="w-3 h-3" />锁定配额</span>
                      </th>
                      <th className="text-right p-3 font-medium">
                        <span className="flex items-center justify-end gap-1 text-green-600"><Zap className="w-3 h-3" />ATP</span>
                      </th>
                      <th className="text-center p-3 font-medium">状态</th>
                      <th className="text-center p-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item: any) => (
                      <tr key={item.id} className={`border-b hover:bg-muted/30 ${item.isATPCritical ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                        <td className="p-3">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </td>
                        <td className="p-3 text-right font-medium text-blue-600">{item.physicalStock}</td>
                        <td className="p-3 text-right font-medium text-purple-600">+{item.dailyIdleCapacity}</td>
                        <td className="p-3 text-right font-medium text-amber-600">-{item.pendingDelivery}</td>
                        <td className="p-3 text-right font-medium text-red-600">-{item.lockedCapacity}</td>
                        <td className="p-3 text-right">
                          <span className={`font-bold text-lg ${item.atp <= 0 ? 'text-red-600' : item.isATPCritical ? 'text-amber-600' : 'text-green-600'}`}>
                            {item.atp}
                          </span>
                        </td>
                        <td className="p-3 text-center">{getATPBadge(item)}</td>
                        <td className="p-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openATPEdit(item)}>
                              <Settings2 className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openAdjust(item)}>
                              <ArrowDownUp className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openLogs(item.productId)}>
                              <History className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ════════ ATP 参数编辑 Modal ════════ */}
      <Dialog open={showATPModal} onOpenChange={setShowATPModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              编辑 ATP 参数
            </DialogTitle>
            <DialogDescription>
              {editingProduct?.productName} ({editingProduct?.sku})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <div className="text-xs text-muted-foreground mb-1">当前 ATP 公式</div>
              <div className="font-mono text-xs">
                ATP = {editingProduct?.physicalStock || 0} + <span className="text-purple-600">{editPendingDelivery ? parseInt(editIdleCapacity) || 0 : editingProduct?.dailyIdleCapacity || 0}</span> - <span className="text-amber-600">{parseInt(editPendingDelivery) || 0}</span> - <span className="text-red-600">{parseInt(editLockedCapacity) || 0}</span> = <strong className="text-green-600">
                  {(editingProduct?.physicalStock || 0) + (parseInt(editIdleCapacity) || 0) - (parseInt(editPendingDelivery) || 0) - (parseInt(editLockedCapacity) || 0)}
                </strong>
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-sm">
                <Truck className="w-3.5 h-3.5 text-amber-500" />
                待交付量 (Pending Delivery)
              </Label>
              <Input
                type="number"
                min="0"
                value={editPendingDelivery}
                onChange={e => setEditPendingDelivery(e.target.value)}
                className="mt-1"
                placeholder="已接单但尚未发货的锁定数量"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-sm">
                <Lock className="w-3.5 h-3.5 text-red-500" />
                锁定配额 (Locked Capacity)
              </Label>
              <Input
                type="number"
                min="0"
                value={editLockedCapacity}
                onChange={e => setEditLockedCapacity(e.target.value)}
                className="mt-1"
                placeholder="为核心大客户预留的固定产能"
              />
            </div>
            <div>
              <Label className="flex items-center gap-1.5 text-sm">
                <Factory className="w-3.5 h-3.5 text-purple-500" />
                剩余闲置产能 (Idle Capacity)
              </Label>
              <Input
                type="number"
                min="0"
                value={editIdleCapacity}
                onChange={e => setEditIdleCapacity(e.target.value)}
                className="mt-1"
                placeholder="生产线今天还能额外生产的数量"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowATPModal(false)}>取消</Button>
            <Button onClick={handleATPUpdate} disabled={updateATPMutation.isPending}>
              {updateATPMutation.isPending ? "更新中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ 库存调整 Modal ════════ */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-blue-600" />
              库存调整
            </DialogTitle>
            <DialogDescription>
              {adjustProduct?.productName} · 当前物理库存: {adjustProduct?.physicalStock}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>操作类型</Label>
              <Select value={adjustType} onValueChange={setAdjustType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INBOUND">
                    <span className="flex items-center gap-2"><ArrowUp className="w-3 h-3 text-green-600" />入库</span>
                  </SelectItem>
                  <SelectItem value="OUTBOUND">
                    <span className="flex items-center gap-2"><ArrowDown className="w-3 h-3 text-red-600" />出库</span>
                  </SelectItem>
                  <SelectItem value="ADJUST">
                    <span className="flex items-center gap-2"><RefreshCw className="w-3 h-3 text-blue-600" />盘点调整</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>数量</Label>
              <Input
                type="number"
                min="1"
                value={adjustQuantity}
                onChange={e => setAdjustQuantity(e.target.value)}
                className="mt-1"
                placeholder={adjustType === "ADJUST" ? "盘点后的实际库存数" : "操作数量"}
              />
            </div>
            <div>
              <Label>备注</Label>
              <Input
                value={adjustRemark}
                onChange={e => setAdjustRemark(e.target.value)}
                className="mt-1"
                placeholder="操作原因说明"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustModal(false)}>取消</Button>
            <Button onClick={handleAdjust} disabled={adjustMutation.isPending || !adjustQuantity}>
              {adjustMutation.isPending ? "处理中..." : "确认"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ 出入库流水 Modal ════════ */}
      <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>出入库流水</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2">时间</th>
                  <th className="text-left p-2">类型</th>
                  <th className="text-right p-2">数量</th>
                  <th className="text-right p-2">变更前</th>
                  <th className="text-right p-2">变更后</th>
                  <th className="text-left p-2">操作人</th>
                  <th className="text-left p-2">备注</th>
                </tr>
              </thead>
              <tbody>
                {(logs || []).map((log: any) => (
                  <tr key={log.id} className="border-b">
                    <td className="p-2 text-muted-foreground">{new Date(log.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="p-2">
                      <Badge variant={log.type === 'INBOUND' ? 'default' : log.type === 'RESERVE' ? 'secondary' : 'destructive'}>
                        {log.type === 'INBOUND' ? '入库' : log.type === 'OUTBOUND' ? '出库' : log.type === 'RESERVE' ? '预扣减' : log.type === 'RELEASE' ? '释放' : '调整'}
                      </Badge>
                    </td>
                    <td className={`p-2 text-right font-medium ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {log.quantity > 0 ? '+' : ''}{log.quantity}
                    </td>
                    <td className="p-2 text-right">{log.beforeStock}</td>
                    <td className="p-2 text-right">{log.afterStock}</td>
                    <td className="p-2">{log.operatorName || '-'}</td>
                    <td className="p-2 text-muted-foreground max-w-32 truncate">{log.remark || '-'}</td>
                  </tr>
                ))}
                {(!logs || logs.length === 0) && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">暂无流水记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
