/**
 * RC1 Epic 2: 移动端通知页面
 */

import { useState } from "react";
import MobileLayout from "@/components/MobileLayout";
import { Bell, CheckCheck, Clock, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: number;
  title: string;
  content: string;
  type: "info" | "warning" | "approval" | "system";
  isRead: boolean;
  createdAt: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    title: "订单审批通知",
    content: "您提交的订单 QS20260228001 已通过审批，请及时安排发货。",
    type: "approval",
    isRead: false,
    createdAt: "2026-02-28T10:30:00Z",
  },
  {
    id: 2,
    title: "回款提醒",
    content: "客户「张记菜市场」有一笔 ¥3,200 的回款已到账，请核实。",
    type: "info",
    isRead: false,
    createdAt: "2026-02-28T09:15:00Z",
  },
  {
    id: 3,
    title: "信用预警",
    content: "客户「李记批发部」信用额度使用率已达 90%，请关注风险。",
    type: "warning",
    isRead: true,
    createdAt: "2026-02-27T16:45:00Z",
  },
  {
    id: 4,
    title: "系统维护通知",
    content: "系统将于今晚 23:00-01:00 进行例行维护，届时部分功能可能受影响。",
    type: "system",
    isRead: true,
    createdAt: "2026-02-27T14:00:00Z",
  },
  {
    id: 5,
    title: "月度提成结算",
    content: "2026年1月提成已结算完毕，本月提成金额 ¥2,050，请查看明细。",
    type: "info",
    isRead: true,
    createdAt: "2026-02-01T08:00:00Z",
  },
];

const TYPE_CONFIG = {
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-50" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50" },
  approval: { icon: CheckCheck, color: "text-green-500", bg: "bg-green-50" },
  system: { icon: Bell, color: "text-gray-500", bg: "bg-gray-100" },
};

export default function MobileNotifications() {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "刚刚";
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  return (
    <MobileLayout title="消息中心">
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} 条未读消息` : "全部已读"}
          </p>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-orange-500 font-medium active:text-orange-600"
            >
              全部标为已读
            </button>
          )}
        </div>

        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type];
            const Icon = config.icon;
            return (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={cn(
                  "bg-white rounded-xl border shadow-sm p-4 transition-all active:bg-gray-50",
                  notification.isRead ? "border-gray-100" : "border-orange-200 bg-orange-50/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={cn(
                        "text-sm truncate",
                        notification.isRead ? "text-gray-700 font-medium" : "text-gray-900 font-semibold"
                      )}>
                        {notification.title}
                      </h4>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span className="text-[10px] text-gray-400">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {notifications.length === 0 && (
          <div className="py-20 text-center">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无消息</p>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
