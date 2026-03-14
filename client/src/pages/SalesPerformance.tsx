/**
 * 销售铁军 KPI 实时看板 (Sales Performance Dashboard)
 * Mega-Sprint 7 Epic 4
 *
 * 路由: /admin/sales-performance
 * 功能：
 * 1. 仪表盘（SVG Gauge）展示营收/回款/新客完成率
 * 2. 个人 KPI 进度条排行
 * 3. 战区汇总对比
 * 4. 月度目标设置（管理员）
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Target,
  TrendingUp,
  Users,
  DollarSign,
  Trophy,
  Settings,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Minus,
} from "lucide-react";

// ─── SVG 仪表盘 Gauge 组件 ────────────────────────────────────────────────────
function GaugeChart({
  value,
  label,
  color = "#3b82f6",
  size = 140,
}: {
  value: number; // 0-150
  label: string;
  color?: string;
  size?: number;
}) {
  const clampedValue = Math.min(Math.max(value, 0), 150);
  const percentage = clampedValue / 150;

  // 仪表盘参数（半圆，从 -180° 到 0°）
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.38;
  const strokeWidth = size * 0.1;
  const startAngle = -180;
  const endAngle = 0;
  const totalAngle = endAngle - startAngle; // 180°

  // 将角度转换为坐标
  const polarToCartesian = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const valueAngle = startAngle + percentage * totalAngle;

  // 颜色根据进度
  const getColor = () => {
    if (clampedValue >= 100) return "#22c55e"; // 绿色：完成
    if (clampedValue >= 70) return "#f59e0b";  // 黄色：进行中
    return "#ef4444";                           // 红色：落后
  };
  const activeColor = getColor();

  // 指针坐标
  const needleAngle = startAngle + percentage * totalAngle;
  const needleRad = ((needleAngle - 90) * Math.PI) / 180;
  const needleLen = r * 0.85;
  const needleX = cx + needleLen * Math.cos(needleRad);
  const needleY = cy + needleLen * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
        {/* 背景弧 */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* 进度弧 */}
        {clampedValue > 0 && (
          <path
            d={describeArc(startAngle, valueAngle)}
            fill="none"
            stroke={activeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* 指针 */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#374151"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={4} fill="#374151" />
        {/* 数值 */}
        <text
          x={cx}
          y={cy - r * 0.25}
          textAnchor="middle"
          fontSize={size * 0.14}
          fontWeight="bold"
          fill={activeColor}
        >
          {clampedValue.toFixed(1)}%
        </text>
      </svg>
      <span className="text-xs font-medium text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

// ─── 进度条组件 ───────────────────────────────────────────────────────────────
function ProgressBar({
  value,
  max = 100,
  label,
  sublabel,
  rank,
}: {
  value: number;
  max?: number;
  label: string;
  sublabel?: string;
  rank?: number;
}) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 150);
  const getColor = () => {
    if (pct >= 100) return "bg-green-500";
    if (pct >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="flex items-center gap-3">
      {rank !== undefined && (
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          rank === 1 ? "bg-yellow-400 text-yellow-900" :
          rank === 2 ? "bg-gray-300 text-gray-700" :
          rank === 3 ? "bg-amber-600 text-white" :
          "bg-muted text-muted-foreground"
        }`}>
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{pct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${getColor()}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

// ─── 个人 KPI 卡片 ────────────────────────────────────────────────────────────
function PersonalKPICard({ item, rank }: { item: any; rank: number }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
              rank === 1 ? "bg-yellow-400 text-yellow-900" :
              rank === 2 ? "bg-gray-300 text-gray-700" :
              rank === 3 ? "bg-amber-600 text-white" :
              "bg-muted text-muted-foreground"
            }`}>{rank}</span>
            <div>
              <p className="font-semibold text-sm">{item.salesRepName}</p>
              {item.regionName && <p className="text-xs text-muted-foreground">{item.regionName}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">营收完成</p>
            <p className={`text-lg font-bold ${item.revenueProgress >= 100 ? "text-green-600" : item.revenueProgress >= 70 ? "text-amber-600" : "text-red-600"}`}>
              {item.revenueProgress.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* 三个仪表盘 */}
        <div className="grid grid-cols-3 gap-1 mb-3">
          <GaugeChart value={item.revenueProgress} label="营收" size={90} />
          <GaugeChart value={item.collectionProgress} label="回款" size={90} />
          <GaugeChart value={item.newCustomerProgress} label="新客" size={90} />
        </div>

        {/* 详细数据 */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="text-muted-foreground">实际营收</p>
            <p className="font-medium">¥{(item.revenueActual / 10000).toFixed(1)}万</p>
            <p className="text-muted-foreground">目标 ¥{(item.revenueTarget / 10000).toFixed(1)}万</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">实际回款</p>
            <p className="font-medium">¥{(item.collectionActual / 10000).toFixed(1)}万</p>
            <p className="text-muted-foreground">目标 ¥{(item.collectionTarget / 10000).toFixed(1)}万</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">新开客户</p>
            <p className="font-medium">{item.newCustomerActual} 家</p>
            <p className="text-muted-foreground">目标 {item.newCustomerTarget} 家</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 设置目标表单 ─────────────────────────────────────────────────────────────
function SetTargetForm() {
  const [form, setForm] = useState({
    salesRepId: "",
    salesRepName: "",
    regionName: "",
    period: new Date().toISOString().slice(0, 7),
    revenueTarget: "",
    collectionTarget: "",
    newCustomerTarget: "",
  });
  const utils = trpc.useUtils();

  const setTargetMutation = trpc.salesKPI.setTarget.useMutation({
    onSuccess: (data) => {
      toast.success(`目标${data.action === "CREATED" ? "设置" : "更新"}成功`);
      utils.salesKPI.getPerformance.invalidate();
      utils.salesKPI.getRegionSummary.invalidate();
    },
    onError: (err) => toast.error("设置失败", { description: err.message }),
  });

  const handleSubmit = () => {
    if (!form.salesRepId || !form.salesRepName || !form.revenueTarget) {
      toast.error("请填写必填字段");
      return;
    }
    setTargetMutation.mutate({
      salesRepId: Number(form.salesRepId),
      salesRepName: form.salesRepName,
      regionName: form.regionName || undefined,
      period: form.period,
      revenueTarget: Number(form.revenueTarget),
      collectionTarget: Number(form.collectionTarget) || Number(form.revenueTarget) * 0.8,
      newCustomerTarget: Number(form.newCustomerTarget) || 3,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="w-4 h-4" />设置月度销售目标
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">销售员ID *</Label>
            <Input type="number" placeholder="用户ID" value={form.salesRepId}
              onChange={(e) => setForm((f) => ({ ...f, salesRepId: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">销售员姓名 *</Label>
            <Input placeholder="姓名" value={form.salesRepName}
              onChange={(e) => setForm((f) => ({ ...f, salesRepName: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">所属战区</Label>
            <Input placeholder="如：华南战区" value={form.regionName}
              onChange={(e) => setForm((f) => ({ ...f, regionName: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">考核月份</Label>
            <Input type="month" value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">营收目标（元）*</Label>
            <Input type="number" placeholder="500000" value={form.revenueTarget}
              onChange={(e) => setForm((f) => ({ ...f, revenueTarget: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">回款目标（元）</Label>
            <Input type="number" placeholder="400000" value={form.collectionTarget}
              onChange={(e) => setForm((f) => ({ ...f, collectionTarget: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">新客目标（家）</Label>
            <Input type="number" placeholder="5" value={form.newCustomerTarget}
              onChange={(e) => setForm((f) => ({ ...f, newCustomerTarget: e.target.value }))} />
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={setTargetMutation.isPending} className="w-full">
          {setTargetMutation.isPending ? "保存中..." : "保存目标"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────
export default function SalesPerformancePage() {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: perfData, isLoading: perfLoading } = trpc.salesKPI.getPerformance.useQuery(
    { period },
    { refetchInterval: 30000 }
  );
  const { data: regionData, isLoading: regionLoading } = trpc.salesKPI.getRegionSummary.useQuery(
    { period },
    { refetchInterval: 30000 }
  );

  const items = perfData?.items || [];
  const regions = regionData?.regions || [];

  // 排序：按营收完成率降序
  const rankedItems = useMemo(
    () => [...items].sort((a: any, b: any) => b.revenueProgress - a.revenueProgress),
    [items]
  );

  // 全队汇总
  const teamSummary = useMemo(() => {
    if (items.length === 0) return null;
    const totalRevTarget = items.reduce((s: number, i: any) => s + i.revenueTarget, 0);
    const totalRevActual = items.reduce((s: number, i: any) => s + i.revenueActual, 0);
    const totalColTarget = items.reduce((s: number, i: any) => s + i.collectionTarget, 0);
    const totalColActual = items.reduce((s: number, i: any) => s + i.collectionActual, 0);
    const totalNCTarget = items.reduce((s: number, i: any) => s + i.newCustomerTarget, 0);
    const totalNCActual = items.reduce((s: number, i: any) => s + i.newCustomerActual, 0);
    return {
      revenueProgress: totalRevTarget > 0 ? (totalRevActual / totalRevTarget) * 100 : 0,
      collectionProgress: totalColTarget > 0 ? (totalColActual / totalColTarget) * 100 : 0,
      newCustomerProgress: totalNCTarget > 0 ? (totalNCActual / totalNCTarget) * 100 : 0,
      totalRevActual,
      totalRevTarget,
    };
  }, [items]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">销售铁军 KPI 看板</h1>
            <p className="text-sm text-muted-foreground">实时追踪营收、回款、新客完成率</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-36"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              utils.salesKPI.getPerformance.invalidate();
              utils.salesKPI.getRegionSummary.invalidate();
            }}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 全队汇总仪表盘 */}
      {teamSummary && (
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">全队综合完成率 — {period}</h2>
              <Badge variant="outline" className="text-white border-white/30">
                {items.length} 名销售
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <GaugeChart value={teamSummary.revenueProgress} label="营收完成率" size={160} />
                <p className="text-sm text-slate-300 mt-1">
                  ¥{(teamSummary.totalRevActual / 10000).toFixed(1)}万 / ¥{(teamSummary.totalRevTarget / 10000).toFixed(1)}万
                </p>
              </div>
              <div className="text-center">
                <GaugeChart value={teamSummary.collectionProgress} label="回款完成率" size={160} />
              </div>
              <div className="text-center">
                <GaugeChart value={teamSummary.newCustomerProgress} label="新客完成率" size={160} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {!perfLoading && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">暂无 {period} 的销售目标数据</p>
            <p className="text-sm mt-1">请在"设置目标"标签页中录入销售员月度目标</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="individual">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="individual">个人排行</TabsTrigger>
          <TabsTrigger value="region">战区对比</TabsTrigger>
          <TabsTrigger value="settings">设置目标</TabsTrigger>
        </TabsList>

        {/* 个人排行 */}
        <TabsContent value="individual" className="mt-4">
          {perfLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-56 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rankedItems.map((item: any, idx: number) => (
                <PersonalKPICard key={item.id} item={item} rank={idx + 1} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* 战区对比 */}
        <TabsContent value="region" className="mt-4">
          {regionLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : regions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无战区数据</div>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">战区营收完成率排名</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {regions.map((region: any, idx: number) => (
                  <div key={region.regionName}>
                    <ProgressBar
                      value={region.revenueProgress}
                      max={100}
                      label={region.regionName}
                      sublabel={`${region.salesCount} 名销售 · 营收 ¥${(region.totalRevenueActual / 10000).toFixed(1)}万 / ¥${(region.totalRevenueTarget / 10000).toFixed(1)}万`}
                      rank={idx + 1}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 设置目标 */}
        <TabsContent value="settings" className="mt-4">
          <SetTargetForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
