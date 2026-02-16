"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  projectId: string;
}

const COLLAPSED_LIMIT = 5;

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

export function AnalysisCharts({ usageBreakdown, routineCoverage, topTags, projectId }: AnalysisChartsProps) {
  const router = useRouter();
  const [coverageExpanded, setCoverageExpanded] = useState(false);
  const [topTagsExpanded, setTopTagsExpanded] = useState(false);

  const basePath = `/dashboard/projects/${projectId}/analysis`;

  const hasUsageData = usageBreakdown.some((d) => d.value > 0);
  const hasCoverageData = routineCoverage.length > 0;
  const hasTopTags = topTags.length > 0;

  if (!hasUsageData && !hasCoverageData && !hasTopTags) return null;

  const filteredUsage = usageBreakdown.filter((d) => d.value > 0);
  const usageTotal = filteredUsage.reduce((sum, d) => sum + d.value, 0);

  const coverageCanExpand = routineCoverage.length > COLLAPSED_LIMIT;
  const visibleCoverage = coverageExpanded ? routineCoverage : routineCoverage.slice(0, COLLAPSED_LIMIT);
  const coverageHeight = Math.max(180, visibleCoverage.length * 44 + 40);

  const topTagsCanExpand = topTags.length > COLLAPSED_LIMIT;
  const visibleTopTags = topTagsExpanded ? topTags : topTags.slice(0, COLLAPSED_LIMIT);
  const topTagsHeight = Math.max(180, visibleTopTags.length * 40 + 40);

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
                    style={{ cursor: "pointer" }}
                    onClick={(_data, index) => {
                      const segment = filteredUsage[index];
                      if (segment) {
                        router.push(`${basePath}/tag-xref?usageType=${segment.name.toLowerCase()}`);
                      }
                    }}
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Comment Coverage</CardTitle>
                <CardDescription>Percentage of rungs with comments per routine</CardDescription>
              </div>
              {coverageCanExpand && (
                <span className="text-xs text-muted-foreground">
                  {visibleCoverage.length} of {routineCoverage.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: `${coverageHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visibleCoverage}
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
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar
                    dataKey="coverage"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                    animationBegin={0}
                    animationDuration={600}
                    animationEasing="ease-out"
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      router.push(`${basePath}/comment-coverage`);
                    }}
                  >
                    {visibleCoverage.map((entry) => (
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
            {coverageCanExpand && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground"
                onClick={() => setCoverageExpanded(!coverageExpanded)}
              >
                {coverageExpanded ? (
                  <>Show less <ChevronUp className="ml-1 h-3 w-3" /></>
                ) : (
                  <>Show all {routineCoverage.length} routines <ChevronDown className="ml-1 h-3 w-3" /></>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top Referenced Tags */}
      {hasTopTags && (
        <Card className={!hasUsageData || !hasCoverageData ? "" : "md:col-span-2 lg:col-span-1"}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Top Referenced Tags</CardTitle>
                <CardDescription>Most frequently used tags in logic</CardDescription>
              </div>
              {topTagsCanExpand && (
                <span className="text-xs text-muted-foreground">
                  {visibleTopTags.length} of {topTags.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ height: `${topTagsHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={visibleTopTags}
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
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    maxBarSize={24}
                    animationBegin={0}
                    animationDuration={600}
                    animationEasing="ease-out"
                    style={{ cursor: "pointer" }}
                    onClick={(_data, index) => {
                      const tag = visibleTopTags[index];
                      if (tag) {
                        router.push(`${basePath}/tag-xref?search=${encodeURIComponent(tag.name)}`);
                      }
                    }}
                  >
                    {visibleTopTags.map((_, i) => (
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
            {topTagsCanExpand && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground"
                onClick={() => setTopTagsExpanded(!topTagsExpanded)}
              >
                {topTagsExpanded ? (
                  <>Show less <ChevronUp className="ml-1 h-3 w-3" /></>
                ) : (
                  <>Show all {topTags.length} tags <ChevronDown className="ml-1 h-3 w-3" /></>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
