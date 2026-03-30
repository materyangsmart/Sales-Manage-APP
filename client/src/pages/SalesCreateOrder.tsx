/**
 * 代客下单页面 (RC6 全面重构)
 *
 * 新增功能:
 * 1. 禁用任意折扣 → 客户等级自动定价 + 特批工作流
 * 2. 防抵赖机制 → 提交前 6 位交易密码 Modal（Mock 短信验证码降级）
 * 3. 支付方式联动 UI → CREDIT 可用额度 / BANK_TRANSFER 只读卡片 / ONLINE_PAYMENT 二维码
 * 4. 下单人姓名/电话必填
 * 5. 修复 ATP 提交失败 Bug（移除 discountRate，改为 priceOverride 特批）
 * 6. 移动端响应式修复
 * 7. 新建客户后下拉框状态同步修复
 */
import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Trash2, Send, UserCheck, Package, Search, CheckCircle,
  UserPlus, Building2, Phone, MapPin, Truck, PackageCheck,
  CreditCard, Landmark, Smartphone, FileSpreadsheet,
  AlertTriangle, Lock, MessageSquare, ShieldCheck, Info,
  QrCode, RefreshCw, Plus, Minus
} from "lucide-react";

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

interface OrderItem {
  productId: number;
  name: string;
  specification: string;
  unitPrice: number;          // 标准单价
  finalPrice: number;         // 实际成交价（等级折后价）
  unit: string;
  quantity: number;
  minOrderQuantity: number;
  priceOverride?: number;     // 特批价（需走审批）
  hasPriceOverride?: boolean;
}

// ─── 常量 ──────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  THIN: "薄千张", MEDIUM: "中厚千张", THICK: "厚千张",
};

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "餐饮客户", WHOLESALE: "批发商",
  RETAIL: "零售商", FACTORY: "加工厂", OTHER: "其他",
};

/** 客户等级折扣率（按类型自动计算，禁止手动输入） */
const CUSTOMER_TIER_DISCOUNT: Record<string, { rate: number; label: string; color: string }> = {
  RESTAURANT: { rate: 0.95, label: "餐饮客户 95 折", color: "bg-blue-100 text-blue-700" },
  WHOLESALE:  { rate: 0.90, label: "批发商 9 折",    color: "bg-purple-100 text-purple-700" },
  RETAIL:     { rate: 0.98, label: "零售商 98 折",   color: "bg-green-100 text-green-700" },
  FACTORY:    { rate: 0.88, label: "加工厂 88 折",   color: "bg-orange-100 text-orange-700" },
  OTHER:      { rate: 1.00, label: "标准价",          color: "bg-gray-100 text-gray-700" },
};

const PAYMENT_OPTIONS = [
  { value: "CREDIT",         label: "账期/信用额度", icon: CreditCard,  desc: "月结对账，按信用额度扣减" },
  { value: "BANK_TRANSFER",  label: "对公转账",      icon: Landmark,    desc: "银行对公账户转账" },
  { value: "ONLINE_PAYMENT", label: "线上支付",      icon: Smartphone,  desc: "微信/支付宝线上支付" },
] as const;

const DELIVERY_OPTIONS = [
  { value: "DELIVERY",    label: "送货上门", icon: Truck,        needAddress: true },
  { value: "EXPRESS",     label: "快递配送", icon: PackageCheck, needAddress: true },
  { value: "SELF_PICKUP", label: "客户自提", icon: Building2,    needAddress: false },
] as const;

const FACTORY_PICKUP_INFO = {
  address: "安徽省六安市裕安区苏埠镇千张产业园 3 号厂房",
  contact: "王师傅",
  phone: "138-0564-XXXX",
  hours: "周一至周六 06:00-18:00",
};

/** 对公转账账户信息（只读展示） */
const BANK_ACCOUNT_INFO = {
  accountName: "安徽千张食品有限公司",
  bank: "中国工商银行六安裕安支行",
  accountNo: "6222 0202 0001 2345 678",
  swift: "ICBKCNBJ",
};

// ─── 主组件 ────────────────────────────────────────────────────────────────────

