/**
 * B2B 客户自助下单门户 (RC3 Epic 2)
 * 
 * 路由: /portal/order
 * 功能:
 * - 客户查看专属协议价商品库
 * - 购物车批量添加商品
 * - 一键提交形成 PENDING 状态订单
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ShoppingCart, Plus, Minus, Trash2, Send, Package, Search, Filter, ArrowLeft, CheckCircle } from "lucide-react";
import { getLoginUrl } from "@/const";

interface CartItem {
  productId: number;
  name: string;
  category: string;
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

const CATEGORY_COLORS: Record<string, string> = {
  THIN: "bg-amber-100 text-amber-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  THICK: "bg-emerald-100 text-emerald-800",
};

export default function CustomerPortal() {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showCart, setShowCart] = useState(false);
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState("");

  // 获取商品列表（使用 Open API）
  const { data: productsData, isLoading: productsLoading } = trpc.portal.getProducts.useQuery(
    { category: selectedCategory === "ALL" ? undefined : selectedCategory, keyword: searchKeyword || undefined },
    { enabled: !!user }
  );

  // 提交订单
  const submitOrder = trpc.portal.submitOrder.useMutation({
    onSuccess: (data: any) => {
      setOrderSubmitted(true);
      setSubmittedOrderNo(data.orderNo || `ORD-${Date.now()}`);
      setCart([]);
      toast.success("订单提交成功！我们将尽快处理您的订单。");
    },
    onError: (err: any) => {
      toast.error(`提交失败: ${err.message}`);
    },
  });

  // 未登录提示
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <Package className="w-12 h-12 mx-auto text-blue-600 mb-2" />
            <CardTitle className="text-xl">千张销售 B2B 采购门户</CardTitle>
            <CardDescription>请登录您的企业账号以查看专属商品和下单</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.href = getLoginUrl()}>
              登录 / 注册
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 订单提交成功页面
  if (orderSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <Card className="w-full max-w-md mx-4 text-center">
          <CardHeader>
            <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-2" />
            <CardTitle className="text-xl">订单提交成功</CardTitle>
            <CardDescription>订单号: {submittedOrderNo}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              您的订单已进入待审核状态，我们的销售团队将尽快处理。
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setOrderSubmitted(false)}>
                继续下单
              </Button>
              <Button onClick={() => window.location.href = "/"}>
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const products = productsData?.items || [];

  // 购物车操作
  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + (product.minOrderQuantity || 1) }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        category: product.category,
        specification: product.specification,
        unitPrice: product.unitPrice,
        unit: product.unit,
        quantity: product.minOrderQuantity || 1,
        minOrderQuantity: product.minOrderQuantity || 1,
      }];
    });
    toast.success(`已添加 ${product.name} 到购物车`);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(item.minOrderQuantity, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmitOrder = () => {
    if (cart.length === 0) {
      toast.error("购物车为空，请先添加商品");
      return;
    }
    submitOrder.mutate({
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
      source: "B2B_PORTAL",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-blue-600" />
              <span className="font-semibold text-lg">千张 B2B 采购门户</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                欢迎, {user.name || "客户"}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="relative"
                onClick={() => setShowCart(!showCart)}
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                购物车
                {cartCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {cartCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* 商品列表 */}
          <div className={`flex-1 ${showCart ? "lg:w-2/3" : "w-full"}`}>
            {/* 搜索和筛选 */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索商品名称..."
                  value={searchKeyword}
                  onChange={e => setSearchKeyword(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {["ALL", "THIN", "MEDIUM", "THICK"].map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === "ALL" ? "全部" : CATEGORY_LABELS[cat]}
                  </Button>
                ))}
              </div>
            </div>

            {/* 商品网格 */}
            {productsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
                      <div className="h-8 bg-gray-200 rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>暂无匹配的商品</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product: any) => {
                  const inCart = cart.find(item => item.productId === product.id);
                  return (
                    <Card key={product.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-sm">{product.name}</h3>
                          <Badge className={`text-xs ${CATEGORY_COLORS[product.category] || ""}`} variant="secondary">
                            {CATEGORY_LABELS[product.category] || product.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          规格: {product.specification} | 最低起订: {product.minOrderQuantity}{product.unit}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-lg font-bold text-blue-600">
                            ¥{product.unitPrice.toFixed(2)}
                            <span className="text-xs font-normal text-muted-foreground">/{product.unit}</span>
                          </span>
                          {inCart ? (
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(product.id, -1)}>
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">{inCart.quantity}</span>
                              <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(product.id, 1)}>
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => addToCart(product)}>
                              <Plus className="w-3 h-3 mr-1" /> 加入
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* 购物车侧边栏 */}
          {showCart && (
            <div className="hidden lg:block w-80">
              <Card className="sticky top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    购物车 ({cart.length} 种商品)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      购物车为空
                    </p>
                  ) : (
                    <>
                      {cart.map(item => (
                        <div key={item.productId} className="flex items-center justify-between text-sm border-b pb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ¥{item.unitPrice.toFixed(2)} × {item.quantity} = ¥{(item.unitPrice * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.productId, -1)}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center text-xs">{item.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.productId, 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => removeFromCart(item.productId)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex items-center justify-between font-medium">
                        <span>合计</span>
                        <span className="text-lg text-blue-600">¥{cartTotal.toFixed(2)}</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSubmitOrder}
                        disabled={submitOrder.isPending}
                      >
                        {submitOrder.isPending ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            提交中...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            提交订单
                          </span>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 移动端底部购物车 */}
      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 lg:hidden z-50">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <span className="text-sm text-muted-foreground">{cart.length} 种商品</span>
              <span className="ml-2 text-lg font-bold text-blue-600">¥{cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCart(true)}>
                查看购物车
              </Button>
              <Button size="sm" onClick={handleSubmitOrder} disabled={submitOrder.isPending}>
                <Send className="w-3 h-3 mr-1" />
                提交订单
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
