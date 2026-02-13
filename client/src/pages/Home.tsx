import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, Package, FileText, CreditCard, Receipt, Search, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const features = [
    {
      title: "订单审核",
      description: "审核待处理的订单，支持批准或拒绝",
      icon: ClipboardCheck,
      href: "/orders/review",
      color: "text-blue-500",
    },
    {
      title: "订单履行",
      description: "履行已审核订单，生成应收发票",
      icon: Package,
      href: "/orders/fulfill",
      color: "text-green-500",
    },
    {
      title: "发票管理",
      description: "管理应收发票，查看发票状态和余额",
      icon: FileText,
      href: "/ar/invoices",
      color: "text-purple-500",
    },
    {
      title: "收款管理",
      description: "管理客户收款记录，查看核销状态",
      icon: CreditCard,
      href: "/ar/payments",
      color: "text-orange-500",
    },
    {
      title: "核销操作",
      description: "将收款与发票进行核销，更新余额",
      icon: Receipt,
      href: "/ar/apply",
      color: "text-pink-500",
    },
    {
      title: "审计日志",
      description: "查询系统操作记录，追踪业务流程",
      icon: Search,
      href: "/audit/logs",
      color: "text-cyan-500",
    },
    {
      title: "提成查询",
      description: "查询KPI指标和提成计算结果",
      icon: TrendingUp,
      href: "/commission/stats",
      color: "text-emerald-500",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">欢迎使用千张销售管理系统</h1>
          <p className="text-muted-foreground mt-2">
            内部中台工作台 - 管理订单审核、履行、应收账款和审计查询
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-muted ${feature.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>快速开始</CardTitle>
            <CardDescription>了解如何使用本系统完成完整的业务流程</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">业务流程：</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>在<strong>订单审核</strong>页面审核待处理的订单</li>
                <li>在<strong>订单履行</strong>页面履行已审核订单，系统自动生成发票</li>
                <li>在<strong>发票管理</strong>页面查看生成的发票</li>
                <li>在<strong>收款管理</strong>页面查看客户收款记录</li>
                <li>在<strong>核销操作</strong>页面将收款与发票进行核销</li>
                <li>在<strong>审计日志</strong>页面查看所有操作记录</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
