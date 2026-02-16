"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface HealthScoreProps {
  projectId: string;
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

function getGrade(score: number): { letter: string; feedback: string } {
  if (score >= 90) return { letter: "A", feedback: "Excellent — well-documented with minimal unused tags" };
  if (score >= 80) return { letter: "B", feedback: "Good — minor improvements could tighten things up" };
  if (score >= 70) return { letter: "C", feedback: "Fair — some areas need attention" };
  if (score >= 60) return { letter: "D", feedback: "Below average — several metrics need improvement" };
  return { letter: "F", feedback: "Needs work — significant cleanup recommended" };
}

function getColor(score: number): { ring: string; text: string; bg: string; progress: string } {
  if (score >= 80) return { ring: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", progress: "[&_[data-slot=progress-indicator]]:bg-emerald-500" };
  if (score >= 50) return { ring: "stroke-yellow-500", text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500", progress: "[&_[data-slot=progress-indicator]]:bg-yellow-500" };
  return { ring: "stroke-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-500", progress: "[&_[data-slot=progress-indicator]]:bg-red-500" };
}

export function HealthScore({ projectId, stats }: HealthScoreProps) {
  const { overall, tagEfficiency, documentation, tagUsage } = computeScore(stats);
  const { letter: grade, feedback } = getGrade(overall);
  const color = getColor(overall);
  const [animated, setAnimated] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!animated) return;
    const duration = 1200;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out curve
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * overall));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [animated, overall]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((animated ? overall : 0) / 100) * circumference;

  const metrics = [
    { label: "Tag Efficiency (unused tags)", value: tagEfficiency },
    { label: "Documentation (comment coverage)", value: documentation },
    { label: "Tag Usage (reference density)", value: tagUsage },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Circular progress ring */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="relative">
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
                  style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${color.text}`}>{displayScore}</span>
                <span className={`text-sm font-semibold ${color.text}`}>{grade}</span>
              </div>
            </div>
            <p className={`text-xs text-center mt-1 max-w-[160px] ${color.text}`}>{feedback}</p>
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
                  <Progress
                    value={animated ? m.value : 0}
                    className={`h-2 ${metricColor.progress} [&_[data-slot=progress-indicator]]:duration-1000 [&_[data-slot=progress-indicator]]:ease-out`}
                  />
                </div>
              );
            })}
            <Link
              href={`/dashboard/projects/${projectId}/ai/health`}
              className="inline-flex items-center justify-center w-full mt-2 h-9 px-4 text-sm font-medium rounded-md border border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            >
              <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
              Improve Score
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