export default function SalesCreateOrder() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ── 核心状态 ──
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerType, setSelectedCustomerType] = useState<string>("OTHER");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [remark, setRemark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("CREDIT");
  const [deliveryType, setDeliveryType] = useState<string>("DELIVERY");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState("");

  // ── 下单人信息（必填） ──
  const [ordererName, setOrdererName] = useState("");
  const [ordererPhone, setOrdererPhone] = useState("");

  // ── 物流信息状态 ──
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");

  // ── 特批价格申请 ──
  const [showPriceOverrideModal, setShowPriceOverrideModal] = useState(false);
  const [overrideItem, setOverrideItem] = useState<OrderItem | null>(null);
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [pendingOverrides, setPendingOverrides] = useState<number[]>([]); // productIds

  // ── 防抵赖机制：交易密码 Modal ──
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"password" | "sms">("password");
  const [txPassword, setTxPassword] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [authVerified, setAuthVerified] = useState(false);

  // ── 快捷新建客户已移除，客户必须在客户管理模块中正规创建 ──

  // ── 批量导入 Modal ──
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [batchImportText, setBatchImportText] = useState("");

  // ── 信用额度查询 ──
  const [creditInfo, setCreditInfo] = useState<{ limit: number; used: number } | null>(null);

  // ── API 调用 ──
  const { data: customersData, isLoading: customersLoading } = trpc.customerMgmt.listForOrder.useQuery({});
  const { data: productsData } = trpc.portal.getProducts.useQuery({});

  const createOrder = trpc.salesOrder.createForCustomer.useMutation({
    onSuccess: (data: any) => {
      setOrderSubmitted(true);
      setSubmittedOrderNo(data?.orderNo || data?.id ? `ORD-${data.id}` : `ORD-${Date.now()}`);
      setOrderItems([]);
      setSelectedCustomerId(null);
      setRemark("");
      setReceiverName(""); setReceiverPhone(""); setReceiverAddress("");
      setOrdererName(""); setOrdererPhone("");
      setAuthVerified(false);
      toast.success("订单创建成功，已提交审核！");
    },
    onError: (err: any) => {
      toast.error(`创建失败: ${err.message}`);
    },
  });

  // createCustomer 已移除，客户必须在客户管理模块中正规创建

  const customers = useMemo(() => customersData || [], [customersData]);
  const products = productsData?.items || [];

  const selectedCustomer = useMemo(
    () => customers.find((c: any) => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  // 客户等级折扣
  const tierDiscount = CUSTOMER_TIER_DISCOUNT[selectedCustomerType] || CUSTOMER_TIER_DISCOUNT.OTHER;

  // 选中客户时同步类型 + 模拟信用额度查询
  useEffect(() => {
    if (selectedCustomer) {
      const ctype = (selectedCustomer as any).customerType || "OTHER";
      setSelectedCustomerType(ctype);
      // 模拟信用额度（真实场景调用 credit.check）
      setCreditInfo({ limit: 200000, used: 45000 });
    }
  }, [selectedCustomer]);

  // SMS 倒计时
  useEffect(() => {
    if (smsCountdown > 0) {
      const t = setTimeout(() => setSmsCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [smsCountdown]);

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
      if (prev.find(item => item.productId === product.id)) {
        toast.info(`${product.name} 已在订单中，请直接修改数量`);
        return prev;
      }
      const tierRate = (CUSTOMER_TIER_DISCOUNT[selectedCustomerType] || CUSTOMER_TIER_DISCOUNT.OTHER).rate;
      const finalPrice = Math.round(product.unitPrice * tierRate * 100) / 100;
      return [...prev, {
        productId: product.id,
        name: product.name,
        specification: product.specification,
        unitPrice: product.unitPrice,
        finalPrice,
        unit: product.unit,
        quantity: product.minOrderQuantity || 1,
        minOrderQuantity: product.minOrderQuantity || 1,
      }];
    });
  }, [selectedCustomerType]);

  const updateItemQuantity = useCallback((productId: number, newQty: number) => {
    setOrderItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, quantity: Math.max(1, isNaN(newQty) ? 1 : Math.floor(newQty)) }
        : item
    ));
  }, []);

  const removeItem = useCallback((productId: number) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  }, []);

  // ── 特批价格申请 ──
  const openPriceOverride = (item: OrderItem) => {
    setOverrideItem(item);
    setOverridePrice(item.finalPrice.toString());
    setOverrideReason("");
    setShowPriceOverrideModal(true);
  };

  const confirmPriceOverride = () => {
    if (!overrideItem) return;
    const newPrice = parseFloat(overridePrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      toast.error("请输入有效的价格");
      return;
    }
    if (!overrideReason.trim()) {
      toast.error("请填写特批原因");
      return;
    }
    setOrderItems(prev => prev.map(item =>
      item.productId === overrideItem.productId
        ? { ...item, finalPrice: newPrice, priceOverride: newPrice, hasPriceOverride: true }
        : item
    ));
    setPendingOverrides(prev => [...prev.filter(id => id !== overrideItem.productId), overrideItem.productId]);
    toast.warning(`价格特批申请已标记，提交后将进入审批流程`);
    setShowPriceOverrideModal(false);
  };

  // ── 批量导入 ──
  const handleBatchImport = useCallback(() => {
    if (!batchImportText.trim()) { toast.error("请输入批量导入数据"); return; }
    const tierRate = (CUSTOMER_TIER_DISCOUNT[selectedCustomerType] || CUSTOMER_TIER_DISCOUNT.OTHER).rate;
    const lines = batchImportText.trim().split("\n");
    let imported = 0;
    for (const line of lines) {
      const parts = line.split(/[,\t，]/).map(s => s.trim());
      if (parts.length < 2) continue;
      const [nameOrId, qtyStr] = parts;
      const qty = parseInt(qtyStr);
      if (isNaN(qty) || qty <= 0) continue;
      const product = products.find((p: any) => p.name === nameOrId || p.id.toString() === nameOrId);
      if (product) {
        const finalPrice = Math.round(product.unitPrice * tierRate * 100) / 100;
        setOrderItems(prev => {
          const existing = prev.find(item => item.productId === product.id);
          if (existing) return prev.map(item => item.productId === product.id ? { ...item, quantity: qty } : item);
          return [...prev, {
            productId: product.id, name: product.name, specification: product.specification,
            unitPrice: product.unitPrice, finalPrice, unit: product.unit,
            quantity: qty, minOrderQuantity: product.minOrderQuantity || 1,
          }];
        });
        imported++;
      }
    }
    toast.success(`批量导入完成：${imported} 个商品`);
    setShowBatchImport(false);
    setBatchImportText("");
  }, [batchImportText, products, selectedCustomerType]);

  // ── 金额计算 ──
  const subtotal = orderItems.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);
  const hasOverrides = pendingOverrides.length > 0;
  const needsShippingAddress = deliveryType === "DELIVERY" || deliveryType === "EXPRESS";

  // ── 防抵赖：发送验证码（Mock） ──
  const sendSmsCode = () => {
    if (!ordererPhone.trim()) { toast.error("请先填写下单人电话"); return; }
    setSmsSent(true);
    setSmsCountdown(60);
    toast.success(`验证码已发送至 ${ordererPhone}（Mock: 123456）`);
  };

  // ── 防抵赖：验证 ──
  const verifyAuth = () => {
    if (authMode === "password") {
      if (txPassword.length !== 6) { toast.error("请输入 6 位交易密码"); return; }
      // Mock 验证：任意 6 位数字均通过（真实场景调用后端验证）
      if (!/^\d{6}$/.test(txPassword)) { toast.error("交易密码必须为 6 位数字"); return; }
    } else {
      if (smsCode !== "123456") { toast.error("验证码错误（Mock: 123456）"); return; }
    }
    setAuthVerified(true);
    setShowAuthModal(false);
    toast.success("身份验证通过，正在提交订单...");
    // 验证通过后立即提交
    submitOrder();
  };

  // ── 实际提交 ──
  const submitOrder = () => {
    createOrder.mutate({
      customerId: selectedCustomerId!,
      items: orderItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.finalPrice,
      })),
      remark: [
        remark,
        `[下单人] ${ordererName} / ${ordererPhone}`,
        hasOverrides ? `[特批价格] 商品ID: ${pendingOverrides.join(",")} 需财务总监审批` : "",
        hasOverrides ? `[特批原因] ${overrideReason}` : "",
      ].filter(Boolean).join("\n") || undefined,
      paymentMethod: paymentMethod as any,
      deliveryType: deliveryType as any,
      receiverName: needsShippingAddress ? receiverName : undefined,
      receiverPhone: needsShippingAddress ? receiverPhone : undefined,
      receiverAddress: needsShippingAddress ? receiverAddress : undefined,
    });
  };

  // ── 提交入口（先验证，再弹出防抵赖 Modal） ──
  const handleSubmit = () => {
    if (!selectedCustomerId) { toast.error("请选择客户"); return; }
    if (orderItems.length === 0) { toast.error("请添加商品"); return; }
    if (!ordererName.trim()) { toast.error("请填写下单人姓名"); return; }
    if (!ordererPhone.trim()) { toast.error("请填写下单人电话"); return; }
    if (needsShippingAddress) {
      if (!receiverName.trim()) { toast.error("请填写收货人姓名"); return; }
      if (!receiverPhone.trim()) { toast.error("请填写联系电话"); return; }
      if (!receiverAddress.trim()) { toast.error("请填写详细地址"); return; }
    }
    // 弹出防抵赖验证 Modal
    setTxPassword("");
    setSmsCode("");
    setAuthMode("password");
    setShowAuthModal(true);
  };


  // ── 订单成功页 ──
  if (orderSubmitted) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh] p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="pt-10 pb-8 space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-green-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-green-700">订单提交成功</h2>
                <p className="text-muted-foreground mt-1 text-sm">订单已进入审核队列</p>
              </div>
              <div className="bg-muted rounded-lg p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">订单编号</span>
                  <span className="font-mono font-semibold">{submittedOrderNo}</span>
                </div>
                {hasOverrides && (
                  <div className="flex items-center gap-2 text-amber-600 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    含特批价格，需财务总监审批
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setOrderSubmitted(false)}>
                  继续下单
                </Button>
                <Button className="flex-1" onClick={() => window.history.back()}>
                  返回列表
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── 主界面 ──
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-600" />
            代客下单
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            为客户创建订单，价格按客户等级自动计算，修改价格需走特批流程
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
          {/* ════════ 左侧：客户 + 商品 ════════ */}
          <div className="space-y-6">

            {/* ── 步骤 1：选择客户 ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  选择客户
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Select
                    value={selectedCustomerId?.toString() || ""}
                    onValueChange={val => {
                      const id = parseInt(val);
                      setSelectedCustomerId(id);
                      const c = customers.find((c: any) => c.id === id);
                      if (c) setSelectedCustomerType((c as any).customerType || "OTHER");
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={customersLoading ? "加载中..." : "搜索或选择客户..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{c.customerCode}</span>
                            <span>{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {CUSTOMER_TYPE_LABELS[c.customerType] || c.customerType}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!customersLoading && customers.length === 0 && (
                  <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription>
                      暂无可下单客户。请先在{" "}
                      <a href="/customers" className="text-blue-600 underline font-medium">客户管理</a>
                      {" "}中创建客户，并由管理员完成授信后方可下单。
                    </AlertDescription>
                  </Alert>
                )}

                {selectedCustomer && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <Badge className={tierDiscount.color + " border-0"}>
                      {tierDiscount.label}
                    </Badge>
                    {creditInfo && paymentMethod === "CREDIT" && (
                      <Badge variant="outline" className="text-xs">
                        可用额度：¥{(creditInfo.limit - creditInfo.used).toLocaleString()}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {(selectedCustomer as any).contactName && `联系人：${(selectedCustomer as any).contactName}`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 步骤 2：下单人信息（必填） ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                  下单人信息
                  <Badge variant="destructive" className="text-xs ml-1">必填</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">下单人姓名 <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="请输入下单人姓名"
                      value={ordererName}
                      onChange={e => setOrdererName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">下单人电话 <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="请输入手机号"
                      value={ordererPhone}
                      onChange={e => setOrdererPhone(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── 步骤 3：选择商品 ── */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                  选择商品
                </CardTitle>
                <CardDescription>
                  价格已按客户等级自动折算，如需修改价格请点击"申请特批"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 搜索 + 批量导入 */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索商品名称或规格..."
                      value={searchKeyword}
                      onChange={e => setSearchKeyword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowBatchImport(true)}>
                    <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                    批量导入
                  </Button>
                </div>

                {/* 商品列表 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {filteredProducts.map((p: any) => {
                    const tierRate = tierDiscount.rate;
                    const discountedPrice = Math.round(p.unitPrice * tierRate * 100) / 100;
                    const inOrder = orderItems.some(item => item.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addItem(p)}
                        disabled={inOrder}
                        className={`text-left p-3 rounded-lg border transition-all text-sm ${
                          inOrder
                            ? "border-blue-300 bg-blue-50 dark:bg-blue-950/20 opacity-60 cursor-not-allowed"
                            : "border-border hover:border-blue-300 hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.specification}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-blue-600 font-semibold">¥{discountedPrice}/{p.unit}</span>
                          {tierRate < 1 && (
                            <span className="text-xs text-muted-foreground line-through">¥{p.unitPrice}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* ── 订单明细 ── */}
            {orderItems.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    订单明细
                    <Badge variant="secondary">{orderItems.length} 种商品</Badge>
                    {hasOverrides && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                        含 {pendingOverrides.length} 项特批价格
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left pb-2">商品</th>
                          <th className="text-right pb-2">单价</th>
                          <th className="text-center pb-2 w-36">数量</th>
                          <th className="text-right pb-2">小计</th>
                          <th className="text-center pb-2 w-20">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {orderItems.map(item => (
                          <tr key={item.productId}>
                            <td className="py-2.5 pr-2">
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.specification}</div>
                              {item.hasPriceOverride && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs mt-0.5">
                                  特批价
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              <div className="text-blue-600 font-medium">¥{item.finalPrice}</div>
                              {item.finalPrice !== item.unitPrice && !item.hasPriceOverride && (
                                <div className="text-xs text-muted-foreground line-through">¥{item.unitPrice}</div>
                              )}
                            </td>
                            <td className="py-2.5">
                              {/* InputNumber 直输（RC5 保留） */}
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="outline" size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={e => updateItemQuantity(item.productId, parseInt(e.target.value))}
                                  className="h-7 w-16 text-center text-sm [appearance:textfield]"
                                  min={1}
                                />
                                <Button
                                  variant="outline" size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="py-2.5 text-right font-medium whitespace-nowrap">
                              ¥{(item.finalPrice * item.quantity).toFixed(2)}
                            </td>
                            <td className="py-2.5 text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-amber-500 hover:text-amber-700"
                                  title="申请特批价格"
                                  onClick={() => openPriceOverride(item)}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => removeItem(item.productId)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

          {/* ════════ 右侧：订单配置 + 汇总 ════════ */}
          <div className="space-y-4">
            <div className="xl:sticky xl:top-6 space-y-4">

              {/* ── 付款方式 ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">付款方式</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500"
                            : "border-border hover:border-blue-200 hover:bg-muted/50"
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${isSelected ? "text-blue-600" : "text-muted-foreground"}`} />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-medium ${isSelected ? "text-blue-700 dark:text-blue-400" : ""}`}>
                            {opt.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}

                  {/* ── 支付方式联动 UI ── */}
                  {paymentMethod === "CREDIT" && creditInfo && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 text-sm space-y-1.5">
                      <div className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        信用额度详情
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">总额度</span>
                        <span className="font-medium">¥{creditInfo.limit.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">已用额度</span>
                        <span className="text-amber-600">¥{creditInfo.used.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold border-t pt-1.5">
                        <span>可用额度</span>
                        <span className={subtotal > (creditInfo.limit - creditInfo.used) ? "text-red-600" : "text-green-600"}>
                          ¥{(creditInfo.limit - creditInfo.used).toLocaleString()}
                        </span>
                      </div>
                      {subtotal > (creditInfo.limit - creditInfo.used) && (
                        <Alert className="py-2 border-red-200 bg-red-50 dark:bg-red-950/20">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          <AlertDescription className="text-xs text-red-600">
                            订单金额超出可用额度，将触发财务总监特批
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}

                  {paymentMethod === "BANK_TRANSFER" && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border text-sm space-y-1.5">
                      <div className="font-medium flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        <Landmark className="w-4 h-4" />
                        对公账户信息（只读）
                      </div>
                      {[
                        ["户名", BANK_ACCOUNT_INFO.accountName],
                        ["开户行", BANK_ACCOUNT_INFO.bank],
                        ["账号", BANK_ACCOUNT_INFO.accountNo],
                        ["SWIFT", BANK_ACCOUNT_INFO.swift],
                      ].map(([label, val]) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-muted-foreground shrink-0">{label}</span>
                          <span className="font-mono text-right ml-2">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {paymentMethod === "ONLINE_PAYMENT" && (
                    <div className="mt-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 text-center space-y-2">
                      <div className="font-medium text-green-700 dark:text-green-400 flex items-center justify-center gap-1.5 text-sm">
                        <QrCode className="w-4 h-4" />
                        聚合收款码
                      </div>
                      {/* Mock 二维码 SVG */}
                      <div className="w-28 h-28 mx-auto bg-white border-2 border-green-300 rounded-lg flex items-center justify-center">
                        <div className="grid grid-cols-5 gap-0.5 p-2">
                          {Array.from({ length: 25 }).map((_, i) => (
                            <div key={i} className={`w-3.5 h-3.5 rounded-sm ${
                              [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,7,12,17].includes(i)
                                ? "bg-green-700" : "bg-white"
                            }`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">微信/支付宝扫码付款</p>
                      <p className="text-xs text-green-600 font-medium">
                        应付：¥{subtotal.toFixed(2)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── 配送方式 ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">配送方式</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
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
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-500"
                            : "border-border hover:border-blue-200 hover:bg-muted/50"
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${isSelected ? "text-blue-600" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${isSelected ? "text-blue-700 dark:text-blue-400" : ""}`}>
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}

                  {/* 动态物流表单 */}
                  {needsShippingAddress && (
                    <div className="mt-2 space-y-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                        <MapPin className="w-4 h-4" />
                        收货信息（必填）
                      </div>
                      <div>
                        <Label className="text-xs">收货人姓名 <span className="text-red-500">*</span></Label>
                        <Input placeholder="收货人" value={receiverName} onChange={e => setReceiverName(e.target.value)} className="mt-1 bg-white dark:bg-background" />
                      </div>
                      <div>
                        <Label className="text-xs">联系电话 <span className="text-red-500">*</span></Label>
                        <Input placeholder="手机号" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} className="mt-1 bg-white dark:bg-background" />
                      </div>
                      <div>
                        <Label className="text-xs">详细地址 <span className="text-red-500">*</span></Label>
                        <Textarea placeholder="省市区 + 详细地址" value={receiverAddress} onChange={e => setReceiverAddress(e.target.value)} className="mt-1 bg-white dark:bg-background" rows={2} />
                      </div>
                    </div>
                  )}

                  {deliveryType === "SELF_PICKUP" && (
                    <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900 text-sm space-y-1.5">
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                        <Building2 className="w-4 h-4" />
                        工厂自提信息
                      </div>
                      {[
                        ["地址", FACTORY_PICKUP_INFO.address],
                        ["联系人", FACTORY_PICKUP_INFO.contact],
                        ["电话", FACTORY_PICKUP_INFO.phone],
                        ["营业时间", FACTORY_PICKUP_INFO.hours],
                      ].map(([label, val]) => (
                        <div key={label} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">{label}：</span>
                          <span>{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── 备注 + 金额汇总 ── */}
              <Card>
                <CardContent className="pt-4 space-y-4">
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

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">商品数</span>
                      <span>{orderItems.length} 种 / {orderItems.reduce((s, i) => s + i.quantity, 0)} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">等级折扣</span>
                      <span className="text-green-600">{tierDiscount.label}</span>
                    </div>
                    {hasOverrides && (
                      <div className="flex justify-between text-amber-600 text-xs">
                        <span>含特批价格商品</span>
                        <span>{pendingOverrides.length} 项（待审批）</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>合计</span>
                      <span className="text-blue-600">¥{subtotal.toFixed(2)}</span>
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
                        <ShieldCheck className="w-4 h-4" />
                        验证并提交
                      </span>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    提交前需完成身份验证（交易密码或短信验证码）
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ 防抵赖：身份验证 Modal ════════ */}
      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              身份验证
            </DialogTitle>
            <DialogDescription>
              为防止抵赖，提交订单前需完成身份验证
            </DialogDescription>
          </DialogHeader>

          {/* 切换验证方式 */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${authMode === "password" ? "bg-blue-600 text-white" : "bg-background hover:bg-muted"}`}
              onClick={() => setAuthMode("password")}
            >
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              交易密码
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${authMode === "sms" ? "bg-blue-600 text-white" : "bg-background hover:bg-muted"}`}
              onClick={() => setAuthMode("sms")}
            >
              <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
              短信验证码
            </button>
          </div>

          <div className="space-y-4 py-2">
            {authMode === "password" ? (
              <div>
                <Label>6 位交易密码</Label>
                <Input
                  type="password"
                  placeholder="请输入 6 位数字交易密码"
                  value={txPassword}
                  onChange={e => setTxPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1.5 text-center text-xl tracking-widest"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">
                  初始密码为 6 位数字（Mock 模式：任意 6 位数字均可通过）
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>验证码发送至：{ordererPhone || "（请先填写下单人电话）"}</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      placeholder="6 位验证码"
                      value={smsCode}
                      onChange={e => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="flex-1 text-center text-xl tracking-widest"
                      maxLength={6}
                    />
                    <Button
                      variant="outline"
                      disabled={smsCountdown > 0 || !ordererPhone.trim()}
                      onClick={sendSmsCode}
                      className="shrink-0"
                    >
                      {smsCountdown > 0 ? `${smsCountdown}s` : smsSent ? "重新发送" : "发送验证码"}
                    </Button>
                  </div>
                  {smsSent && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Mock 验证码已发送（Mock 模式：请输入 123456）
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 订单摘要 */}
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <div className="font-medium text-sm mb-1">订单摘要</div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">客户</span>
                <span>{(selectedCustomer as any)?.name || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">商品数</span>
                <span>{orderItems.length} 种</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>合计金额</span>
                <span className="text-blue-600">¥{subtotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthModal(false)}>取消</Button>
            <Button onClick={verifyAuth} disabled={createOrder.isPending}>
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              确认提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════ 特批价格申请 Modal ════════ */}
      <Dialog open={showPriceOverrideModal} onOpenChange={setShowPriceOverrideModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              申请特批价格
            </DialogTitle>
            <DialogDescription>
              修改价格将触发财务总监审批工作流，订单状态变为"待特批"
            </DialogDescription>
          </DialogHeader>
          {overrideItem && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="font-medium">{overrideItem.name}</div>
                <div className="text-muted-foreground text-xs">{overrideItem.specification}</div>
                <div className="flex justify-between text-xs mt-2">
                  <span>等级折后价</span>
                  <span className="font-medium">¥{overrideItem.finalPrice}/{overrideItem.unit}</span>
                </div>
              </div>
              <div>
                <Label>特批成交价 <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  placeholder="请输入特批价格"
                  value={overridePrice}
                  onChange={e => setOverridePrice(e.target.value)}
                  className="mt-1.5"
                  min={0}
                  step={0.01}
                />
              </div>
              <div>
                <Label>特批原因 <span className="text-red-500">*</span></Label>
                <Textarea
                  placeholder="请说明特批原因（如：大客户年度协议价、竞争报价等）"
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPriceOverrideModal(false)}>取消</Button>
            <Button
              variant="default"
              className="bg-amber-500 hover:bg-amber-600"
              onClick={confirmPriceOverride}
              disabled={!overridePrice || !overrideReason.trim()}
            >
              申请特批
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 快捷新建客户 Modal 已彻底移除，客户必须在客户管理模块中正规创建 */}

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
            <Button onClick={handleBatchImport} disabled={!batchImportText.trim()}>确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
