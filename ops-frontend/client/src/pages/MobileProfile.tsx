/**
 * RC1 Epic 2: 移动端个人中心页面
 */

import MobileLayout from "@/components/MobileLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  User,
  ChevronRight,
  BarChart3,
  CreditCard,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MENU_SECTIONS = [
  {
    title: "业务",
    items: [
      { icon: BarChart3, label: "我的业绩", href: "/sales/my-performance", color: "text-blue-500", bg: "bg-blue-50" },
      { icon: CreditCard, label: "提成明细", href: "/commission/stats", color: "text-green-500", bg: "bg-green-50" },
      { icon: FileText, label: "我的订单", href: "/orders/review", color: "text-purple-500", bg: "bg-purple-50" },
    ],
  },
  {
    title: "设置",
    items: [
      { icon: Shield, label: "账号安全", href: "#", color: "text-amber-500", bg: "bg-amber-50" },
      { icon: Settings, label: "通知设置", href: "#", color: "text-gray-500", bg: "bg-gray-100" },
      { icon: HelpCircle, label: "帮助与反馈", href: "#", color: "text-teal-500", bg: "bg-teal-50" },
    ],
  },
];

export default function MobileProfile() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (confirm("确定要退出登录吗？")) {
      logout();
    }
  };

  return (
    <MobileLayout title="我的">
      <div className="px-4 py-4 space-y-4">
        {/* 用户信息卡片 */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center ring-2 ring-white/20">
                <User className="w-7 h-7 text-white/70" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{user?.name || "未登录"}</h2>
              <p className="text-sm text-white/60 mt-0.5">
                {user?.role === "admin" ? "管理员" : "销售员"}
              </p>
            </div>
          </div>
        </div>

        {/* 菜单区 */}
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-50">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </h3>
            </div>
            <div className="divide-y divide-gray-50">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors"
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", item.bg)}>
                      <Icon className={cn("w-4 h-4", item.color)} />
                    </div>
                    <span className="flex-1 text-sm text-gray-700 font-medium">
                      {item.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </a>
                );
              })}
            </div>
          </div>
        ))}

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          className="w-full bg-white rounded-xl border border-gray-100 shadow-sm py-3 flex items-center justify-center gap-2 text-sm text-red-500 font-medium active:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>

        {/* 版本信息 */}
        <p className="text-center text-[10px] text-gray-300 pb-4">
          千张销售管理系统 v1.0.0-RC1
        </p>
      </div>
    </MobileLayout>
  );
}
