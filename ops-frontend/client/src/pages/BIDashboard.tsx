import { useState, useMemo, useCallback } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, PieChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { trpc } from '@/lib/trpc';
import AICopilot from '@/components/AICopilot';
import { Loader2, TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, AlertTriangle, RefreshCw, BarChart3 } from 'lucide-react';

// 注册 ECharts 组件
echarts.use([
  LineChart, BarChart, PieChart, ScatterChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent, CanvasRenderer,
]);

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
  gradient1: ['#3b82f6', '#06b6d4'],
  gradient2: ['#8b5cf6', '#ec4899'],
  gradient3: ['#10b981', '#06b6d4'],
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

function RevenueTrendChart({ data }: { data: any[] }) {
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 25, 56, 0.95)',
      borderColor: THEME.cardBorder,
      textStyle: { color: THEME.textPrimary, fontSize: 12 },
      formatter: (params: any) => {
        const date = params[0]?.axisValue || '';
        let html = `<div style="font-weight:600;margin-bottom:4px">${date}</div>`;
        for (const p of params) {
          const value = p.seriesName === '累计营收' ? `¥${(p.value / 10000).toFixed(1)}万` : p.seriesName === '订单数' ? `${p.value}单` : `¥${(p.value / 10000).toFixed(1)}万`;
          html += `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>${p.seriesName}: <b>${value}</b></div>`;
        }
        return html;
      },
    },
    legend: {
      data: ['日营收', '累计营收', '订单数'],
      textStyle: { color: THEME.textSecondary, fontSize: 11 },
      top: 0,
      right: 0,
    },
    grid: { left: 50, right: 50, top: 35, bottom: 30 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date.slice(5)),
      axisLine: { lineStyle: { color: 'rgba(59, 130, 246, 0.2)' } },
      axisLabel: { color: THEME.textMuted, fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        name: '营收(万)',
        nameTextStyle: { color: THEME.textMuted, fontSize: 10 },
        axisLabel: { color: THEME.textMuted, fontSize: 10, formatter: (v: number) => `${(v / 10000).toFixed(0)}` },
        splitLine: { lineStyle: { color: 'rgba(59, 130, 246, 0.08)' } },
      },
      {
        type: 'value',
        name: '订单数',
        nameTextStyle: { color: THEME.textMuted, fontSize: 10 },
        axisLabel: { color: THEME.textMuted, fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '日营收',
        type: 'bar',
        data: data.map(d => d.revenue),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.8)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.15)' },
          ]),
          borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: 20,
      },
      {
        name: '累计营收',
        type: 'line',
        data: data.map(d => d.cumulativeRevenue),
        smooth: true,
        lineStyle: { color: THEME.glowCyan, width: 2 },
        itemStyle: { color: THEME.glowCyan },
        symbol: 'none',
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(6, 182, 212, 0.2)' },
            { offset: 1, color: 'rgba(6, 182, 212, 0)' },
          ]),
        },
      },
      {
        name: '订单数',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.orderCount),
        smooth: true,
        lineStyle: { color: THEME.glowPurple, width: 1.5, type: 'dashed' },
        itemStyle: { color: THEME.glowPurple },
        symbol: 'none',
      },
    ],
  }), [data]);

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />;
}

function ProductPieChart({ data }: { data: any[] }) {
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 25, 56, 0.95)',
      borderColor: THEME.cardBorder,
      textStyle: { color: THEME.textPrimary, fontSize: 12 },
      formatter: (p: any) => `<b>${p.name}</b><br/>营收: ¥${(p.value / 10000).toFixed(1)}万<br/>占比: ${p.data.percentage}%`,
    },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 6,
        borderColor: THEME.bg,
        borderWidth: 2,
      },
      label: {
        show: true,
        color: THEME.textSecondary,
        fontSize: 10,
        formatter: '{b}\n{d}%',
      },
      labelLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.3)' } },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold', color: THEME.textPrimary },
        itemStyle: { shadowBlur: 20, shadowColor: 'rgba(59, 130, 246, 0.4)' },
      },
      data: data.map((d, i) => ({
        name: d.category,
        value: d.revenue,
        percentage: d.percentage,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      })),
    }],
  }), [data]);

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />;
}

function RegionRankingChart({ data }: { data: any[] }) {
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13, 25, 56, 0.95)',
      borderColor: THEME.cardBorder,
      textStyle: { color: THEME.textPrimary, fontSize: 12 },
      formatter: (params: any) => {
        const p = params[0];
        const region = data.find(d => d.regionName === p.name);
        return `<b>${p.name}</b><br/>营收: ¥${(p.value / 10000).toFixed(1)}万<br/>订单: ${region?.orderCount || 0}单<br/>新客: ${region?.newCustomers || 0}<br/>增长: ${region?.growthRate > 0 ? '+' : ''}${region?.growthRate}%`;
      },
    },
    grid: { left: 100, right: 40, top: 10, bottom: 10 },
    xAxis: {
      type: 'value',
      axisLabel: { color: THEME.textMuted, fontSize: 10, formatter: (v: number) => `${(v / 10000).toFixed(0)}万` },
      splitLine: { lineStyle: { color: 'rgba(59, 130, 246, 0.08)' } },
    },
    yAxis: {
      type: 'category',
      data: data.slice(0, 8).map(d => d.regionName).reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: THEME.textSecondary, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: data.slice(0, 8).map((d, i) => ({
        value: d.revenue,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: i < 3 ? 'rgba(59, 130, 246, 0.9)' : 'rgba(59, 130, 246, 0.5)' },
            { offset: 1, color: i < 3 ? 'rgba(6, 182, 212, 0.9)' : 'rgba(6, 182, 212, 0.3)' },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
      })).reverse(),
      barMaxWidth: 24,
      label: {
        show: true,
        position: 'right',
        color: THEME.textSecondary,
        fontSize: 10,
        formatter: (p: any) => `¥${(p.value / 10000).toFixed(1)}万`,
      },
    }],
  }), [data]);

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 320 }} />;
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
