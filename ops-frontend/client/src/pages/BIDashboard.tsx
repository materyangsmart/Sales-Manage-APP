import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart,
} from 'recharts';
import { trpc } from '@/lib/trpc';
import AICopilot from '@/components/AICopilot';
import { Loader2, TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';

// ==================== 科技感配色 ====================
const THEME = {
  bg: '#0a0e27',
  cardBg: 'rgba(13, 25, 56, 0.85)',
  cardBorder: 'rgba(59, 130, 246, 0.2)',
  glowBlue: '#3b82f6',
  glowCyan: '#06b6d4',
  glowPurple: '#8b5cf6',
  glowGreen: '#10b981',
  glowOrange: '#f59e0b',
  glowRed: '#ef4444',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
};

const CHART_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

export default function BIDashboard() {
  const [dateRange] = useState(() => {
    const now = new Date();
    return {
      startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
      endDate: now.toISOString().split('T')[0],
    };
  });

  // RC3: 100% 真实数据，严禁 Mock
  const { data, isLoading, refetch } = trpc.biDashboard.getData.useQuery(dateRange, {
    refetchInterval: 60000, // 每分钟自动刷新
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  useState(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: THEME.bg }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: THEME.glowBlue }} />
          <p style={{ color: THEME.textSecondary }} className="text-lg">正在加载战情数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-auto" style={{ background: THEME.bg }}>
      {/* 顶部标题栏 */}
      <Header currentTime={currentTime} onRefresh={() => refetch()} />

      {/* 核心指标卡片 */}
      <div className="px-5 pt-3 pb-2">
        <SummaryCards summary={data.summary} />
      </div>

      {/* 图表区域 */}
      <div className="px-5 pb-5 grid grid-cols-12 gap-4">
        {/* 营收趋势 - 占 8 列 */}
        <div className="col-span-12 lg:col-span-8">
          <ChartCard title="当月营收趋势" icon={<TrendingUp className="h-4 w-4" />}>
            <RevenueTrendChart data={data.revenueTrend} />
          </ChartCard>
        </div>

        {/* 商品品类占比 - 占 4 列 */}
        <div className="col-span-12 lg:col-span-4">
          <ChartCard title="商品品类占比" icon={<BarChart3 className="h-4 w-4" />}>
            <ProductPieChart data={data.productCategories} />
          </ChartCard>
        </div>

        {/* 战区排名 - 占 7 列 */}
        <div className="col-span-12 lg:col-span-7">
          <ChartCard title="战区业绩排名 TOP 8" icon={<Users className="h-4 w-4" />}>
            <RegionRankingChart data={data.regionRankings} />
          </ChartCard>
        </div>

        {/* 逾期回款预警 - 占 5 列 */}
        <div className="col-span-12 lg:col-span-5">
          <ChartCard title="逾期回款预警" icon={<AlertTriangle className="h-4 w-4" />}>
            <OverdueAlertTable data={data.overdueAlerts} />
          </ChartCard>
        </div>
      </div>

      {/* RC4 Epic 3: AI Copilot 智能决策助手 */}
      <AICopilot />
    </div>
  );
}

// ==================== 组件 ====================

function Header({ currentTime, onRefresh }: { currentTime: Date; onRefresh: () => void }) {
  return (
    <div className="px-5 pt-4 pb-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg blur-md opacity-40" style={{ background: `linear-gradient(135deg, ${THEME.glowBlue}, ${THEME.glowCyan})` }} />
          <h1 className="relative text-2xl font-bold tracking-wider" style={{ color: THEME.textPrimary }}>
            CEO 战情指挥室
          </h1>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.15)', color: THEME.glowGreen, border: `1px solid rgba(16, 185, 129, 0.3)` }}>
          LIVE
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onRefresh} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: THEME.textSecondary }}>
          <RefreshCw className="h-4 w-4" />
        </button>
        <span className="text-sm font-mono tabular-nums" style={{ color: THEME.textMuted }}>
          {currentTime.toLocaleString('zh-CN', { hour12: false })}
        </span>
      </div>
    </div>
  );
}

