/**
 * 代客下单页面 (RC5 UX 重构)
 * 
 * 路由: /orders/create
 * 重构内容:
 * - 快捷新建客户 Modal（不中断下单心流）
 * - InputNumber 直输替代 +/- 按钮
 * - 合规支付方式（移除现金，仅 CREDIT/BANK_TRANSFER/ONLINE_PAYMENT）
 * - 动态物流表单引擎（DELIVERY/EXPRESS 展开收货信息，SELF_PICKUP 显示工厂地址）
 */
import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Trash2, Send, UserCheck, Package, Search, CheckCircle,
  UserPlus, Building2, Phone, MapPin, Truck, PackageCheck,
  CreditCard, Landmark, Smartphone, FileSpreadsheet
} from "lucide-react";

interface OrderItem {
  productId: number;
  name: string;
  specification: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  minOrderQuantity: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  THIN: "薄千张",
  MEDIUM: "中厚千张",
  THICK: "厚千张",
};

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "餐饮客户",
  WHOLESALE: "批发商",
  RETAIL: "零售商",
  FACTORY: "加工厂",
  OTHER: "其他",
};

const PAYMENT_OPTIONS = [
  { value: "CREDIT", label: "账期/信用额度", icon: CreditCard, desc: "月结对账，按信用额度扣减" },
  { value: "BANK_TRANSFER", label: "对公转账", icon: Landmark, desc: "银行对公账户转账" },
  { value: "ONLINE_PAYMENT", label: "线上支付", icon: Smartphone, desc: "微信/支付宝线上支付" },
] as const;

const DELIVERY_OPTIONS = [
  { value: "DELIVERY", label: "送货上门", icon: Truck, needAddress: true },
  { value: "EXPRESS", label: "快递配送", icon: PackageCheck, needAddress: true },
  { value: "SELF_PICKUP", label: "客户自提", icon: Building2, needAddress: false },
] as const;

// 工厂自提地址
const FACTORY_PICKUP_INFO = {
  address: "安徽省六安市裕安区苏埠镇千张产业园 3 号厂房",
  contact: "王师傅",
  phone: "138-0564-XXXX",
  hours: "周一至周六 06:00-18:00",
};

