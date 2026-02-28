/**
 * RC1 Epic 2: 移动端布局组件
 *
 * 特性：
 * - 无侧边栏，适配手机竖屏（max-w-md 居中）
 * - 底部 Tab 导航（首页 / 下单 / 消息 / 我的）
 * - 顶部状态栏（标题 + 铃铛图标）
 * - safe-area 适配（iOS 底部安全区）
 */

import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, Bell, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showHeader?: boolean;
}

const TAB_ITEMS = [
  { href: "/mobile", label: "首页", icon: Home, exact: true },
  { href: "/mobile/quick-submit", label: "下单", icon: ShoppingCart, exact: false },
  { href: "/mobile/notifications", label: "消息", icon: Bell, exact: false },
  { href: "/mobile/profile", label: "我的", icon: User, exact: false },
] as const;

export default function MobileLayout({
  children,
  title = "千张销售",
  showHeader = true,
}: MobileLayoutProps) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50 max-w-md mx-auto relative">
      {/* 顶部导航栏 */}
      {showHeader && (
        <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-4 h-12">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">{title}</h1>
            <Link href="/mobile/notifications">
              <button className="relative p-2 -mr-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
              </button>
            </Link>
          </div>
        </header>
      )}

      {/* 页面内容区 */}
      <main className="flex-1 overflow-y-auto pb-[72px]">
        {children}
      </main>

      {/* 底部 Tab 导航 */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-[56px]">
          {TAB_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const isActive = exact
              ? location === href
              : location === href || location.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 w-16 h-full rounded-lg transition-all active:scale-95",
                    isActive
                      ? "text-orange-500"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-transform duration-200",
                      isActive && "scale-110"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={cn(
                    "text-[10px] leading-tight",
                    isActive ? "font-semibold" : "font-medium"
                  )}>{label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
