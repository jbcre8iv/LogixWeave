"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { AILoading } from "@/components/ai/ai-loading";

interface Issue {
  severity: "error" | "warning" | "info";
  type: string;
  description: string;
  location?: string;
  suggestion?: string;
}

interface IssueResult {
  issues: Issue[];
  summary: string;
}

interface IssueFinderProps {
  projectId: string;
}

export function IssueFinder({ projectId }: IssueFinderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const analyzeProject = async () => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze project");
      }

      setResult(data.result);
      setCached(data.cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge className="bg-red-500/10 text-red-500">Error</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Warning</Badge>;
      case "info":
        return <Badge className="bg-blue-500/10 text-blue-500">Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const counts = result?.issues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          onClick={analyzeProject}
          disabled={isAnalyzing}
          size="lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning Project...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Scan for Issues
            </>
          )}
        </Button>

        {result && (
          <div className="flex items-center gap-2">
            {counts.error > 0 && (
              <Badge className="bg-red-500/10 text-red-500">
                {counts.error} Error{counts.error > 1 ? "s" : ""}
              </Badge>
            )}
            {counts.warning > 0 && (
              <Badge className="bg-yellow-500/10 text-yellow-500">
                {counts.warning} Warning{counts.warning > 1 ? "s" : ""}
              </Badge>
            )}
            {counts.info > 0 && (
              <Badge className="bg-blue-500/10 text-blue-500">
                {counts.info} Info
              </Badge>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {isAnalyzing && <AILoading variant="issues" />}

      {result && (
        <div className="space-y-4">
          {cached && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Using cached analysis
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{result.summary}</p>
            </CardContent>
          </Card>

          {result.issues.length > 0 ? (
            <div className="space-y-3">
              {result.issues.map((issue, idx) => (
                <Card key={idx} className={
                  issue.severity === "error" ? "border-red-500/50" :
                  issue.severity === "warning" ? "border-yellow-500/50" :
                  "border-blue-500/50"
                }>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(issue.severity)}
                          <Badge variant="outline">{issue.type}</Badge>
                        </div>
                        <p className="text-sm">{issue.description}</p>
                        {issue.location && (
                          <p className="text-xs text-muted-foreground">
                            Location: {issue.location}
                          </p>
                        )}
                        {issue.suggestion && (
                          <p className="text-sm text-green-600 dark:text-green-400">
                            Suggestion: {issue.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-green-600">
                  No issues found!
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Your project looks good. Keep up the great work!
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
