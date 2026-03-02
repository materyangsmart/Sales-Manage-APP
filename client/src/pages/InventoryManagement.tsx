/**
 * RC4 Epic 1: 库存管理页面 /admin/inventory
 * 
 * 功能：
 * - 库存总览（表格 + 低库存报警）
 * - 入库/出库/盘点调整操作
 * - 出入库流水查看
 */
import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, RotateCcw, History } from 'lucide-react';

export default function InventoryManagement() {
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<'INBOUND' | 'OUTBOUND' | 'ADJUST'>('INBOUND');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustRemark, setAdjustRemark] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const inventoryInput = useMemo(() => ({ lowStockOnly: showLowStockOnly }), [showLowStockOnly]);
  const { data: inventoryList, isLoading, refetch } = trpc.inventory.getList.useQuery(inventoryInput);
  const { data: logs, refetch: refetchLogs } = trpc.inventory.getLogs.useQuery(
    selectedProduct ? { productId: selectedProduct.productId, limit: 30 } : { limit: 50 },
    { enabled: showLogsDialog }
  );

  const adjustMutation = trpc.inventory.adjust.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        refetch();
        setShowAdjustDialog(false);
        setAdjustQty('');
        setAdjustRemark('');
      } else {
        toast.error(result.message);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const lowStockCount = (inventoryList || []).filter((i: any) => i.availableStock <= i.lowStockThreshold).length;
  const totalStock = (inventoryList || []).reduce((sum: number, i: any) => sum + (i.totalStock || 0), 0);
  const totalReserved = (inventoryList || []).reduce((sum: number, i: any) => sum + (i.reservedStock || 0), 0);

  const handleAdjust = () => {
    if (!selectedProduct || !adjustQty) return;
    adjustMutation.mutate({
      productId: selectedProduct.productId,
      adjustType,
      quantity: parseInt(adjustQty),
      remark: adjustRemark || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">库存管理</h1>
            <p className="text-muted-foreground mt-1">智能仓储管理 · 防超卖风控</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showLowStockOnly ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            >
              <AlertTriangle className="w-4 h-4 mr-1" />
              {showLowStockOnly ? '显示全部' : `低库存报警 (${lowStockCount})`}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setSelectedProduct(null); setShowLogsDialog(true); }}>
              <History className="w-4 h-4 mr-1" />
              出入库流水
            </Button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">SKU 总数</p>
                  <p className="text-2xl font-bold">{(inventoryList || []).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><ArrowDownToLine className="w-5 h-5 text-green-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">总库存</p>
                  <p className="text-2xl font-bold">{totalStock.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg"><ArrowUpFromLine className="w-5 h-5 text-orange-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">预扣减锁定</p>
                  <p className="text-2xl font-bold">{totalReserved.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${lowStockCount > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">低库存预警</p>
                  <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-600' : ''}`}>{lowStockCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 库存表格 */}
        <Card>
          <CardHeader>
            <CardTitle>库存明细</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">商品名称</th>
                      <th className="text-left p-3 font-medium">SKU</th>
                      <th className="text-right p-3 font-medium">总库存</th>
                      <th className="text-right p-3 font-medium">预扣减</th>
                      <th className="text-right p-3 font-medium">可用库存</th>
                      <th className="text-right p-3 font-medium">预警阈值</th>
                      <th className="text-center p-3 font-medium">状态</th>
                      <th className="text-center p-3 font-medium">仓库</th>
                      <th className="text-center p-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventoryList || []).map((item: any) => {
                      const isLow = item.availableStock <= item.lowStockThreshold;
                      return (
                        <tr key={item.id} className={`border-b hover:bg-muted/30 ${isLow ? 'bg-red-50' : ''}`}>
                          <td className="p-3 font-medium">{item.productName}</td>
                          <td className="p-3 text-muted-foreground">{item.sku}</td>
                          <td className="p-3 text-right">{item.totalStock}</td>
                          <td className="p-3 text-right text-orange-600">{item.reservedStock}</td>
                          <td className={`p-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>{item.availableStock}</td>
                          <td className="p-3 text-right text-muted-foreground">{item.lowStockThreshold}</td>
                          <td className="p-3 text-center">
                            {isLow ? (
                              <Badge variant="destructive">低库存</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">正常</Badge>
                            )}
                          </td>
                          <td className="p-3 text-center text-muted-foreground">{item.warehouseCode}</td>
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedProduct(item);
                                setAdjustType('INBOUND');
                                setShowAdjustDialog(true);
                              }}>
                                <ArrowDownToLine className="w-3 h-3 mr-1" />入库
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setSelectedProduct(item);
                                setAdjustType('OUTBOUND');
                                setShowAdjustDialog(true);
                              }}>
                                <ArrowUpFromLine className="w-3 h-3 mr-1" />出库
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => {
                                setSelectedProduct(item);
                                setShowLogsDialog(true);
                                refetchLogs();
                              }}>
                                <History className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 库存调整对话框 */}
        <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {adjustType === 'INBOUND' ? '入库' : adjustType === 'OUTBOUND' ? '出库' : '盘点调整'} - {selectedProduct?.productName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">操作类型</label>
                <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INBOUND">入库</SelectItem>
                    <SelectItem value="OUTBOUND">出库</SelectItem>
                    <SelectItem value="ADJUST">盘点调整</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">数量</label>
                <Input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="请输入数量" />
              </div>
              <div>
                <label className="text-sm font-medium">备注</label>
                <Input value={adjustRemark} onChange={(e) => setAdjustRemark(e.target.value)} placeholder="操作备注（可选）" />
              </div>
              {selectedProduct && (
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                  当前库存：总计 {selectedProduct.totalStock} | 预扣减 {selectedProduct.reservedStock} | 可用 {selectedProduct.availableStock}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>取消</Button>
              <Button onClick={handleAdjust} disabled={adjustMutation.isPending || !adjustQty}>
                {adjustMutation.isPending ? '处理中...' : '确认'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 出入库流水对话框 */}
        <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                出入库流水 {selectedProduct ? `- ${selectedProduct.productName}` : '（全部）'}
              </DialogTitle>
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
      </div>
    </DashboardLayout>
  );
}
