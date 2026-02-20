"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  FileText,
  Sparkles,
  Tags,
  Cpu,
  HardDrive,
  Layers,
  Package,
  BarChart3,
  ListTree,
  Network,
  Activity,
  BookOpen,
} from "lucide-react";
import type { ManualConfig, ManualDocument, GenerationProgress, SectionType } from "@/lib/document-generator/types";
import { renderMarkdown } from "@/lib/document-generator/render-markdown";

interface ProjectManualGeneratorProps {
  projectId: string;
  projectName: string;
  counts: {
    tags: number;
    routines: number;
    ioModules: number;
    udts: number;
    aois: number;
    tasks: number;
    rungs: number;
    tagReferences: number;
  };
}

interface SectionDef {
  id: keyof ManualConfig["sections"];
  label: string;
  description: string;
  icon: typeof Tags;
  countKey?: keyof ProjectManualGeneratorProps["counts"];
  alwaysAvailable?: boolean;
}

const SECTIONS: SectionDef[] = [
  { id: "cover", label: "Cover Page", description: "Project name, processor, revision", icon: BookOpen, alwaysAvailable: true },
  { id: "executiveSummary", label: "Executive Summary", description: "Project overview and statistics", icon: FileText, alwaysAvailable: true },
  { id: "systemArchitecture", label: "System Architecture", description: "Tasks, scheduling, program hierarchy", icon: Network, countKey: "tasks" },
  { id: "ioConfiguration", label: "I/O Configuration", description: "Module tree and catalog numbers", icon: HardDrive, countKey: "ioModules" },
  { id: "programsRoutines", label: "Programs & Routines", description: "Per-program routines and summaries", icon: Cpu, countKey: "routines" },
  { id: "tagDatabase", label: "Tag Database", description: "All tags grouped by scope", icon: Tags, countKey: "tags" },
  { id: "udts", label: "User-Defined Types", description: "UDT definitions and members", icon: Layers, countKey: "udts" },
  { id: "aois", label: "Add-On Instructions", description: "AOI definitions and parameters", icon: Package, countKey: "aois" },
  { id: "crossReference", label: "Cross-Reference", description: "Tag usage analysis across programs", icon: ListTree, countKey: "tagReferences" },
  { id: "qualityMetrics", label: "Quality Metrics", description: "Unused tags, comment coverage", icon: Activity, alwaysAvailable: true },
];

type ExportFormat = "markdown" | "pdf" | "docx";

