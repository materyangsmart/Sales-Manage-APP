/**
 * RC1 Epic 2: 极速下单页面
 *
 * 对接 POST /api/mobile/v1/orders/quick-submit
 * 只需选客户、选商品、填数量，极简交互 + 加载动画 + 成功提示
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Package,
  User,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOCK_CUSTOMERS = [
  { id: 1, name: "张记菜市场", contact: "张老板", phone: "138****1234" },
  { id: 2, name: "王氏商超（南门店）", contact: "王经理", phone: "139****5678" },
  { id: 3, name: "李记批发部", contact: "李师傅", phone: "137****9012" },
  { id: 4, name: "城东农贸市场", contact: "刘老板", phone: "136****3456" },
  { id: 5, name: "鲜味来超市", contact: "陈经理", phone: "135****7890" },
];

const MOCK_PRODUCTS = [
  { id: 1, name: "千张（标准）", unit: "斤", price: 6.5 },
  { id: 2, name: "千张（精品）", unit: "斤", price: 8.0 },
  { id: 3, name: "豆腐皮（薄）", unit: "斤", price: 5.5 },
  { id: 4, name: "豆腐皮（厚）", unit: "斤", price: 5.0 },
  { id: 5, name: "素鸡", unit: "斤", price: 7.0 },
  { id: 6, name: "豆干（五香）", unit: "斤", price: 9.0 },
  { id: 7, name: "腐竹", unit: "斤", price: 12.0 },
  { id: 8, name: "油豆腐", unit: "斤", price: 8.5 },
];

interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function QuickSubmit() {
  const [, navigate] = useLocation();
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [remark, setRemark] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [resultData, setResultData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  const selectedCustomer = MOCK_CUSTOMERS.find((c) => c.id === selectedCustomerId);

  const addProduct = useCallback((product: typeof MOCK_PRODUCTS[0]) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          unit: product.unit,
        },
      ];
    });
    setShowProductPicker(false);
  }, []);

  const updateQuantity = useCallback((productId: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const handleSubmit = async () => {
    if (!selectedCustomerId || items.length === 0) return;

    setSubmitState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/mobile/v1/orders/quick-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          remark: remark || undefined,
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setSubmitState("success");
        setResultData(json.data);
      } else {
        setSubmitState("error");
        setErrorMsg(json.message || json.error || "下单失败");
      }
    } catch (err: any) {
      setSubmitState("error");
      setErrorMsg(err.message || "网络异常，请稍后重试");
    }
  };

  const handleReset = () => {
    setSelectedCustomerId(null);
    setItems([]);
    setRemark("");
    setSubmitState("idle");
    setResultData(null);
    setErrorMsg("");
  };

  // 提交成功页面
  if (submitState === "success") {
    return (
      <MobileLayout title="下单成功" showHeader={false}>
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
          <div className="relative mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-[bounce_0.5s_ease-in-out]">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="absolute inset-0 w-20 h-20 bg-green-200 rounded-full animate-ping opacity-30" />
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">订单提交成功！</h2>
          <p className="text-sm text-gray-500 mb-6 text-center">
            {resultData?.message || "订单正在等待审批"}
          </p>

          <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">订单编号</span>
              <span className="font-mono font-medium text-gray-900">
                {resultData?.orderNo}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">订单状态</span>
              <span className="text-amber-600 font-medium">
                {resultData?.status === "PENDING_APPROVAL" ? "待审批" : resultData?.status}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">预计审批</span>
              <span className="text-gray-700">
                {resultData?.estimatedApprovalTime || "5分钟内"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">客户</span>
              <span className="text-gray-700">{selectedCustomer?.name}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
              <span className="text-gray-500">订单金额</span>
              <span className="text-lg font-bold text-orange-500">
                ¥{totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={handleReset}
              className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium text-sm active:bg-orange-600 transition-colors shadow-sm"
            >
              继续下单
            </button>
            <button
              onClick={() => navigate("/mobile")}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm active:bg-gray-200 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  // 主表单页面
  return (
    <MobileLayout title="极速下单">
      <div className="px-4 py-4 space-y-4">
        <button
          onClick={() => navigate("/mobile")}
          className="flex items-center gap-1 text-sm text-gray-500 active:text-gray-700 -ml-1"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </button>

        {/* Step 1: 选择客户 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-900">选择客户</h3>
          </div>
          <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
            {MOCK_CUSTOMERS.map((customer) => (
              <button
                key={customer.id}
                onClick={() => setSelectedCustomerId(customer.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm",
                  selectedCustomerId === customer.id
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-100 bg-gray-50 text-gray-700 active:bg-gray-100"
                )}
              >
                <p className="font-medium">{customer.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {customer.contact} · {customer.phone}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: 选择商品 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900">商品明细</h3>
            </div>
            <button
              onClick={() => setShowProductPicker(!showProductPicker)}
              className="flex items-center gap-1 text-xs text-orange-500 font-medium active:text-orange-600"
            >
              <Plus className="w-3.5 h-3.5" />
              添加商品
            </button>
          </div>

          {showProductPicker && (
            <div className="p-3 border-b border-gray-50 bg-gray-50">
              <div className="grid grid-cols-2 gap-2">
                {MOCK_PRODUCTS.map((product) => {
                  const inCart = items.find((i) => i.productId === product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => addProduct(product)}
                      className={cn(
                        "text-left px-3 py-2 rounded-lg border text-sm transition-all",
                        inCart
                          ? "border-orange-300 bg-orange-50"
                          : "border-gray-200 bg-white active:bg-gray-100"
                      )}
                    >
                      <p className="font-medium text-gray-800 text-xs">{product.name}</p>
                      <p className="text-xs text-orange-500 mt-0.5">
                        ¥{product.price}/{product.unit}
                        {inCart && (
                          <span className="text-gray-400 ml-1">×{inCart.quantity}</span>
                        )}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-8 text-center">
              <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">点击"添加商品"选择商品</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.productId} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ¥{item.unitPrice}/{item.unit} ×{item.quantity} ={" "}
                      <span className="text-orange-500 font-medium">
                        ¥{(item.unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center active:bg-gray-100"
                    >
                      <Minus className="w-3 h-3 text-gray-500" />
                    </button>
                    <span className="text-sm font-bold text-gray-900 w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      className="w-7 h-7 rounded-full border border-orange-300 bg-orange-50 flex items-center justify-center active:bg-orange-100"
                    >
                      <Plus className="w-3 h-3 text-orange-500" />
                    </button>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="w-7 h-7 rounded-full flex items-center justify-center active:bg-red-50 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-300" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 备注 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            备注（选填）
          </label>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="如有特殊要求请在此备注..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all"
          />
        </div>

        {/* 错误提示 */}
        {submitState === "error" && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
        )}

        {/* 底部提交栏 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">
              共 {items.length} 种商品，
              {items.reduce((s, i) => s + i.quantity, 0)} 件
            </span>
            <span className="text-lg font-bold text-orange-500">
              ¥{totalAmount.toFixed(2)}
            </span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={
              !selectedCustomerId ||
              items.length === 0 ||
              submitState === "submitting"
            }
            className={cn(
              "w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
              !selectedCustomerId || items.length === 0
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : submitState === "submitting"
                ? "bg-orange-400 text-white cursor-wait"
                : "bg-orange-500 text-white active:bg-orange-600 shadow-sm shadow-orange-200"
            )}
          >
            {submitState === "submitting" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                确认下单
              </>
            )}
          </button>
        </div>
      </div>
    </MobileLayout>
  );
}