export default function SalesCreateOrder() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ── 核心状态 ──
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discountRate, setDiscountRate] = useState<string>("");
  const [remark, setRemark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CREDIT");
  const [deliveryType, setDeliveryType] = useState<string>("DELIVERY");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState("");

  // ── 物流信息状态 ──
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");

  // ── 快捷新建客户 Modal 状态 ──
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerType, setNewCustomerType] = useState<string>("RESTAURANT");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // ── 批量导入 Modal ──
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState("");

  // ── API 调用 ──
  const { data: customersData, isLoading: customersLoading } = trpc.salesOrder.getCustomers.useQuery({ orgId: 1 });
  const { data: productsData, isLoading: productsLoading } = trpc.portal.getProducts.useQuery({});

  const createOrder = trpc.salesOrder.createForCustomer.useMutation({
    onSuccess: (data: any) => {
      setOrderSubmitted(true);
      setSubmittedOrderNo(data.orderNo || `ORD-${Date.now()}`);
      setOrderItems([]);
      setSelectedCustomerId(null);
      setDiscountRate("");
      setRemark("");
      setReceiverName("");
      setReceiverPhone("");
      setReceiverAddress("");
      toast.success("订单创建成功，已提交审核！");
    },
    onError: (err: any) => {
      toast.error(`创建失败: ${err.message}`);
    },
  });

  const createCustomer = trpc.salesOrder.createCustomer.useMutation({
    onSuccess: (data: any) => {
      toast.success(`客户 "${data.name || newCustomerName}" 创建成功`);
      setSelectedCustomerId(data.id);
      setShowNewCustomerModal(false);
      setNewCustomerName("");
      setNewCustomerType("RESTAURANT");
      setNewContactName("");
      setNewContactPhone("");
      setNewAddress("");
      utils.salesOrder.getCustomers.invalidate();
    },
    onError: (err: any) => {
      toast.error(`创建客户失败: ${err.message}`);
    },
  });

  const customers = customersData?.data || [];
  const products = productsData?.items || [];
  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);

  const filteredProducts = useMemo(() => {
    if (!searchKeyword) return products;
    const kw = searchKeyword.toLowerCase();
    return products.filter((p: any) =>
      p.name.toLowerCase().includes(kw) ||
      p.specification.toLowerCase().includes(kw) ||
      (CATEGORY_LABELS[p.category] || "").includes(kw)
    );
  }, [products, searchKeyword]);

  // ── 商品操作 ──
  const addItem = useCallback((product: any) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        toast.info(`${product.name} 已在订单中，请直接修改数量`);
        return prev;
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        specification: product.specification,
        unitPrice: product.unitPrice,
        unit: product.unit,
        quantity: product.minOrderQuantity || 1,
        minOrderQuantity: product.minOrderQuantity || 1,
      }];
    });
  }, []);

  const updateItemQuantity = useCallback((productId: number, newQty: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const qty = Math.max(1, isNaN(newQty) ? 1 : newQty);
        return { ...item, quantity: qty };
      }
      return item;
    }));
  }, []);

  const removeItem = useCallback((productId: number) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  }, []);

  // ── 批量导入 ──
  const handleBatchImport = useCallback(() => {
    if (!batchImportText.trim()) {
      toast.error("请输入批量导入数据");
      return;
    }
    const lines = batchImportText.trim().split("\n");
    let imported = 0;
    for (const line of lines) {
      const parts = line.split(/[,\t，]/).map(s => s.trim());
      if (parts.length < 2) continue;
      const [nameOrId, qtyStr] = parts;
      const qty = parseInt(qtyStr);
      if (isNaN(qty) || qty <= 0) continue;

      const product = products.find((p: any) =>
        p.name === nameOrId || p.id.toString() === nameOrId
      );
      if (product) {
        setOrderItems(prev => {
          const existing = prev.find(item => item.productId === product.id);
          if (existing) {
            return prev.map(item =>
              item.productId === product.id ? { ...item, quantity: qty } : item
            );
          }
          return [...prev, {
            productId: product.id,
            name: product.name,
            specification: product.specification,
            unitPrice: product.unitPrice,
            unit: product.unit,
            quantity: qty,
            minOrderQuantity: product.minOrderQuantity || 1,
          }];
        });
        imported++;
      }
    }
    toast.success(`批量导入完成：${imported} 个商品`);
    setShowBatchImport(false);
    setBatchImportText("");
  }, [batchImportText, products]);

  // ── 金额计算 ──
  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = discountRate ? subtotal * (parseFloat(discountRate) / 100) : 0;
  const total = subtotal - discount;

  const needsShippingAddress = deliveryType === "DELIVERY" || deliveryType === "EXPRESS";

  // ── 提交 ──
  const handleSubmit = () => {
    if (!selectedCustomerId) {
      toast.error("请选择客户");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("请添加商品");
      return;
    }
    if (needsShippingAddress) {
      if (!receiverName.trim()) { toast.error("请填写收货人姓名"); return; }
      if (!receiverPhone.trim()) { toast.error("请填写联系电话"); return; }
      if (!receiverAddress.trim()) { toast.error("请填写详细地址"); return; }
    }
    createOrder.mutate({
      customerId: selectedCustomerId,
      items: orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      discountRate: discountRate ? parseFloat(discountRate) : undefined,
      remark: remark || undefined,
      paymentMethod: paymentMethod as any,
      deliveryType: deliveryType as any,
      receiverName: needsShippingAddress ? receiverName : undefined,
      receiverPhone: needsShippingAddress ? receiverPhone : undefined,
      receiverAddress: needsShippingAddress ? receiverAddress : undefined,
    });
  };

  // ── 新建客户 ──
  const handleCreateCustomer = () => {
    if (!newCustomerName.trim()) {
      toast.error("请输入客户名称");
      return;
    }
    createCustomer.mutate({
      name: newCustomerName.trim(),
      customerType: newCustomerType as any,
      contactName: newContactName || undefined,
      contactPhone: newContactPhone || undefined,
      address: newAddress || undefined,
    });
  };

  // ── 订单成功页 ──
  if (orderSubmitted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md text-center">
            <CardHeader>
              <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-2" />
              <CardTitle>订单创建成功</CardTitle>
              <CardDescription>订单号: {submittedOrderNo}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">订单已提交审核，审核通过后将进入履约流程。</p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setOrderSubmitted(false)}>
                  继续下单
                </Button>
                <Button onClick={() => window.location.href = "/orders/review"}>
                  查看订单
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">代客下单</h1>
          <p className="text-muted-foreground mt-1">为客户创建订单，提交后进入审核流程</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ════════ 左侧：客户选择 + 商品选择 ════════ */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── Step 1: 选择客户 ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  第一步：选择客户
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1">
                    {customersLoading ? (
                      <div className="animate-pulse h-10 bg-muted rounded" />
                    ) : (
                      <Select
                        value={selectedCustomerId?.toString() || ""}
                        onValueChange={v => setSelectedCustomerId(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择客户..." />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((c: any) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {c.name || c.customerName} ({c.customerCode || `ID:${c.id}`})
                              {c.category && <span className="ml-2 text-xs text-muted-foreground">[{c.category}]</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {/* 快捷新建客户按钮 */}
                  <Button
                    variant="outline"
                    className="shrink-0 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => setShowNewCustomerModal(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    新建客户
                  </Button>
                </div>
                {selectedCustomer && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm border border-blue-100 dark:border-blue-900">
                    <div className="grid grid-cols-3 gap-2">
                      <div><span className="text-muted-foreground">客户：</span><strong>{selectedCustomer.name || selectedCustomer.customerName}</strong></div>
                      <div><span className="text-muted-foreground">类型：</span>{selectedCustomer.category || "N/A"}</div>
                      <div><span className="text-muted-foreground">状态：</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">{selectedCustomer.status || "ACTIVE"}</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Step 2: 选择商品 ── */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    第二步：选择商品
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBatchImport(true)}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                    批量导入
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索商品名称、规格或分类..."
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {productsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-muted rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1 border rounded-lg">
                    {filteredProducts.map((product: any) => {
                      const inOrder = orderItems.find(item => item.productId === product.id);
                      return (
                        <div key={product.id} className={`flex items-center justify-between p-3 hover:bg-muted/50 border-b last:border-0 transition-colors ${inOrder ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{product.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {CATEGORY_LABELS[product.category] || product.category}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              规格: {product.specification} · 起订量: {product.minOrderQuantity || 1}{product.unit}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-2">
                            <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">¥{product.unitPrice.toFixed(2)}/{product.unit}</span>
                            {inOrder ? (
                              <Badge variant="default" className="text-xs whitespace-nowrap">已添加</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => addItem(product)} className="whitespace-nowrap">
                                添加
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">无匹配商品</div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Step 3: 订单明细（直输数量） ── */}
            {orderItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">第三步：确认订单明细</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium">商品名称</th>
                          <th className="text-left p-3 font-medium">规格</th>
                          <th className="text-right p-3 font-medium">单价</th>
                          <th className="text-center p-3 font-medium w-36">数量</th>
                          <th className="text-right p-3 font-medium">小计</th>
                          <th className="text-center p-3 font-medium w-16">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map(item => (
                          <tr key={item.productId} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-medium">{item.name}</td>
                            <td className="p-3 text-muted-foreground">{item.specification}</td>
                            <td className="p-3 text-right">¥{item.unitPrice.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={e => updateItemQuantity(item.productId, parseInt(e.target.value))}
                                  className="w-24 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-xs text-muted-foreground">{item.unit}</span>
                              </div>
                            </td>
                            <td className="p-3 text-right font-semibold">¥{(item.unitPrice * item.quantity).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItem(item.productId)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {/* ════════ 右侧：订单配置 + 金额汇总 ════════ */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">订单配置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* 折扣 */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">折扣率 (%)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={discountRate}
                    onChange={e => setDiscountRate(e.target.value)}
                    min="0"
                    max="100"
                    className="mt-1.5"
                  />
                </div>

                {/* ── 付款方式（合规：移除现金） ── */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">付款方式</Label>
                  <div className="mt-1.5 space-y-2">
                    {PAYMENT_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const isSelected = paymentMethod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPaymentMethod(opt.value)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                              : 'border-border hover:border-blue-200 hover:bg-muted/50'
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`} />
                          <div className="min-w-0">
                            <div className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : ''}`}>{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* ── 配送方式 ── */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">配送方式</Label>
                  <div className="mt-1.5 space-y-2">
                    {DELIVERY_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const isSelected = deliveryType === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDeliveryType(opt.value)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500'
                              : 'border-border hover:border-blue-200 hover:bg-muted/50'
                          }`}
                        >
                          <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`} />
                          <span className={`text-sm font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : ''}`}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── 动态物流表单引擎 ── */}
                {needsShippingAddress && (
                  <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                      <MapPin className="w-4 h-4" />
                      收货信息（必填）
                    </div>
                    <div>
                      <Label className="text-xs">收货人姓名 <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="请输入收货人姓名"
                        value={receiverName}
                        onChange={e => setReceiverName(e.target.value)}
                        className="mt-1 bg-white dark:bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">联系电话 <span className="text-red-500">*</span></Label>
                      <Input
                        placeholder="请输入联系电话"
                        value={receiverPhone}
                        onChange={e => setReceiverPhone(e.target.value)}
                        className="mt-1 bg-white dark:bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">详细地址 <span className="text-red-500">*</span></Label>
                      <Textarea
                        placeholder="请输入详细收货地址"
                        value={receiverAddress}
                        onChange={e => setReceiverAddress(e.target.value)}
                        className="mt-1 bg-white dark:bg-background"
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                {deliveryType === "SELF_PICKUP" && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium mb-2">
                      <Building2 className="w-4 h-4" />
                      工厂自提信息
                    </div>
                    <div className="text-sm space-y-1.5">
                      <div><span className="text-muted-foreground">地址：</span>{FACTORY_PICKUP_INFO.address}</div>
                      <div><span className="text-muted-foreground">联系人：</span>{FACTORY_PICKUP_INFO.contact}</div>
                      <div><span className="text-muted-foreground">电话：</span>{FACTORY_PICKUP_INFO.phone}</div>
                      <div><span className="text-muted-foreground">营业时间：</span>{FACTORY_PICKUP_INFO.hours}</div>
                    </div>
                  </div>
                )}

                {/* 备注 */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">备注</Label>
                  <Textarea
                    placeholder="订单备注..."
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    className="mt-1.5"
                    rows={2}
                  />
                </div>

                <Separator />

                {/* ── 金额汇总 ── */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">商品数</span>
                    <span>{orderItems.length} 种 / {orderItems.reduce((s, i) => s + i.quantity, 0)} 件</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">小计</span>
                    <span>¥{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>折扣 ({discountRate}%)</span>
                      <span>-¥{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>合计</span>
                    <span className="text-blue-600">¥{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-11"
                  onClick={handleSubmit}
                  disabled={createOrder.isPending || !selectedCustomerId || orderItems.length === 0}
                >
                  {createOrder.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      提交中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      提交审核
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ════════ 快捷新建客户 Modal ════════ */}
      <Dialog open={showNewCustomerModal} onOpenChange={setShowNewCustomerModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              快捷新建客户
            </DialogTitle>
            <DialogDescription>
              填写基础信息后保存，将自动选中该客户继续下单
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>客户名称 <span className="text-red-500">*</span></Label>
              <Input
                placeholder="例如：华东食品有限公司"
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label>客户类型</Label>
              <Select value={newCustomerType} onValueChange={setNewCustomerType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>联系人</Label>
                <Input
                  placeholder="联系人姓名"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>联系电话</Label>
                <Input
                  placeholder="手机号码"
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>地址</Label>
              <Input
                placeholder="客户地址（选填）"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomerModal(false)}>取消</Button>
            <Button onClick={handleCreateCustomer} disabled={createCustomer.isPending || !newCustomerName.trim()}>
              {createCustomer.isPending ? "创建中..." : "保存并选中"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ 批量导入 Modal ════════ */}
      <Dialog open={showBatchImport} onOpenChange={setShowBatchImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              批量导入商品
            </DialogTitle>
            <DialogDescription>
              每行一个商品，格式：商品名称/ID, 数量（支持 Tab 或逗号分隔）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder={`示例：\n薄千张 160g, 100\n中厚千张 500g, 50\n厚千张 2500g, 20`}
              value={batchImportText}
              onChange={e => setBatchImportText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              支持从 Excel 复制粘贴（Tab 分隔），商品名称需与系统中的名称完全匹配
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchImport(false)}>取消</Button>
            <Button onClick={handleBatchImport} disabled={!batchImportText.trim()}>
              确认导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