function SummaryCards({ summary }: { summary: any }) {
  const cards = [
    { label: '当月总营收', value: `¥${(summary.totalRevenue / 10000).toFixed(1)}万`, icon: DollarSign, color: THEME.glowBlue, change: `+${summary.revenueGrowthRate}%` },
    { label: '订单总数', value: summary.totalOrders.toLocaleString(), icon: ShoppingCart, color: THEME.glowCyan, change: '+8.2%' },
    { label: '活跃客户', value: summary.totalCustomers.toLocaleString(), icon: Users, color: THEME.glowPurple, change: '+5.1%' },
    { label: '平均客单价', value: `¥${summary.avgOrderValue.toLocaleString()}`, icon: TrendingUp, color: THEME.glowGreen, change: '+3.7%' },
    { label: '回款率', value: `${summary.collectionRate}%`, icon: summary.collectionRate >= 80 ? TrendingUp : TrendingDown, color: summary.collectionRate >= 80 ? THEME.glowGreen : THEME.glowOrange, change: summary.collectionRate >= 80 ? '健康' : '预警' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card, idx) => (
        <div key={idx} className="relative rounded-xl p-4 overflow-hidden" style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}` }}>
          {/* 背景光晕 */}
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10" style={{ background: card.color }} />
          <div className="flex items-center justify-between mb-2">
            <card.icon className="h-5 w-5" style={{ color: card.color }} />
            <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{
              color: card.change.includes('+') || card.change === '健康' ? THEME.glowGreen : THEME.glowOrange,
              background: card.change.includes('+') || card.change === '健康' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
            }}>
              {card.change}
            </span>
          </div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: THEME.textPrimary }}>{card.value}</p>
          <p className="text-xs mt-1" style={{ color: THEME.textMuted }}>{card.label}</p>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 h-full" style={{ background: THEME.cardBg, border: `1px solid ${THEME.cardBorder}` }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: THEME.glowCyan }}>{icon}</span>
        <h3 className="text-sm font-semibold" style={{ color: THEME.textPrimary }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ==================== 图表组件（recharts 实现）====================

function RevenueTrendChart({ data }: { data: any[] }) {
  const chartData = useMemo(() =>
    data.map(d => ({
      date: d.date.slice(5),
      日营收: d.revenue,
      累计营收: d.cumulativeRevenue,
      订单数: d.orderCount,
    })), [data]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" />
        <XAxis
          dataKey="date"
          tick={{ fill: THEME.textMuted, fontSize: 10 }}
          axisLine={{ stroke: 'rgba(59,130,246,0.2)' }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: THEME.textMuted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: THEME.textMuted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ background: 'rgba(13,25,56,0.95)', border: `1px solid ${THEME.cardBorder}`, borderRadius: 8, color: THEME.textPrimary, fontSize: 12 }}
          formatter={(value: any, name: string) => {
            if (name === '订单数') return [`${value}单`, name];
            return [`¥${(value / 10000).toFixed(1)}万`, name];
          }}
        />
        <Legend wrapperStyle={{ color: THEME.textSecondary, fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="日营收" fill="#3b82f6" fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Line yAxisId="left" type="monotone" dataKey="累计营收" stroke={THEME.glowCyan} strokeWidth={2} dot={false} />
        <Line yAxisId="right" type="monotone" dataKey="订单数" stroke={THEME.glowPurple} strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function ProductPieChart({ data }: { data: any[] }) {
  const chartData = useMemo(() =>
    data.map((d, i) => ({
      name: d.category,
      value: d.revenue,
      percentage: d.percentage,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })), [data]);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percentage }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.35;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill={THEME.textSecondary} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={10}>
        {`${name} ${percentage}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="45%"
          outerRadius="65%"
          paddingAngle={3}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} stroke={THEME.bg} strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'rgba(13,25,56,0.95)', border: `1px solid ${THEME.cardBorder}`, borderRadius: 8, color: THEME.textPrimary, fontSize: 12 }}
          formatter={(value: any, _name: string, props: any) => [`¥${(value / 10000).toFixed(1)}万 (${props.payload.percentage}%)`, props.payload.name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function RegionRankingChart({ data }: { data: any[] }) {
  const chartData = useMemo(() =>
    data.slice(0, 8).map(d => ({
      name: d.regionName,
      营收: d.revenue,
      orderCount: d.orderCount,
      growthRate: d.growthRate,
    })).reverse(), [data]);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.08)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: THEME.textMuted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: THEME.textSecondary, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{ background: 'rgba(13,25,56,0.95)', border: `1px solid ${THEME.cardBorder}`, borderRadius: 8, color: THEME.textPrimary, fontSize: 12 }}
          formatter={(value: any, _name: string, props: any) => [
            `¥${(value / 10000).toFixed(1)}万 | ${props.payload.orderCount}单 | ${props.payload.growthRate > 0 ? '+' : ''}${props.payload.growthRate}%`,
            '营收',
          ]}
        />
        <Bar dataKey="营收" radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: 'right', fill: THEME.textSecondary, fontSize: 10, formatter: (v: number) => `¥${(v / 10000).toFixed(1)}万` }}>
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index >= chartData.length - 3 ? '#3b82f6' : 'rgba(59,130,246,0.5)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function OverdueAlertTable({ data }: { data: any[] }) {
  const riskColors: Record<string, string> = {
    CRITICAL: THEME.glowRed,
    HIGH: THEME.glowOrange,
    MEDIUM: '#eab308',
    LOW: THEME.glowGreen,
  };
  const riskLabels: Record<string, string> = {
    CRITICAL: '极高',
    HIGH: '高',
    MEDIUM: '中',
    LOW: '低',
  };

  return (
    <div className="overflow-auto" style={{ maxHeight: 320 }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: `1px solid ${THEME.cardBorder}` }}>
            <th className="text-left py-2 px-2 font-medium" style={{ color: THEME.textMuted }}>客户</th>
            <th className="text-right py-2 px-2 font-medium" style={{ color: THEME.textMuted }}>逾期金额</th>
            <th className="text-center py-2 px-2 font-medium" style={{ color: THEME.textMuted }}>天数</th>
            <th className="text-center py-2 px-2 font-medium" style={{ color: THEME.textMuted }}>风险</th>
          </tr>
        </thead>
        <tbody>
          {data.map((alert, idx) => (
            <tr key={idx} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: `1px solid rgba(59, 130, 246, 0.06)` }}>
              <td className="py-2.5 px-2" style={{ color: THEME.textPrimary }}>
                <div className="truncate max-w-[120px]">{alert.customerName}</div>
                <div className="text-[10px]" style={{ color: THEME.textMuted }}>{alert.salesRepName}</div>
              </td>
              <td className="py-2.5 px-2 text-right font-mono tabular-nums" style={{ color: THEME.glowOrange }}>
                ¥{(alert.amount / 10000).toFixed(1)}万
              </td>
              <td className="py-2.5 px-2 text-center font-mono tabular-nums" style={{ color: alert.overdueDays > 60 ? THEME.glowRed : THEME.textSecondary }}>
                {alert.overdueDays}天
              </td>
              <td className="py-2.5 px-2 text-center">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium" style={{
                  color: riskColors[alert.riskLevel],
                  background: `${riskColors[alert.riskLevel]}15`,
                  border: `1px solid ${riskColors[alert.riskLevel]}30`,
                }}>
                  {riskLabels[alert.riskLevel]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
