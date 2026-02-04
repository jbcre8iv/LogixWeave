"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileText, Tags, Cpu, HardDrive, Layers, Package } from "lucide-react";

interface DocumentationGeneratorProps {
  projectId: string;
  projectName: string;
  counts: {
    tags: number;
    routines: number;
    ioModules: number;
    udts: number;
    aois: number;
  };
}

const SECTIONS = [
  { id: "tags", label: "Tags", icon: Tags, countKey: "tags" as const },
  { id: "routines", label: "Routines", icon: Cpu, countKey: "routines" as const },
  { id: "ioModules", label: "I/O Modules", icon: HardDrive, countKey: "ioModules" as const },
  { id: "udts", label: "User Defined Types", icon: Layers, countKey: "udts" as const },
  { id: "aois", label: "Add-On Instructions", icon: Package, countKey: "aois" as const },
];

export function DocumentationGenerator({
  projectId,
  projectName,
  counts,
}: DocumentationGeneratorProps) {
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({
    tags: true,
    routines: true,
    ioModules: true,
    udts: true,
    aois: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setSelectedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const selectAll = () => {
    setSelectedSections({
      tags: true,
      routines: true,
      ioModules: true,
      udts: true,
      aois: true,
    });
  };

  const selectNone = () => {
    setSelectedSections({
      tags: false,
      routines: false,
      ioModules: false,
      udts: false,
      aois: false,
    });
  };

  const hasSelections = Object.values(selectedSections).some(Boolean);

  const generateDocumentation = async (download: boolean) => {
    if (!hasSelections) {
      setError("Please select at least one section");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/export/documentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sections: selectedSections,
          format: "markdown",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate documentation");
      }

      const markdown = await response.text();

      if (download) {
        const blob = new Blob([markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().split("T")[0];
        a.download = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}_Documentation_${date}.md`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        setPreview(markdown);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate documentation");
    } finally {
      setIsGenerating(false);
    }
  };

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
            const count = counts[section.countKey];
            const isDisabled = count === 0;

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
                  <section.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="cursor-pointer font-medium">{section.label}</Label>
                    <p className="text-sm text-muted-foreground">
                      {count} item{count === 1 ? "" : "s"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => generateDocumentation(false)}
          variant="outline"
          disabled={!hasSelections || isGenerating}
        >
          <FileText className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          onClick={() => generateDocumentation(true)}
          disabled={!hasSelections || isGenerating}
        >
          <Download className="h-4 w-4 mr-2" />
          {isGenerating ? "Generating..." : "Download Markdown"}
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
            <pre className="p-4 overflow-auto text-sm font-mono bg-muted/30 max-h-[500px]">
              {preview}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
