/**
 * RC1 Epic 2: 移动端首页
 *
 * 对接 /api/mobile/v1/home 聚合接口
 * 展示：今日业绩概览 + 待办数量 + 最新消息 + 快捷入口
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  TrendingUp,
  ShoppingBag,
  ClipboardList,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertCircle,
  FileText,
  CreditCard,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HomeData {
  todayPerformance: {
    salesAmount: number;
    orderCount: number;
    achievementRate: number | null;
  };
  pendingTodos: {
    pendingApproval: number;
  };
  latestMessages: Array<{
    id: number;
    title: string;
    content: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

export default function MobileHome() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHomeData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch("/api/mobile/v1/home", {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError("登录已过期，请重新登录");
          return;
        }
        throw new Error(`请求失败 (${res.status})`);
      }

      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || "数据加载失败");
      }
    } catch (err: any) {
      setError(err.message || "网络异常，请稍后重试");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();
  }, [fetchHomeData]);

  const formatCurrency = (value: number) => {
    if (value >= 10000) {
      return `¥${(value / 10000).toFixed(1)}万`;
    }
    return `¥${value.toLocaleString()}`;
  };

  return (
    <MobileLayout title="千张销售">
      <div className="px-4 py-4 space-y-4">
        {/* 欢迎区 + 下拉刷新 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
            <h2 className="text-xl font-bold text-gray-900 mt-0.5">
              {user?.name ? `${user.name}，加油！` : "今日概览"}
            </h2>
          </div>
          <button
            onClick={() => fetchHomeData(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <RefreshCw
              className={cn(
                "w-5 h-5 text-gray-500",
                refreshing && "animate-spin"
              )}
            />
          </button>
        </div>

        {/* 加载状态 */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <p className="text-sm text-gray-400">正在加载数据...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">{error}</p>
              <button
                onClick={() => fetchHomeData()}
                className="text-sm text-red-500 underline mt-1"
              >
                点击重试
              </button>
            </div>
          </div>
        )}

        {/* 数据区 */}
        {data && (
          <>
            {/* 今日业绩卡片 */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-200">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">今日业绩</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold tracking-tight">
                    {formatCurrency(data.todayPerformance.salesAmount)}
                  </p>
                  <p className="text-xs opacity-75 mt-1">销售额</p>
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight">
                    {data.todayPerformance.orderCount}
                  </p>
                  <p className="text-xs opacity-75 mt-1">订单数</p>
                </div>
              </div>
              {data.todayPerformance.achievementRate !== null && (
                <div className="mt-4 pt-3 border-t border-white/20">
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-75">目标达成率</span>
                    <span className="font-bold">
                      {(data.todayPerformance.achievementRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          data.todayPerformance.achievementRate * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 待办 + 快捷入口 */}
            <div className="grid grid-cols-3 gap-3">
              <Link href="/mobile/quick-submit">
                <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100 active:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <ShoppingBag className="w-5 h-5 text-blue-500" />
                  </div>
                  <p className="text-xs text-gray-600 font-medium">极速下单</p>
                </div>
              </Link>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100 relative">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <ClipboardList className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-xs text-gray-600 font-medium">待审批</p>
                {data.pendingTodos.pendingApproval > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {data.pendingTodos.pendingApproval > 99
                      ? "99+"
                      : data.pendingTodos.pendingApproval}
                  </span>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 text-center shadow-sm border border-gray-100 active:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-xs text-gray-600 font-medium">我的业绩</p>
              </div>
            </div>

            {/* 更多快捷入口 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: FileText, label: "合同", color: "text-purple-500", bg: "bg-purple-50" },
                { icon: CreditCard, label: "回款", color: "text-teal-500", bg: "bg-teal-50" },
                { icon: TrendingUp, label: "提成", color: "text-pink-500", bg: "bg-pink-50" },
                { icon: ClipboardList, label: "更多", color: "text-gray-500", bg: "bg-gray-100" },
              ].map(({ icon: Icon, label, color, bg }) => (
                <div
                  key={label}
                  className="flex flex-col items-center py-3 rounded-xl active:bg-gray-50 transition-colors"
                >
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-1.5", bg)}>
                    <Icon className={cn("w-4 h-4", color)} />
                  </div>
                  <span className="text-[11px] text-gray-500">{label}</span>
                </div>
              ))}
            </div>

            {/* 最新消息 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">最新消息</h3>
                <Link href="/mobile/notifications">
                  <button className="flex items-center text-xs text-gray-400 hover:text-gray-600">
                    查看全部
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </Link>
              </div>
              {data.latestMessages.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400">暂无新消息</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {data.latestMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="px-4 py-3 flex items-start gap-3 active:bg-gray-50 transition-colors"
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          msg.isRead ? "bg-gray-200" : "bg-orange-500"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {msg.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {msg.content}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-300 shrink-0 mt-0.5">
                        {new Date(msg.createdAt).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
}
