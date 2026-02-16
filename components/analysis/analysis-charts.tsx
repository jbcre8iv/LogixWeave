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
      <p className="text-muted-foreground">{payload[0].value} references</p>
    </div>
  );
}

export function AnalysisCharts({ usageBreakdown, routineCoverage, topTags }: AnalysisChartsProps) {
  const hasUsageData = usageBreakdown.some((d) => d.value > 0);
  const hasCoverageData = routineCoverage.length > 0;
  const hasTopTags = topTags.length > 0;

  if (!hasUsageData && !hasCoverageData && !hasTopTags) return null;

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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={usageBreakdown.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                  >
                    {usageBreakdown
                      .filter((d) => d.value > 0)
                      .map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={USAGE_COLORS[entry.name] || "#6b7280"}
                        />
                      ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={routineCoverage}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="routine"
                    width={120}
                    fontSize={11}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "..." : v}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="coverage" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {routineCoverage.map((entry) => (
                      <Cell key={entry.routine} fill={getCoverageColor(entry.coverage)} />
                    ))}
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
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTags}
                  layout="vertical"
                  margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    fontSize={11}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + "..." : v}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
