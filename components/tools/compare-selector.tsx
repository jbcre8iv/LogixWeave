"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, GitCompare, Loader2, Plus, Minus, RefreshCw } from "lucide-react";

interface ProjectFile {
  id: string;
  file_name: string;
  parsing_status: string;
}

interface Project {
  id: string;
  name: string;
  project_files: ProjectFile[];
}

interface CompareSelectorProps {
  projects: Project[];
}

interface ComparisonResult {
  tags: {
    added: Array<{ name: string; data_type: string }>;
    removed: Array<{ name: string; data_type: string }>;
    modified: Array<{ name: string; data_type: string; changes: string[] }>;
  };
  routines: {
    added: Array<{ name: string; program_name: string; type: string }>;
    removed: Array<{ name: string; program_name: string; type: string }>;
    modified: Array<{ name: string; program_name: string; changes: string[] }>;
  };
  modules: {
    added: Array<{ name: string; catalog_number: string | null }>;
    removed: Array<{ name: string; catalog_number: string | null }>;
    modified: Array<{ name: string; changes: string[] }>;
  };
  summary: {
    totalChanges: number;
    tagsChanged: number;
    routinesChanged: number;
    modulesChanged: number;
  };
}

export function CompareSelector({ projects }: CompareSelectorProps) {
  const [file1, setFile1] = useState<string>("");
  const [file2, setFile2] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allFiles = projects.flatMap((p) =>
    p.project_files.map((f) => ({
      ...f,
      projectName: p.name,
      projectId: p.id,
    }))
  );

  const handleCompare = async () => {
    if (!file1 || !file2) return;
    if (file1 === file2) {
      setError("Please select two different files to compare");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/compare?file1=${file1}&file2=${file2}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to compare files");
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getFile1Info = () => allFiles.find((f) => f.id === file1);
  const getFile2Info = () => allFiles.find((f) => f.id === file2);

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No files to compare</h3>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            Upload L5X/L5K files to your projects first. Files need to be fully parsed
            before they can be compared.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Files to Compare</CardTitle>
          <CardDescription>
            Choose two parsed L5X/L5K files to see their differences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <label className="text-sm font-medium mb-2 block">Base File (Original)</label>
              <Select value={file1} onValueChange={setFile1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select base file..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <div key={project.id}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {project.name}
                      </div>
                      {project.project_files.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          {file.file_name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />

            <div className="flex-1 w-full">
              <label className="text-sm font-medium mb-2 block">Compare File (Modified)</label>
              <Select value={file2} onValueChange={setFile2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select compare file..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <div key={project.id}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {project.name}
                      </div>
                      {project.project_files.map((file) => (
                        <SelectItem key={file.id} value={file.id}>
                          {file.file_name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCompare}
              disabled={!file1 || !file2 || loading}
              className="w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <GitCompare className="mr-2 h-4 w-4" />
                  Compare
                </>
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Comparison Results</CardTitle>
                <CardDescription>
                  {getFile1Info()?.file_name} → {getFile2Info()?.file_name}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-green-600">
                  <Plus className="h-3 w-3 mr-1" />
                  {result.tags.added.length + result.routines.added.length + result.modules.added.length} Added
                </Badge>
                <Badge variant="outline" className="text-red-600">
                  <Minus className="h-3 w-3 mr-1" />
                  {result.tags.removed.length + result.routines.removed.length + result.modules.removed.length} Removed
                </Badge>
                <Badge variant="outline" className="text-yellow-600">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {result.tags.modified.length + result.routines.modified.length + result.modules.modified.length} Modified
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tags">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tags">
                  Tags ({result.summary.tagsChanged})
                </TabsTrigger>
                <TabsTrigger value="routines">
                  Routines ({result.summary.routinesChanged})
                </TabsTrigger>
                <TabsTrigger value="modules">
                  I/O Modules ({result.summary.modulesChanged})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tags" className="mt-4">
                <ComparisonSection
                  added={result.tags.added.map((t) => ({ name: t.name, detail: t.data_type }))}
                  removed={result.tags.removed.map((t) => ({ name: t.name, detail: t.data_type }))}
                  modified={result.tags.modified.map((t) => ({ name: t.name, changes: t.changes }))}
                  emptyMessage="No tag differences found"
                />
              </TabsContent>

              <TabsContent value="routines" className="mt-4">
                <ComparisonSection
                  added={result.routines.added.map((r) => ({ name: r.name, detail: `${r.program_name} (${r.type})` }))}
                  removed={result.routines.removed.map((r) => ({ name: r.name, detail: `${r.program_name} (${r.type})` }))}
                  modified={result.routines.modified.map((r) => ({ name: r.name, changes: r.changes }))}
                  emptyMessage="No routine differences found"
                />
              </TabsContent>

              <TabsContent value="modules" className="mt-4">
                <ComparisonSection
                  added={result.modules.added.map((m) => ({ name: m.name, detail: m.catalog_number || "" }))}
                  removed={result.modules.removed.map((m) => ({ name: m.name, detail: m.catalog_number || "" }))}
                  modified={result.modules.modified.map((m) => ({ name: m.name, changes: m.changes }))}
                  emptyMessage="No I/O module differences found"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ComparisonSectionProps {
  added: Array<{ name: string; detail: string }>;
  removed: Array<{ name: string; detail: string }>;
  modified: Array<{ name: string; changes: string[] }>;
  emptyMessage: string;
}

function ComparisonSection({ added, removed, modified, emptyMessage }: ComparisonSectionProps) {
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {added.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Added ({added.length})
          </h4>
          <div className="space-y-1">
            {added.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 rounded text-sm">
                <span className="font-mono">{item.name}</span>
                {item.detail && <Badge variant="outline">{item.detail}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {removed.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
            <Minus className="h-4 w-4" />
            Removed ({removed.length})
          </h4>
          <div className="space-y-1">
            {removed.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                <span className="font-mono">{item.name}</span>
                {item.detail && <Badge variant="outline">{item.detail}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {modified.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-yellow-600 mb-2 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Modified ({modified.length})
          </h4>
          <div className="space-y-1">
            {modified.map((item, i) => (
              <div key={i} className="p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded text-sm">
                <span className="font-mono font-medium">{item.name}</span>
                <ul className="mt-1 text-xs text-muted-foreground">
                  {item.changes.map((change, j) => (
                    <li key={j}>• {change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
