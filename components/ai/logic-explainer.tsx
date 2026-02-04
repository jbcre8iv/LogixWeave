"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, CheckCircle, AlertCircle } from "lucide-react";

interface Routine {
  name: string;
  program_name: string;
  type: string;
  rung_count: number | null;
}

interface ExplanationResult {
  summary: string;
  stepByStep: string[];
  tagsPurpose: Record<string, string>;
  potentialIssues?: string[];
}

interface LogicExplainerProps {
  projectId: string;
  routines: Routine[];
}

export function LogicExplainer({ projectId, routines }: LogicExplainerProps) {
  const [selectedRoutine, setSelectedRoutine] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const analyzeRoutine = async () => {
    if (!selectedRoutine) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          routineName: selectedRoutine,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze routine");
      }

      setResult(data.result);
      setCached(data.cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Group routines by program
  const routinesByProgram = routines.reduce((acc, r) => {
    if (!acc[r.program_name]) {
      acc[r.program_name] = [];
    }
    acc[r.program_name].push(r);
    return acc;
  }, {} as Record<string, Routine[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-2 block">Select Routine</label>
          <Select value={selectedRoutine} onValueChange={setSelectedRoutine}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a routine to analyze..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(routinesByProgram).map(([program, programRoutines]) => (
                <div key={program}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {program}
                  </div>
                  {programRoutines.map((routine) => (
                    <SelectItem key={`${program}/${routine.name}`} value={routine.name}>
                      {routine.name} ({routine.rung_count || 0} rungs)
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={analyzeRoutine}
          disabled={!selectedRoutine || isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Explain
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

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

          {result.stepByStep && result.stepByStep.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Step-by-Step Explanation</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2">
                  {result.stepByStep.map((step, idx) => (
                    <li key={idx} className="text-sm">
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {result.tagsPurpose && Object.keys(result.tagsPurpose).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tag Reference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(result.tagsPurpose).map(([tag, purpose]) => (
                    <div key={tag} className="flex items-start gap-2">
                      <Badge variant="outline" className="font-mono shrink-0">
                        {tag}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{purpose}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.potentialIssues && result.potentialIssues.length > 0 && (
            <Card className="border-yellow-500/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Potential Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {result.potentialIssues.map((issue, idx) => (
                    <li key={idx} className="text-sm text-yellow-600 dark:text-yellow-400">
                      {issue}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {routines.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No ladder logic routines found in this project.
        </p>
      )}
    </div>
  );
}
