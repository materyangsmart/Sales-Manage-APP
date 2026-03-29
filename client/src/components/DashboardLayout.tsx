import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
// OAuth 开关：VITE_ENABLE_OAUTH=true 时使用 OAuth，否则使用本地登录
const ENABLE_OAUTH = import.meta.env.VITE_ENABLE_OAUTH === 'true';
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard, LogOut, PanelLeft, Users, ClipboardCheck, Package,
  FileText, CreditCard, Receipt, Search, TrendingUp, Settings,
  ShoppingCart, Kanban, Warehouse, BadgeDollarSign, Trophy, BarChart3,
  ClipboardList, UserCog, type LucideIcon,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { ROLE_LABELS, type AppRole } from "@shared/rbac";
import { Badge } from "./ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";

/** lucide icon name → component 映射 */
const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardCheck, ShoppingCart, Package, Kanban, Warehouse,
  FileText, CreditCard, Receipt, TrendingUp, Settings,
  Search, BadgeDollarSign, Trophy, ClipboardList, BarChart3,
  LayoutDashboard, Users, UserCog,
};

/** 菜单项定义（含角色权限） */
interface MenuItemDef {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: AppRole[];
  group?: string;
}

/** 全部菜单项（按业务分组） */
const ALL_MENU_ITEMS: MenuItemDef[] = [
  // 销售模块
  { icon: ClipboardCheck, label: "订单审核", path: "/orders/review", roles: ['admin', 'sales', 'fulfillment'], group: "销售" },
  { icon: ShoppingCart, label: "代客下单", path: "/orders/create", roles: ['admin', 'sales'], group: "销售" },
  { icon: TrendingUp, label: "提成查询", path: "/commission/stats", roles: ['admin', 'sales'], group: "销售" },
  { icon: Settings, label: "提成规则", path: "/commission/rules", roles: ['admin', 'sales'], group: "销售" },
  { icon: BadgeDollarSign, label: "费用报销", path: "/expense/claim", roles: ['admin', 'sales'], group: "销售" },
  { icon: Trophy, label: "销售KPI看板", path: "/admin/sales-performance", roles: ['admin', 'sales'], group: "销售" },

  // 交付/履约模块
  { icon: Package, label: "订单履行", path: "/orders/fulfill", roles: ['admin', 'fulfillment'], group: "交付" },
  { icon: Kanban, label: "履约看板", path: "/orders/fulfillment", roles: ['admin', 'fulfillment'], group: "交付" },
  { icon: Warehouse, label: "库存管理", path: "/admin/inventory", roles: ['admin', 'fulfillment'], group: "交付" },

  // 财务模块
  { icon: FileText, label: "发票管理", path: "/ar/invoices", roles: ['admin', 'finance'], group: "财务" },
  { icon: CreditCard, label: "收款管理", path: "/ar/payments", roles: ['admin', 'finance'], group: "财务" },
  { icon: Receipt, label: "核销操作", path: "/ar/apply", roles: ['admin', 'finance'], group: "财务" },
  { icon: ClipboardList, label: "财务审核台", path: "/finance/expenses", roles: ['admin', 'finance'], group: "财务" },
  { icon: BarChart3, label: "应收账龄", path: "/finance/ar-aging", roles: ['admin', 'finance'], group: "财务" },

  // 审计/纪检模块
  { icon: Search, label: "审计日志", path: "/audit/logs", roles: ['admin', 'auditor'], group: "审计" },
];

/** 管理员专属菜单 */
const ADMIN_MENU_ITEMS: MenuItemDef[] = [
  { icon: UserCog, label: "用户管理", path: "/admin/users", roles: ['admin'], group: "系统管理" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

/** 根据用户角色过滤菜单项 */
function filterMenuByRole(items: MenuItemDef[], role: string): MenuItemDef[] {
  if (role === 'admin') return items; // admin 看到所有
  return items.filter(item => item.roles.includes(role as AppRole));
}

/** 角色 Badge 颜色 */
function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'admin': return 'destructive';
    case 'sales': return 'default';
    case 'finance': return 'secondary';
    default: return 'outline';
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    // 未登录时直接跳转到 /login 页面
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // 根据用户角色动态过滤菜单
  const userRole = user?.role || 'user';
  const visibleMenuItems = useMemo(
    () => filterMenuByRole(ALL_MENU_ITEMS, userRole),
    [userRole]
  );
  const visibleAdminItems = useMemo(
    () => filterMenuByRole(ADMIN_MENU_ITEMS, userRole),
    [userRole]
  );

  // 按 group 分组
  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItemDef[]> = {};
    for (const item of visibleMenuItems) {
      const g = item.group || '其他';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    }
    return groups;
  }, [visibleMenuItems]);

  const allItems = [...visibleMenuItems, ...visibleAdminItems];
  const activeMenuItem = allItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    千张销售管理
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {/* 按业务分组渲染菜单 */}
            {Object.entries(groupedItems).map(([groupName, items]) => (
              <div key={groupName}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">
                    {groupName}
                  </span>
                </div>
                <SidebarMenu className="px-2 py-1">
                  {items.map(item => {
                    const isActive = location === item.path;
                    const IconComp = item.icon;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <IconComp
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}

            {/* 管理员专属菜单 */}
            {visibleAdminItems.length > 0 && (
              <>
                <div className="px-4 pt-4 pb-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-data-[collapsible=icon]:hidden">系统管理</span>
                </div>
                <SidebarMenu className="px-2 py-1">
                  {visibleAdminItems.map(item => {
                    const isActive = location === item.path;
                    const IconComp = item.icon;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-normal`}
                        >
                          <IconComp
                            className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <Badge variant={getRoleBadgeVariant(userRole)} className="text-[10px] px-1.5 py-0 h-4">
                        {ROLE_LABELS[userRole as AppRole] || userRole}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
