"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  Zap,
  AlertTriangle,
  Info,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AILoading } from "@/components/ai/ai-loading";
import type {
  HealthRecommendationResult,
  HealthRecommendation,
} from "@/lib/ai/claude-client";

interface HealthRecommendationsProps {
  projectId: string;
  stats: {
    totalTags: number;
    unusedTags: number;
    commentCoverage: number;
    totalReferences: number;
    totalRungs: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const metricLabels: Record<string, string> = {
  tagEfficiency: "Tag Efficiency",
  documentation: "Documentation",
  tagUsage: "Tag Usage",
};

const metricDescriptions: Record<string, string> = {
  tagEfficiency: "Measures the ratio of actively used tags vs. total tags",
  documentation: "Measures comment coverage across all rungs",
  tagUsage: "Measures reference density relative to total tags",
};

const toolRoutes: Record<string, (projectId: string) => string> = {
  issues: (id) => `/dashboard/projects/${id}/ai/issues`,
  explainer: (id) => `/dashboard/projects/${id}/ai/explain`,
  "tag-xref": (id) => `/dashboard/projects/${id}/analysis/tag-xref`,
  "unused-tags": (id) => `/dashboard/projects/${id}/analysis/unused-tags`,
  "comment-coverage": (id) =>
    `/dashboard/projects/${id}/analysis/comment-coverage`,
};

function getScoreColor(score: number) {
  if (score >= 80)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      progress:
        "[&_[data-slot=progress-indicator]]:bg-emerald-500",
    };
  if (score >= 50)
    return {
      text: "text-yellow-600 dark:text-yellow-400",
      progress:
        "[&_[data-slot=progress-indicator]]:bg-yellow-500",
    };
  return {
    text: "text-red-600 dark:text-red-400",
    progress:
      "[&_[data-slot=progress-indicator]]:bg-red-500",
  };
}

const priorityStyles: Record<
  string,
  { border: string; badge: string; badgeLabel: string; icon: React.ReactNode }
> = {
  high: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    badgeLabel: "High",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  medium: {
    border: "border-l-yellow-500",
    badge:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
    badgeLabel: "Medium",
    icon: <Zap className="h-3.5 w-3.5" />,
  },
  low: {
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    badgeLabel: "Low",
    icon: <Info className="h-3.5 w-3.5" />,
  },
};

function RecommendationCard({
  rec,
  projectId,
  onNavigate,
}: {
  rec: HealthRecommendation;
  projectId: string;
  onNavigate: (path: string) => void;
}) {
  const style = priorityStyles[rec.priority] || priorityStyles.medium;

  return (
    <div className={`border-l-4 ${style.border} rounded-r-lg bg-muted/30 p-4`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="font-medium text-sm">{rec.title}</h4>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
        >
          {style.icon}
          {style.badgeLabel}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
      <p className="text-xs text-muted-foreground/80 italic mb-2">
        {rec.impact}
      </p>
      {rec.specificItems && rec.specificItems.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {rec.specificItems.slice(0, 8).map((item) => (
            <Badge key={item} variant="outline" className="text-xs font-mono">
              {item}
            </Badge>
          ))}
          {rec.specificItems.length > 8 && (
            <Badge variant="outline" className="text-xs">
              +{rec.specificItems.length - 8} more
            </Badge>
          )}
        </div>
      )}
      {rec.actionLink && toolRoutes[rec.actionLink.tool] && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() =>
            onNavigate(toolRoutes[rec.actionLink!.tool](projectId))
          }
        >
          {rec.actionLink.label}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}
    </div>
  );
}

export function HealthRecommendations({
  projectId,
  stats,
  open,
  onOpenChange,
}: HealthRecommendationsProps) {
  const router = useRouter();
  const [result, setResult] = useState<HealthRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch recommendations");
      }

      const data = await res.json();
      setResult(data.result);
      setCached(data.cached);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && !result && !loading) {
      fetchRecommendations();
    }
  }, [open, result, loading, fetchRecommendations]);

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Improve Project Health
          </DialogTitle>
          <DialogDescription>
            AI-powered recommendations based on your project&apos;s health
            metrics
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="px-6 pb-6 max-h-[calc(85vh-5rem)]">
          <div className="space-y-5 pt-2 pb-1">
            {loading && <AILoading variant="health" />}

            {error && (
              <Card className="border-destructive/50">
                <CardContent className="py-4">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={fetchRecommendations}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {result && !loading && (
              <>
                {/* Summary */}
                <Card>
                  <CardContent className="py-4">
                    <p className="text-sm leading-relaxed">
                      {result.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* Quick Wins */}
                {result.quickWins.length > 0 && (
                  <Card className="border-emerald-500/30">
                    <CardContent className="py-4">
                      <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-emerald-500" />
                        Quick Wins
                      </h3>
                      <ol className="space-y-2">
                        {result.quickWins.map((win, i) => (
                          <li
                            key={i}
                            className="text-sm text-muted-foreground flex gap-2"
                          >
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {i + 1}.
                            </span>
                            {win}
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                )}

                {/* Metric Sections */}
                {result.sections.map((section) => {
                  const scoreColor = getScoreColor(section.currentScore);
                  return (
                    <div key={section.metric} className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-sm">
                              {metricLabels[section.metric] || section.metric}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {metricDescriptions[section.metric]} ({section.weight} of overall score)
                            </p>
                          </div>
                          <span
                            className={`text-lg font-bold ${scoreColor.text}`}
                          >
                            {section.currentScore}
                            <span className="text-xs font-normal text-muted-foreground ml-0.5">
                              /100
                            </span>
                          </span>
                        </div>
                        <Progress
                          value={section.currentScore}
                          className={`h-2 ${scoreColor.progress}`}
                        />
                      </div>

                      <div className="space-y-2">
                        {section.recommendations.map((rec, i) => (
                          <RecommendationCard
                            key={i}
                            rec={rec}
                            projectId={projectId}
                            onNavigate={handleNavigate}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Cached indicator */}
                {cached && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 pt-2">
                    <Clock className="h-3 w-3" />
                    Served from cache
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
