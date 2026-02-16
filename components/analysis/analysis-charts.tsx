"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";

interface UsageBreakdown {
  name: string;
  value: number;
}

interface RoutineCoverage {
  routine: string;
  coverage: number;
  commented: number;
  total: number;
}

interface TopTag {
  name: string;
  count: number;
}

interface AnalysisChartsProps {
  usageBreakdown: UsageBreakdown[];
  routineCoverage: RoutineCoverage[];
  topTags: TopTag[];
}

const USAGE_COLORS: Record<string, string> = {
  Read: "#3b82f6",
  Write: "#ef4444",
  Both: "#a855f7",
};

function getCoverageColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 50) return "#eab308";
  return "#ef4444";
}

const TOP_TAG_COLORS = [
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#818cf8",
  "#60a5fa",
  "#93c5fd",
  "#7dd3fc",
  "#67e8f9",
  "#5eead4",
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload?: { total?: number; commented?: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{label}</p>
      {data.payload?.total !== undefined ? (
        <p className="text-muted-foreground">
          {data.payload.commented}/{data.payload.total} rungs commented ({data.value}%)
        </p>
      ) : (
        <p className="text-muted-foreground">{data.value} references</p>
      )}
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value.toLocaleString()} references</p>
    </div>
  );
}

function PieCenterLabel({ data }: { data: UsageBreakdown[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
      <tspan x="50%" dy="-0.5em" className="fill-foreground text-xl font-bold">
        {total.toLocaleString()}
      </tspan>
      <tspan x="50%" dy="1.4em" className="fill-muted-foreground text-[11px]">
        total refs
      </tspan>
    </text>
  );
}

export function AnalysisCharts({ usageBreakdown, routineCoverage, topTags }: AnalysisChartsProps) {
  const hasUsageData = usageBreakdown.some((d) => d.value > 0);
  const hasCoverageData = routineCoverage.length > 0;
  const hasTopTags = topTags.length > 0;

  if (!hasUsageData && !hasCoverageData && !hasTopTags) return null;

  const filteredUsage = usageBreakdown.filter((d) => d.value > 0);
  const usageTotal = filteredUsage.reduce((sum, d) => sum + d.value, 0);

  // Compute dynamic height for bar charts based on data rows
  const coverageHeight = Math.max(180, routineCoverage.length * 44 + 40);
  const topTagsHeight = Math.max(180, topTags.length * 40 + 40);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Tag Usage Breakdown */}
      {hasUsageData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tag Usage Breakdown</CardTitle>
            <CardDescription>Read vs. Write vs. Both</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredUsage}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={filteredUsage.length > 1 ? 4 : 0}
                    dataKey="value"
                    nameKey="name"
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                    label={(props) => {
                      if (filteredUsage.length <= 1) return null;
                      const { value, cx: cxVal, cy: cyVal, midAngle: ma, outerRadius: or } = props as { value?: number; cx?: number; cy?: number; midAngle?: number; outerRadius?: number };
                      if (value == null || cxVal == null || cyVal == null || ma == null || or == null) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = or + 20;
                      const x = cxVal + radius * Math.cos(-ma * RADIAN);
                      const y = cyVal + radius * Math.sin(-ma * RADIAN);
                      const pct = Math.round((value / usageTotal) * 100);
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor={x > cxVal ? "start" : "end"}
                          dominantBaseline="central"
                          className="fill-muted-foreground text-[11px]"
                        >
                          {pct}%
                        </text>
                      );
                    }}
                  >
                    {filteredUsage.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={USAGE_COLORS[entry.name] || "#6b7280"}
                        strokeWidth={0}
                      />
                    ))}
                  </Pie>
                  <PieCenterLabel data={filteredUsage} />
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => {
                      const item = filteredUsage.find((d) => d.name === value);
                      return (
                        <span className="text-xs text-muted-foreground">
                          {value} ({item?.value.toLocaleString() ?? 0})
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comment Coverage by Routine */}
      {hasCoverageData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comment Coverage</CardTitle>
            <CardDescription>Percentage of rungs with comments per routine</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: `${coverageHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={routineCoverage}
                  layout="vertical"
                  margin={{ left: 8, right: 48, top: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    fontSize={11}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="routine"
                    width={150}
                    fontSize={11}
                    className="fill-muted-foreground"
                    tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + "\u2026" : v}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                  <Bar
                    dataKey="coverage"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                    animationBegin={0}
                    animationDuration={600}
                    animationEasing="ease-out"
                  >
                    {routineCoverage.map((entry) => (
                      <Cell key={entry.routine} fill={getCoverageColor(entry.coverage)} />
                    ))}
                    <LabelList
                      dataKey="coverage"
                      position="right"
                      formatter={(v) => `${v}%`}
                      className="fill-muted-foreground text-[11px]"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Referenced Tags */}
      {hasTopTags && (
        <Card className={!hasUsageData || !hasCoverageData ? "" : "md:col-span-2 lg:col-span-1"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Referenced Tags</CardTitle>
            <CardDescription>Most frequently used tags in logic</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: `${topTagsHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTags}
                  layout="vertical"
                  margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis
                    type="number"
                    fontSize={11}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    fontSize={11}
                    className="fill-muted-foreground"
                    tickFormatter={(v: string) => v.length > 20 ? v.slice(0, 20) + "\u2026" : v}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                    animationBegin={0}
                    animationDuration={600}
                    animationEasing="ease-out"
                  >
                    {topTags.map((_, i) => (
                      <Cell key={i} fill={TOP_TAG_COLORS[i % TOP_TAG_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      className="fill-muted-foreground text-[11px]"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
