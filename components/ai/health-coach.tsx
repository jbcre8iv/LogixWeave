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
  RefreshCw,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AILoading } from "@/components/ai/ai-loading";
import type {
  HealthRecommendationResult,
  HealthRecommendation,
} from "@/lib/ai/claude-client";

interface HealthCoachProps {
  projectId: string;
  projectName: string;
}

interface HistoryEntry {
  id: string;
  result: HealthRecommendationResult;
  health_scores: {
    overall: number;
    tagEfficiency: number;
    documentation: number;
    tagUsage: number;
  } | null;
  tokens_used: number | null;
  created_at: string;
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
      progress: "[&_[data-slot=progress-indicator]]:bg-emerald-500",
    };
  if (score >= 50)
    return {
      text: "text-yellow-600 dark:text-yellow-400",
      progress: "[&_[data-slot=progress-indicator]]:bg-yellow-500",
    };
  return {
    text: "text-red-600 dark:text-red-400",
    progress: "[&_[data-slot=progress-indicator]]:bg-red-500",
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
          className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 dark:text-amber-400 dark:hover:text-amber-300"
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

function ScoreChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (diff > 0) return (
    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
      <TrendingUp className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">+{diff}</span>
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
      <TrendingDown className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{diff}</span>
    </span>
  );
}