export function ProjectManualGenerator({
  projectId,
  projectName,
  counts,
}: ProjectManualGeneratorProps) {
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const section of SECTIONS) {
      defaults[section.id] = true;
    }
    return defaults;
  });
  const [detailLevel, setDetailLevel] = useState<"standard" | "comprehensive">("standard");
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const selectAll = () => {
    const all: Record<string, boolean> = {};
    for (const section of SECTIONS) all[section.id] = true;
    setSelectedSections(all);
  };

  const selectNone = () => {
    const none: Record<string, boolean> = {};
    for (const section of SECTIONS) none[section.id] = false;
    setSelectedSections(none);
  };

  const hasSelections = Object.values(selectedSections).some(Boolean);

  const generateManual = useCallback(async (action: "preview" | "download") => {
    if (!hasSelections) {
      setError("Please select at least one section");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setPreview(null);
    setProgress({ stage: "fetching", message: "Starting generation...", current: 0, total: 0 });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const config: ManualConfig = {
        sections: selectedSections as ManualConfig["sections"],
        detailLevel,
        format,
      };

      const response = await fetch("/api/export/project-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, config }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate manual");
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let document: ManualDocument | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (eventType === "progress") {
                setProgress(parsed as GenerationProgress);
              } else if (eventType === "complete") {
                document = parsed as ManualDocument;
              } else if (eventType === "error") {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue; // partial JSON, wait for more
              throw e;
            }
          }
        }
      }

      if (!document) {
        throw new Error("No document received from server");
      }

      if (action === "preview") {
        const markdown = renderMarkdown(document);
        setPreview(markdown);
      } else {
        await downloadDocument(document);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to generate manual");
    } finally {
      setIsGenerating(false);
      setProgress(null);
      abortControllerRef.current = null;
    }
  }, [hasSelections, selectedSections, detailLevel, format, projectId]);

  const downloadDocument = async (document: ManualDocument) => {
    const date = new Date().toISOString().split("T")[0];
    const safeName = projectName.replace(/[^a-zA-Z0-9]/g, "_");

    if (format === "markdown") {
      const markdown = renderMarkdown(document);
      downloadBlob(new Blob([markdown], { type: "text/markdown" }), `${safeName}_Manual_${date}.md`);
    } else if (format === "pdf") {
      const { renderPdf } = await import("@/lib/document-generator/render-pdf");
      await renderPdf(document);
    } else if (format === "docx") {
      const { renderDocx } = await import("@/lib/document-generator/render-docx");
      const blob = await renderDocx(document);
      downloadBlob(blob, `${safeName}_Manual_${date}.docx`);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressPercent = progress
    ? progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : progress.stage === "fetching" ? 10 : progress.stage === "building" ? 30 : 50
    : 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Section Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Include Sections</h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={selectNone}>
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => {
            const count = section.countKey ? counts[section.countKey] : undefined;
            const isDisabled = count !== undefined && count === 0;

            return (
              <Card
                key={section.id}
                className={`cursor-pointer transition-colors ${
                  selectedSections[section.id] && !isDisabled
                    ? "border-primary bg-primary/5"
                    : isDisabled
                    ? "opacity-50"
                    : "hover:bg-accent/50"
                }`}
                onClick={() => !isDisabled && toggleSection(section.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Checkbox
                    checked={selectedSections[section.id] && !isDisabled}
                    disabled={isDisabled}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  <section.icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Label className="cursor-pointer font-medium">{section.label}</Label>
                    <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                    {count !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        {count} item{count === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Detail Level */}
      <div className="space-y-3">
        <h3 className="font-medium">Detail Level</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Card
            className={`cursor-pointer transition-colors ${
              detailLevel === "standard" ? "border-primary bg-primary/5" : "hover:bg-accent/50"
            }`}
            onClick={() => setDetailLevel("standard")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                detailLevel === "standard" ? "border-primary" : "border-muted-foreground"
              }`}>
                {detailLevel === "standard" && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <div>
                <Label className="cursor-pointer font-medium">Standard</Label>
                <p className="text-xs text-muted-foreground">Data tables and structural content only</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-colors ${
              detailLevel === "comprehensive"
                ? "border-amber-500 bg-amber-500/5"
                : "hover:bg-accent/50"
            }`}
            onClick={() => setDetailLevel("comprehensive")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                detailLevel === "comprehensive" ? "border-amber-500" : "border-muted-foreground"
              }`}>
                {detailLevel === "comprehensive" && <div className="h-2 w-2 rounded-full bg-amber-500" />}
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <Label className="cursor-pointer font-medium flex items-center gap-1.5">
                    Comprehensive
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  </Label>
                  <p className="text-xs text-muted-foreground">Includes AI-generated narratives and summaries</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Export Format */}
      <div className="space-y-3">
        <h3 className="font-medium">Export Format</h3>
        <div className="flex gap-3">
          {([
            { value: "markdown" as const, label: "Markdown", icon: FileText },
            { value: "pdf" as const, label: "PDF", icon: FileText },
            { value: "docx" as const, label: "DOCX", icon: FileText },
          ]).map((opt) => (
            <Button
              key={opt.value}
              variant={format === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFormat(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Progress */}
      {isGenerating && progress && (
        <Card>
          <CardContent className="py-6 space-y-3">
            <div className="flex items-center gap-3">
              {detailLevel === "comprehensive" && progress.stage === "narrating" ? (
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              ) : (
                <BarChart3 className="h-5 w-5 text-primary animate-pulse" />
              )}
              <span className="text-sm font-medium">{progress.message}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => generateManual("preview")}
          variant="outline"
          disabled={!hasSelections || isGenerating}
        >
          <FileText className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          onClick={() => generateManual("download")}
          disabled={!hasSelections || isGenerating}
        >
          <Download className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : `Download ${format.toUpperCase()}`}
        </Button>
      </div>

      {/* Preview */}
      {preview && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <h4 className="font-medium">Preview</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
              >
                Close
              </Button>
            </div>
            <pre className="p-4 overflow-auto text-sm font-mono bg-muted/30 max-h-[500px] whitespace-pre-wrap">
              {preview}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
