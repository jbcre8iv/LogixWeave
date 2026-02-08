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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Sparkles, CheckCircle, AlertCircle, Download, ChevronDown, FileText, FileType } from "lucide-react";
import { jsPDF } from "jspdf";
import { ExplainChat } from "@/components/ai/explain-chat";
import { AILoading } from "@/components/ai/ai-loading";

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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const exportMarkdown = () => {
    if (!result) return;

    const lines: string[] = [
      `# Logic Analysis: ${selectedRoutine}`,
      "",
      "## Summary",
      result.summary,
      "",
    ];

    if (result.stepByStep?.length) {
      lines.push("## Step-by-Step Explanation");
      result.stepByStep.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
      lines.push("");
    }

    if (result.tagsPurpose && Object.keys(result.tagsPurpose).length) {
      lines.push("## Tag Reference");
      Object.entries(result.tagsPurpose).forEach(([tag, purpose]) => {
        lines.push(`- **${tag}**: ${purpose}`);
      });
      lines.push("");
    }

    if (result.potentialIssues?.length) {
      lines.push("## Potential Issues");
      result.potentialIssues.forEach((issue) => {
        lines.push(`- ${issue}`);
      });
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    downloadBlob(blob, `${selectedRoutine}-analysis.md`);
  };

  const exportCSV = () => {
    if (!result) return;

    const rows: string[][] = [["Section", "Key", "Value"]];

    rows.push(["Summary", "", result.summary]);

    if (result.stepByStep?.length) {
      result.stepByStep.forEach((step, i) => {
        rows.push(["Step", `${i + 1}`, step]);
      });
    }

    if (result.tagsPurpose && Object.keys(result.tagsPurpose).length) {
      Object.entries(result.tagsPurpose).forEach(([tag, purpose]) => {
        rows.push(["Tag", tag, purpose]);
      });
    }

    if (result.potentialIssues?.length) {
      result.potentialIssues.forEach((issue) => {
        rows.push(["Issue", "", issue]);
      });
    }

    const csvContent = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `${selectedRoutine}-analysis.csv`);
  };

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

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Logic Analysis: ${selectedRoutine}`, margin, y);
    y += 12;

    // Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Summary", margin, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    addWrappedText(result.summary, margin, 11);
    y += 6;

    // Steps
    if (result.stepByStep?.length) {
      addPageIfNeeded(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Step-by-Step Explanation", margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      result.stepByStep.forEach((step, i) => {
        addWrappedText(`${i + 1}. ${step}`, margin, 11);
        y += 3;
      });
      y += 3;
    }

    // Tags
    if (result.tagsPurpose && Object.keys(result.tagsPurpose).length) {
      addPageIfNeeded(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Tag Reference", margin, y);
      y += 8;
      Object.entries(result.tagsPurpose).forEach(([tag, purpose]) => {
        addPageIfNeeded(14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(tag, margin, y);
        y += 5.5;
        doc.setFont("helvetica", "normal");
        addWrappedText(purpose, margin, 11, 4);
        y += 4;
      });
      y += 3;
    }

    // Issues
    if (result.potentialIssues?.length) {
      addPageIfNeeded(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Potential Issues", margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      result.potentialIssues.forEach((issue) => {
        addWrappedText(`• ${issue}`, margin, 11);
        y += 3;
      });
    }

    doc.save(`${selectedRoutine}-analysis.pdf`);
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

      {isAnalyzing && !result && <AILoading variant="explain" />}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {cached && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Using cached analysis
              </div>
            )}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                    <ChevronDown className="ml-2 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportPDF}>
                    <FileType className="mr-2 h-4 w-4" />
                    Export as PDF
                    <span className="ml-2 text-xs text-muted-foreground">For sharing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportMarkdown}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as Markdown
                    <span className="ml-2 text-xs text-muted-foreground">For docs</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportCSV}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as CSV
                    <span className="ml-2 text-xs text-muted-foreground">For spreadsheets</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

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

          <ExplainChat
            key={selectedRoutine}
            projectId={projectId}
            routineName={selectedRoutine}
            analysisContext={result}
          />
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