function HistoryEntryCard({
  entry,
  previousEntry,
  index,
}: {
  entry: HistoryEntry;
  previousEntry?: HistoryEntry;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const scores = entry.health_scores;
  const prevScores = previousEntry?.health_scores;
  const date = new Date(entry.created_at);

  return (
    <div className="relative pl-6 pb-6 last:pb-0">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-3 bottom-0 w-px bg-border last:hidden" />
      {/* Timeline dot */}
      <div className={`absolute left-0 top-2 h-[15px] w-[15px] rounded-full border-2 ${
        index === 0
          ? "border-amber-500 bg-amber-500/20"
          : "border-muted-foreground/30 bg-background"
      }`} />

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              <span className="text-muted-foreground font-normal ml-2">
                {date.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {scores && (
              <div className="flex items-center gap-2">
                <ScoreBadge label="Overall" score={scores.overall} />
                <ScoreBadge label="TagEff" score={scores.tagEfficiency} />
                <ScoreBadge label="Docs" score={scores.documentation} />
                <ScoreBadge label="Usage" score={scores.tagUsage} />
                {prevScores && (
                  <ScoreChangeIndicator
                    current={scores.overall}
                    previous={prevScores.overall}
                  />
                )}
              </div>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {expanded && entry.result && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {(entry.result as HealthRecommendationResult).summary}
          </p>
          {(entry.result as HealthRecommendationResult).quickWins?.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Quick Wins:</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {(entry.result as HealthRecommendationResult).quickWins.map((win, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-emerald-500 shrink-0">{i + 1}.</span>
                    {win}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
      : score >= 50
        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";

  return (
    <span className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label} {score}
    </span>
  );
}

export function HealthCoach({ projectId, projectName }: HealthCoachProps) {
  const router = useRouter();
  const [result, setResult] = useState<HealthRecommendationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/ai/health/history?projectId=${projectId}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      // History fetch is non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  // Fetch history on mount (non-destructive), but don't auto-run analysis
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Refresh history after analysis completes
  useEffect(() => {
    if (!loading && result) {
      // Small delay to let fire-and-forget DB insert complete
      const timeout = setTimeout(() => fetchHistory(), 1500);
      return () => clearTimeout(timeout);
    }
  }, [loading, result, fetchHistory]);

  const exportPDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    const addPageIfNeeded = (height: number) => {
      if (y + height > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
    };

    const addWrappedText = (text: string, x: number, fontSize: number, indent = 0) => {
      doc.setFontSize(fontSize);
      const availWidth = maxWidth - indent;
      const lineHeight = fontSize * 0.5;
      const words = text.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        if (doc.getTextWidth(testLine) > availWidth && line) {
          addPageIfNeeded(lineHeight);
          doc.text(line, x + indent, y);
          y += lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        addPageIfNeeded(lineHeight);
        doc.text(line, x + indent, y);
        y += lineHeight;
      }
    };

    const weightLabels: Record<string, string> = {
      tagEfficiency: "40%",
      documentation: "35%",
      tagUsage: "25%",
    };

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`Project Health Report: ${projectName}`, margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Generated ${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      margin,
      y
    );
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Health Scores
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Health Scores", margin, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const overallScore = result.sections.reduce((sum, s) => {
      const pct = parseFloat(s.weight) / 100;
      return sum + s.currentScore * pct;
    }, 0);
    doc.text(`Overall: ${Math.round(overallScore)}/100`, margin, y);
    y += 5;
    for (const section of result.sections) {
      const label = metricLabels[section.metric] || section.metric;
      const weight = weightLabels[section.metric] || section.weight;
      doc.text(`${label} (${weight}): ${section.currentScore}/100`, margin, y);
      y += 5;
    }
    y += 4;

    // Summary
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    addWrappedText(result.summary, margin, 10);
    y += 4;

    // Quick Wins
    if (result.quickWins.length > 0) {
      addPageIfNeeded(20);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Quick Wins", margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      result.quickWins.forEach((win, i) => {
        addWrappedText(`${i + 1}. ${win}`, margin, 10);
        y += 2;
      });
      y += 2;
    }

    // Metric Sections
    for (const section of result.sections) {
      addPageIfNeeded(25);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;

      const label = metricLabels[section.metric] || section.metric;
      const weight = weightLabels[section.metric] || section.weight;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`${label} — ${section.currentScore}/100 (${weight} weight)`, margin, y);
      y += 8;

      for (const rec of section.recommendations) {
        addPageIfNeeded(20);
        const priorityTag = rec.priority.toUpperCase();
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        addWrappedText(`[${priorityTag}] ${rec.title}`, margin, 10);
        y += 1;

        doc.setFont("helvetica", "normal");
        addWrappedText(rec.description, margin, 9, 4);
        y += 1;

        doc.setFont("helvetica", "italic");
        addWrappedText(`Impact: ${rec.impact}`, margin, 9, 4);
        doc.setFont("helvetica", "normal");
        y += 1;

        if (rec.specificItems && rec.specificItems.length > 0) {
          addWrappedText(`Specific items: ${rec.specificItems.join(", ")}`, margin, 9, 4);
          y += 1;
        }
        y += 3;
      }
      y += 2;
    }

    // Score History
    if (history.length > 0) {
      addPageIfNeeded(30);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Score History", margin, y);
      y += 8;

      // Table header
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      const cols = [margin, margin + 35, margin + 55, margin + 75, margin + 95, margin + 115];
      doc.text("Date", cols[0], y);
      doc.text("Overall", cols[1], y);
      doc.text("Tag Eff", cols[2], y);
      doc.text("Docs", cols[3], y);
      doc.text("Usage", cols[4], y);
      doc.text("Change", cols[5], y);
      y += 2;
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, margin + 140, y);
      y += 4;

      doc.setFont("helvetica", "normal");
      for (let i = 0; i < history.length; i++) {
        addPageIfNeeded(6);
        const entry = history[i];
        const prev = history[i + 1];
        const date = new Date(entry.created_at);
        const dateStr = date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const scores = entry.health_scores;

        doc.text(dateStr, cols[0], y);
        if (scores) {
          doc.text(String(scores.overall), cols[1], y);
          doc.text(String(scores.tagEfficiency), cols[2], y);
          doc.text(String(scores.documentation), cols[3], y);
          doc.text(String(scores.tagUsage), cols[4], y);
          if (prev?.health_scores) {
            const diff = scores.overall - prev.health_scores.overall;
            doc.text(diff > 0 ? `+${diff}` : String(diff), cols[5], y);
          } else {
            doc.text("—", cols[5], y);
          }
        }
        y += 5;
      }
    }

    doc.save(`health-report-${projectName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <div className="space-y-6">
      {/* Begin state — shown before first analysis */}
      {!result && !loading && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-10 w-10 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI Health Analysis</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
              Analyze your project for unused tags, documentation gaps, and optimization opportunities.
            </p>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={fetchRecommendations}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Begin Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action buttons — shown after analysis */}
      {(result || loading) && (
        <div className="flex justify-end gap-2">
          {result && !loading && (
            <Button
              variant="outline"
              size="sm"
              className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
              onClick={exportPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            onClick={fetchRecommendations}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analyzing..." : "Run Analysis"}
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && <AILoading variant="health" />}

      {/* Error */}
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

      {/* Current Analysis Results */}
      {result && !loading && (
        <div className="space-y-5">
          {/* Summary */}
          <Card>
            <CardContent className="py-4">
              <p className="text-sm leading-relaxed">{result.summary}</p>
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
                    <span className={`text-lg font-bold ${scoreColor.text}`}>
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
        </div>
      )}

      {/* Analysis History */}
      {!loading && (history.length > 0 || historyLoading) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Analysis History
          </h2>

          {historyLoading && history.length === 0 ? (
            <Card>
              <CardContent className="py-6">
                <div className="space-y-2">
                  <div className="h-3 rounded-full bg-muted animate-pulse" style={{ width: "60%" }} />
                  <div className="h-3 rounded-full bg-muted animate-pulse" style={{ width: "40%" }} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4">
                <div className="space-y-0">
                  {history.map((entry, i) => (
                    <HistoryEntryCard
                      key={entry.id}
                      entry={entry}
                      previousEntry={history[i + 1]}
                      index={i}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
