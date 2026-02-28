/**
 * 代客下单页面 (RC3 Epic 2)
 * 
 * 路由: /orders/create
 * 功能:
 * - 销售员选择客户
 * - 选择商品、录入数量和折扣
 * - 提交审核
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
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Minus, Trash2, Send, UserCheck, Package, Search, CheckCircle } from "lucide-react";

interface OrderItem {
  productId: number;
  name: string;
  specification: string;
  unitPrice: number;
  unit: string;
  quantity: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  THIN: "薄千张",
  MEDIUM: "中厚千张",
  THICK: "厚千张",
};

export default function SalesCreateOrder() {
  const { user } = useAuth();
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [discountRate, setDiscountRate] = useState<string>("");
  const [remark, setRemark] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CREDIT");
  const [deliveryType, setDeliveryType] = useState("DELIVERY");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState("");

  // 获取客户列表
  const { data: customersData, isLoading: customersLoading } = trpc.salesOrder.getCustomers.useQuery({ orgId: 1 });

  // 获取商品列表
  const { data: productsData, isLoading: productsLoading } = trpc.portal.getProducts.useQuery({});

  // 代客下单
  const createOrder = trpc.salesOrder.createForCustomer.useMutation({
    onSuccess: (data: any) => {
      setOrderSubmitted(true);
      setSubmittedOrderNo(data.orderNo || `ORD-${Date.now()}`);
      setOrderItems([]);
      setSelectedCustomerId(null);
      setDiscountRate("");
      setRemark("");
      toast.success("订单创建成功，已提交审核！");
    },
    onError: (err: any) => {
      toast.error(`创建失败: ${err.message}`);
    },
  });

  const customers = customersData?.data || [];
  const products = productsData?.items || [];
  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);

  const filteredProducts = useMemo(() => {
    if (!searchKeyword) return products;
    return products.filter((p: any) =>
      p.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      p.specification.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [products, searchKeyword]);

  const addItem = (product: any) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        specification: product.specification,
        unitPrice: product.unitPrice,
        unit: product.unit,
        quantity: product.minOrderQuantity || 1,
      }];
    });
  };

  const updateItemQuantity = (productId: number, delta: number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const removeItem = (productId: number) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const discount = discountRate ? subtotal * (parseFloat(discountRate) / 100) : 0;
  const total = subtotal - discount;

  const handleSubmit = () => {
    if (!selectedCustomerId) {
      toast.error("请选择客户");
      return;
    }
    if (orderItems.length === 0) {
      toast.error("请添加商品");
      return;
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
      paymentMethod,
      deliveryType,
    });
  };

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
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">代客下单</h1>
          <p className="text-muted-foreground mt-1">为客户创建订单，提交后进入审核流程</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：客户选择 + 商品选择 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: 选择客户 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  第一步：选择客户
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customersLoading ? (
                  <div className="animate-pulse h-10 bg-gray-200 rounded" />
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
                {selectedCustomer && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm">
                    <p><strong>客户:</strong> {selectedCustomer.name || selectedCustomer.customerName}</p>
                    <p><strong>类型:</strong> {selectedCustomer.category || "N/A"}</p>
                    <p><strong>状态:</strong> {selectedCustomer.status || "ACTIVE"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: 选择商品 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  第二步：选择商品
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索商品..."
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {productsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse h-12 bg-gray-200 rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredProducts.map((product: any) => {
                      const inOrder = orderItems.find(item => item.productId === product.id);
                      return (
                        <div key={product.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 border-b last:border-0">
                          <div>
                            <span className="font-medium text-sm">{product.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{product.specification}</span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {CATEGORY_LABELS[product.category] || product.category}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-600">¥{product.unitPrice.toFixed(2)}/{product.unit}</span>
                            {inOrder ? (
                              <Badge variant="default" className="text-xs">已添加 ×{inOrder.quantity}</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => addItem(product)}>
                                <Plus className="w-3 h-3 mr-1" /> 添加
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 右侧：订单摘要 */}
          <div className="space-y-6">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="text-base">订单摘要</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    尚未添加商品
                  </p>
                ) : (
                  <>
                    {orderItems.map(item => (
                      <div key={item.productId} className="flex items-center justify-between text-sm border-b pb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ¥{item.unitPrice.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateItemQuantity(item.productId, -1)}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-xs">{item.quantity}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateItemQuantity(item.productId, 1)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeItem(item.productId)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <Separator />

                {/* 折扣 */}
                <div>
                  <Label className="text-xs">折扣率 (%)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={discountRate}
                    onChange={e => setDiscountRate(e.target.value)}
                    min="0"
                    max="100"
                    className="mt-1"
                  />
                </div>

                {/* 付款方式 */}
                <div>
                  <Label className="text-xs">付款方式</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT">赊销（月结）</SelectItem>
                      <SelectItem value="CASH">现金</SelectItem>
                      <SelectItem value="TRANSFER">银行转账</SelectItem>
                      <SelectItem value="WECHAT">微信支付</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 配送方式 */}
                <div>
                  <Label className="text-xs">配送方式</Label>
                  <Select value={deliveryType} onValueChange={setDeliveryType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DELIVERY">送货上门</SelectItem>
                      <SelectItem value="PICKUP">客户自提</SelectItem>
                      <SelectItem value="EXPRESS">快递</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 备注 */}
                <div>
                  <Label className="text-xs">备注</Label>
                  <Textarea
                    placeholder="订单备注..."
                    value={remark}
                    onChange={e => setRemark(e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>

                <Separator />

                {/* 金额汇总 */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>小计</span>
                    <span>¥{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>折扣 ({discountRate}%)</span>
                      <span>-¥{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base">
                    <span>合计</span>
                    <span className="text-blue-600">¥{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
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
    </DashboardLayout>
  );
}
