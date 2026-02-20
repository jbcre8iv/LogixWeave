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
import { getTimestampSuffix } from "@/lib/utils";

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
  defaultDetailLevel?: "standard" | "comprehensive";
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
  { id: "projectHealth", label: "Project Health", description: "Health score, findings, action items", icon: Activity, alwaysAvailable: true },
];

type ExportFormat = "markdown" | "pdf" | "docx";

export function ProjectManualGenerator({
  projectId,
  projectName,
  counts,
  defaultDetailLevel = "standard",
}: ProjectManualGeneratorProps) {
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    for (const section of SECTIONS) {
      defaults[section.id] = true;
    }
    return defaults;
  });
  const [detailLevel, setDetailLevel] = useState<"standard" | "comprehensive">(defaultDetailLevel);
  const [format, setFormat] = useState<ExportFormat>("pdf");
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

      if (action === "preview" && format === "markdown") {
        const markdown = renderMarkdown(document);
        setPreview(markdown);
      } else {
        // For PDF/DOCX preview is the same as download (can't inline-preview binary formats)
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
    const timestamp = getTimestampSuffix();
    const safeName = projectName.replace(/[^a-zA-Z0-9]/g, "_");

    if (format === "markdown") {
      const markdown = renderMarkdown(document);
      downloadBlob(new Blob([markdown], { type: "text/markdown" }), `${safeName}_Manual_${timestamp}.md`);
    } else if (format === "pdf") {
      const { renderPdf } = await import("@/lib/document-generator/render-pdf");
      await renderPdf(document);
    } else if (format === "docx") {
      const { renderDocx } = await import("@/lib/document-generator/render-docx");
      const blob = await renderDocx(document);
      downloadBlob(blob, `${safeName}_Manual_${timestamp}.docx`);
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

  // Build summary description for the download area
  const selectedCount = SECTIONS.filter((s) => {
    const count = s.countKey ? counts[s.countKey] : undefined;
    const isDisabled = count !== undefined && count === 0;
    return selectedSections[s.id] && !isDisabled;
  });
  const sectionNames = selectedCount.map((s) => s.label);
  const summaryParts: string[] = [];
  if (sectionNames.length > 0) {
    if (sectionNames.length <= 3) {
      summaryParts.push(sectionNames.join(", "));
    } else {
      summaryParts.push(`${sectionNames.slice(0, 2).join(", ")} +${sectionNames.length - 2} more`);
    }
  }
  summaryParts.push(detailLevel === "comprehensive" ? "with AI narratives" : "structural data only");
  const summaryText = summaryParts.join(" \u2014 ");

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Section Selection */}
      <div className="space-y-3">
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

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => {
            const count = section.countKey ? counts[section.countKey] : undefined;
            const isDisabled = count !== undefined && count === 0;

            return (
              <div
                key={section.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  selectedSections[section.id] && !isDisabled
                    ? "border-primary bg-primary/5"
                    : isDisabled
                    ? "opacity-50 cursor-default"
                    : "hover:bg-accent/50"
                }`}
                onClick={() => !isDisabled && toggleSection(section.id)}
              >
                <Checkbox
                  checked={selectedSections[section.id] && !isDisabled}
                  disabled={isDisabled}
                  onCheckedChange={() => toggleSection(section.id)}
                  className="flex-shrink-0"
                />
                <section.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium leading-tight">{section.label}</span>
                    {count !== undefined && (
                      <span className="text-[11px] text-muted-foreground">({count})</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">{section.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Level */}
      <div className="space-y-2">
        <h3 className="font-medium">Detail Level</h3>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <div
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
              detailLevel === "standard" ? "border-primary bg-primary/5" : "hover:bg-accent/50"
            }`}
            onClick={() => setDetailLevel("standard")}
          >
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              detailLevel === "standard" ? "border-primary" : "border-muted-foreground"
            }`}>
              {detailLevel === "standard" && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            <div>
              <span className="text-sm font-medium">Standard</span>
              <p className="text-[11px] text-muted-foreground leading-tight">Data tables and structural content only</p>
            </div>
          </div>
          <div
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors lg:col-start-1 ${
              detailLevel === "comprehensive"
                ? "border-amber-500 bg-amber-500/5"
                : "hover:bg-accent/50"
            }`}
            onClick={() => setDetailLevel("comprehensive")}
          >
            <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              detailLevel === "comprehensive" ? "border-amber-500" : "border-muted-foreground"
            }`}>
              {detailLevel === "comprehensive" && <div className="h-2 w-2 rounded-full bg-amber-500" />}
            </div>
            <div>
              <span className="text-sm font-medium flex items-center gap-1.5">
                Comprehensive
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              </span>
              <p className="text-[11px] text-muted-foreground leading-tight">Includes AI-generated narratives and summaries</p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Format */}
      <div className="space-y-2">
        <h3 className="font-medium">Export Format</h3>
        <div className="flex gap-2">
          {([
            { value: "pdf" as const, label: "PDF" },
            { value: "docx" as const, label: "DOCX" },
            { value: "markdown" as const, label: "Markdown" },
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
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-3">
            {detailLevel === "comprehensive" && progress.stage === "narrating" ? (
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            ) : (
              <BarChart3 className="h-4 w-4 text-primary animate-pulse" />
            )}
            <span className="text-sm font-medium">{progress.message}</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        {format === "markdown" && (
          <Button
            onClick={() => generateManual("preview")}
            variant="outline"
            size="sm"
            disabled={!hasSelections || isGenerating}
          >
            <FileText className="h-4 w-4 mr-2" />
            Preview
          </Button>
        )}
        <Button
          onClick={() => generateManual("download")}
          disabled={!hasSelections || isGenerating}
        >
          <Download className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : `Download ${format.toUpperCase()}`}
        </Button>
        {hasSelections && !isGenerating && (
          <span className="text-xs text-muted-foreground">
            {selectedCount.length} section{selectedCount.length === 1 ? "" : "s"} — {summaryText}
          </span>
        )}
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
