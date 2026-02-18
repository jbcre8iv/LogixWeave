"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RoleData {
  role: string;
  count: number;
}

const COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

export function RoleDistributionCard() {
  const [data, setData] = useState<RoleData[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRoleDistribution() {
      try {
        const res = await fetch("/api/admin/analytics");
        if (!res.ok) return;
        const json = await res.json();
        setData(json.roleDistribution);
        setTotalUsers(json.totalUsers);
      } catch {
        // Silently fail — chart just won't render
      } finally {
        setLoading(false);
      }
    }
    fetchRoleDistribution();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">User Role Distribution</CardTitle>
          <CardDescription>Breakdown of user roles across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[180px]">
            <Skeleton className="h-[120px] w-[120px] rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">User Role Distribution</CardTitle>
        <CardDescription>Breakdown of user roles across the platform</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="42%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="count"
                nameKey="role"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
                label={(props) => {
                  if (data.length <= 1) return null;
                  const { value, cx: cxVal, cy: cyVal, midAngle: ma, outerRadius: or } = props as {
                    value?: number;
                    cx?: number;
                    cy?: number;
                    midAngle?: number;
                    outerRadius?: number;
                  };
                  if (value == null || cxVal == null || cyVal == null || ma == null || or == null) return null;
                  const RADIAN = Math.PI / 180;
                  const radius = or + 20;
                  const x = cxVal + radius * Math.cos(-ma * RADIAN);
                  const y = cyVal + radius * Math.sin(-ma * RADIAN);
                  const pct = Math.round((value / totalUsers) * 100);
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
                {data.map((entry, index) => (
                  <Cell
                    key={entry.role}
                    fill={COLORS[index % COLORS.length]}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              {/* Center label */}
              <text x="50%" y="35%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" className="fill-foreground text-base font-bold">
                  {totalUsers.toLocaleString()}
                </tspan>
                <tspan x="50%" dy="1.2em" className="fill-muted-foreground text-[10px]">
                  total users
                </tspan>
              </text>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground">
                        {(item.value as number).toLocaleString()} user{(item.value as number) !== 1 ? "s" : ""}
                        {" "}({Math.round(((item.value as number) / totalUsers) * 100)}%)
                      </p>
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2">
                    {data.map((entry, index) => (
                      <div key={entry.role} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {entry.role} ({entry.count})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
