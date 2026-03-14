import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AlertTriangle, TrendingDown, DollarSign, Clock } from "lucide-react";

// 账龄区间颜色映射
const BUCKET_COLORS: Record<string, string> = {
  CURRENT: "#22c55e",
  "1_30_DAYS": "#eab308",
  "31_60_DAYS": "#f97316",
  "61_90_DAYS": "#ef4444",
  "90_PLUS_DAYS": "#7f1d1d",
};

const BUCKET_LABELS: Record<string, string> = {
  CURRENT: "未逾期",
  "1_30_DAYS": "1-30天",
  "31_60_DAYS": "31-60天",
  "61_90_DAYS": "61-90天",
  "90_PLUS_DAYS": "90+天",
};

function formatAmount(amount: number): string {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(1)}万`;
  }
  return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
}

function RiskBadge({ level }: { level: "HIGH" | "MEDIUM" | "LOW" }) {
  const variants = {
    HIGH: "destructive",
    MEDIUM: "secondary",
    LOW: "outline",
  } as const;
  const labels = { HIGH: "高风险", MEDIUM: "中风险", LOW: "低风险" };
  return <Badge variant={variants[level]}>{labels[level]}</Badge>;
}

export default function ArAging() {
  const [asOfDate, setAsOfDate] = useState<string>("");
  const [queryDate, setQueryDate] = useState<string | undefined>(undefined);

  const { data: report, isLoading, refetch } = trpc.arAging.getReport.useQuery(
    { asOfDate: queryDate },
    { staleTime: 30_000 }
  );

  const handleQuery = () => {
    setQueryDate(asOfDate || undefined);
  };

  // 柱状图数据
  const barData = useMemo(() => {
    if (!report) return [];
    return report.buckets.map((b) => ({
      name: BUCKET_LABELS[b.bucket] ?? b.label,
      金额: b.totalOutstanding,
      笔数: b.count,
      fill: BUCKET_COLORS[b.bucket] ?? "#6b7280",
    }));
  }, [report]);

  // 饼图数据（仅展示有金额的分桶）
  const pieData = useMemo(() => {
    if (!report) return [];
    return report.buckets
      .filter((b) => b.totalOutstanding > 0)
      .map((b) => ({
        name: BUCKET_LABELS[b.bucket] ?? b.label,
        value: b.totalOutstanding,
        fill: BUCKET_COLORS[b.bucket] ?? "#6b7280",
      }));
  }, [report]);

  // 逾期总额（排除 CURRENT）
  const overdueTotal = useMemo(() => {
    if (!report) return 0;
    return report.buckets
      .filter((b) => b.bucket !== "CURRENT")
      .reduce((sum, b) => sum + b.totalOutstanding, 0);
  }, [report]);

  const highRiskTotal = useMemo(() => {
    if (!report) return 0;
    return report.buckets
      .filter((b) => b.bucket === "90_PLUS_DAYS")
      .reduce((sum, b) => sum + b.totalOutstanding, 0);
  }, [report]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              应收账款账龄分析
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AR Aging Analysis — 实时监控坏账风险
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-44"
              placeholder="基准日期（默认今天）"
            />
            <Button onClick={handleQuery} variant="default">
              查询
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            正在加载账龄数据...
          </div>
        ) : !report ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            暂无数据
          </div>
        ) : (
          <>
            {/* KPI 卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">应收总额</p>
                      <p className="text-xl font-bold">
                        {formatAmount(report.totalOutstanding)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-yellow-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">逾期总额</p>
                      <p className="text-xl font-bold text-yellow-600">
                        {formatAmount(overdueTotal)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        90+天高风险
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {formatAmount(highRiskTotal)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">账单总数</p>
                      <p className="text-xl font-bold">
                        {report.totalStatements}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 图表区域 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 柱状图 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">账龄分布（金额）</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(v) =>
                          v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
                        }
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `¥${value.toLocaleString("zh-CN")}`,
                          "应收金额",
                        ]}
                      />
                      <Bar dataKey="金额" radius={[4, 4, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 饼图 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">账龄占比</CardTitle>
                </CardHeader>
                <CardContent>
                  {pieData.length === 0 ? (
                    <div className="flex items-center justify-center h-[260px] text-muted-foreground">
                      暂无未核销账单
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} ${(percent * 100).toFixed(1)}%`
                          }
                          labelLine={false}
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip
                          formatter={(value: number) => [
                            `¥${value.toLocaleString("zh-CN")}`,
                            "应收金额",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 高风险客户列表 */}
            {report.topRiskyCustomers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    高风险客户（逾期 30 天以上）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>客户名称</TableHead>
                        <TableHead className="text-right">逾期应收</TableHead>
                        <TableHead className="text-right">最大逾期天数</TableHead>
                        <TableHead>风险等级</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topRiskyCustomers.map((c) => (
                        <TableRow key={c.customerId}>
                          <TableCell className="font-medium">
                            {c.customerName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatAmount(c.totalOutstanding)}
                          </TableCell>
                          <TableCell className="text-right">
                            {c.maxOverdueDays} 天
                          </TableCell>
                          <TableCell>
                            <RiskBadge level={c.riskLevel} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* 明细表 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">账单明细</CardTitle>
              </CardHeader>
              <CardContent>
                {report.details.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无未核销账单
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>客户名称</TableHead>
                        <TableHead>账期</TableHead>
                        <TableHead>到期日</TableHead>
                        <TableHead className="text-right">未核销金额</TableHead>
                        <TableHead className="text-right">逾期天数</TableHead>
                        <TableHead>账龄区间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.details.slice(0, 50).map((d, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {d.customerName}
                          </TableCell>
                          <TableCell>{d.period}</TableCell>
                          <TableCell>{d.dueDate}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatAmount(d.outstandingAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {d.overdueDays > 0 ? (
                              <span className="text-red-600">
                                {d.overdueDays} 天
                              </span>
                            ) : (
                              <span className="text-green-600">未逾期</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                              style={{
                                backgroundColor:
                                  BUCKET_COLORS[d.bucket] ?? "#6b7280",
                              }}
                            >
                              {BUCKET_LABELS[d.bucket] ?? d.bucket}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
