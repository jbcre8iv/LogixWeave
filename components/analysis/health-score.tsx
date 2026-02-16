"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface HealthScoreProps {
  stats: {
    totalTags: number;
    unusedTags: number;
    commentCoverage: number;
    totalReferences: number;
    totalRungs: number;
  };
}

function computeScore(stats: HealthScoreProps["stats"]) {
  const tagEfficiency =
    stats.totalTags > 0
      ? Math.max(0, 100 - (stats.unusedTags / stats.totalTags) * 200)
      : 100;
  const documentation = stats.commentCoverage;
  const tagUsage =
    stats.totalTags > 0
      ? Math.min(100, (stats.totalReferences / stats.totalTags) * 20)
      : 0;

  const overall = Math.round(
    tagEfficiency * 0.4 + documentation * 0.35 + tagUsage * 0.25
  );

  return { overall, tagEfficiency: Math.round(tagEfficiency), documentation: Math.round(documentation), tagUsage: Math.round(tagUsage) };
}

function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function getColor(score: number): { ring: string; text: string; bg: string; progress: string } {
  if (score >= 80) return { ring: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", progress: "[&_[data-slot=progress-indicator]]:bg-emerald-500" };
  if (score >= 50) return { ring: "stroke-yellow-500", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500", progress: "[&_[data-slot=progress-indicator]]:bg-yellow-500" };
  return { ring: "stroke-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-500", progress: "[&_[data-slot=progress-indicator]]:bg-red-500" };
}

export function HealthScore({ stats }: HealthScoreProps) {
  const { overall, tagEfficiency, documentation, tagUsage } = computeScore(stats);
  const grade = getGrade(overall);
  const color = getColor(overall);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (overall / 100) * circumference;

  const metrics = [
    { label: "Tag Efficiency", value: tagEfficiency },
    { label: "Documentation", value: documentation },
    { label: "Tag Usage", value: tagUsage },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Circular progress ring */}
          <div className="relative flex-shrink-0">
            <svg width="140" height="140" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/30"
              />
              <circle
                cx="64"
                cy="64"
                r={radius}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={color.ring}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 64 64)"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${color.text}`}>{overall}</span>
              <span className={`text-sm font-semibold ${color.text}`}>{grade}</span>
            </div>
          </div>

          {/* Sub-metrics */}
          <div className="flex-1 w-full space-y-4">
            <div className="mb-1">
              <h3 className="text-lg font-semibold">Project Health</h3>
              <p className="text-sm text-muted-foreground">Weighted score across tag efficiency, documentation, and usage</p>
            </div>
            {metrics.map((m) => {
              const metricColor = getColor(m.value);
              return (
                <div key={m.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground">
                      <span className={`font-semibold ${metricColor.text}`}>{m.value}</span>
                      <span className="text-xs ml-1">/ 100</span>
                    </span>
                  </div>
                  <Progress value={m.value} className={`h-2 ${metricColor.progress}`} />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
