"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowRight,
  GitCompare,
  Loader2,
  Plus,
  Minus,
  RefreshCw,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Check,
  Download,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectFile {
  id: string;
  file_name: string;
  parsing_status: string;
  folder_id: string | null;
}

interface ProjectFolder {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  project_files: ProjectFile[];
  project_folders?: ProjectFolder[];
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

interface FolderComparisonResult {
  type: "folder";
  folder1Name: string;
  folder2Name: string;
  comparisons: Array<{
    fileName: string;
    file1Id: string;
    file2Id: string;
    result: ComparisonResult;
  }>;
  unmatchedFiles: Array<{
    fileName: string;
    fileId: string;
    side: "left" | "right";
  }>;
  summary: {
    totalFiles: number;
    matchedFiles: number;
    unmatchedLeft: number;
    unmatchedRight: number;
    filesWithChanges: number;
    totalChanges: number;
  };
}

interface FolderCompareSelectorProps {
  projects: Project[];
}

function FolderBrowserPanel({
  projects,
  selectedFolderId,
  onSelectFolder,
  label,
}: {
  projects: Project[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string, folderName: string) => void;
  label: string;
}) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(projects.map((p) => p.id))
  );
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const toggleFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getSelectedFolderInfo = () => {
    for (const project of projects) {
      const folder = (project.project_folders || []).find((f) => f.id === selectedFolderId);
      if (folder) {
        const fileCount = project.project_files.filter((f) => f.folder_id === folder.id).length;
        return { folder, projectName: project.name, fileCount };
      }
    }
    return null;
  };

  const selectedInfo = getSelectedFolderInfo();

  return (
    <div className="flex-1 min-w-0">
      <label className="text-sm font-medium mb-2 block">{label}</label>
      <Card className="border-2">
        <CardContent className="p-0">
          {/* Selected folder display */}
          <div className="px-3 py-2 border-b bg-muted/30 min-h-[52px] flex items-center">
            {selectedInfo ? (
              <div className="flex items-center gap-2 min-w-0 w-full">
                <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{selectedInfo.folder.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedInfo.projectName}</p>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {selectedInfo.fileCount} files
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click a folder below to select</p>
            )}
          </div>

          {/* Folder tree */}
          <ScrollArea className="h-[280px]">
            <div className="p-2">
              {projects.map((project) => {
                const isExpanded = expandedProjects.has(project.id);
                const folders = project.project_folders || [];
                const folderIds = new Set(folders.map((f) => f.id));
                const folderFiles = (folderId: string) =>
                  project.project_files.filter((f) => f.folder_id === folderId);
                const rootFiles = project.project_files.filter((f) => !f.folder_id || !folderIds.has(f.folder_id));

                return (
                  <div key={project.id} className="mb-1">
                    {/* Project header */}
                    <button
                      onClick={() => toggleProject(project.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <FolderOpen className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium truncate">{project.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {project.project_files.length}
                      </Badge>
                    </button>

                    {/* Project contents */}
                    {isExpanded && (
                      <div className="ml-4 border-l pl-2">
                        {/* Folders — clickable to select, expandable to preview files */}
                        {folders.map((folder) => {
                          const isFolderExpanded = expandedFolders.has(folder.id);
                          const filesInFolder = folderFiles(folder.id);
                          if (filesInFolder.length === 0) return null;

                          return (
                            <div key={folder.id} className="mb-1">
                              <button
                                onClick={() => onSelectFolder(folder.id, folder.name)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1 rounded text-left",
                                  selectedFolderId === folder.id
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted"
                                )}
                              >
                                <span
                                  onClick={(e) => toggleFolder(e, folder.id)}
                                  className="flex-shrink-0 p-0.5 -ml-0.5 rounded hover:bg-muted-foreground/10"
                                >
                                  {isFolderExpanded ? (
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </span>
                                <FolderOpen className="h-4 w-4 text-amber-500" />
                                <span className="text-sm truncate flex-1">{folder.name}</span>
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                                  {filesInFolder.length}
                                </Badge>
                                {selectedFolderId === folder.id && (
                                  <Check className="h-4 w-4 flex-shrink-0" />
                                )}
                              </button>
                              {isFolderExpanded && (
                                <div className="ml-5">
                                  {filesInFolder.map((file) => (
                                    <div
                                      key={file.id}
                                      className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground"
                                    >
                                      <FileText className="h-4 w-4 flex-shrink-0" />
                                      <span className="truncate flex-1">{file.file_name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Root files — shown as non-interactive (not in any folder) */}
                        {rootFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground"
                          >
                            <FileText className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate flex-1">{file.file_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function FileComparisonRow({ comparison }: { comparison: FolderComparisonResult["comparisons"][number] }) {
  const [open, setOpen] = useState(false);
  const { result, fileName } = comparison;
  const totalAdded = result.tags.added.length + result.routines.added.length + result.modules.added.length;
  const totalRemoved = result.tags.removed.length + result.routines.removed.length + result.modules.removed.length;
  const totalModified = result.tags.modified.length + result.routines.modified.length + result.modules.modified.length;
  const isIdentical = result.summary.totalChanges === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors",
          isIdentical ? "opacity-60" : ""
        )}>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="font-mono truncate flex-1 text-left">{fileName}</span>
          {isIdentical ? (
            <Badge variant="secondary" className="text-xs">Identical</Badge>
          ) : (
            <div className="flex gap-1.5 flex-shrink-0">
              {totalAdded > 0 && (
                <Badge variant="outline" className="text-green-600 text-xs px-1.5 py-0 h-5">
                  <Plus className="h-3 w-3 mr-0.5" />{totalAdded}
                </Badge>
              )}
              {totalRemoved > 0 && (
                <Badge variant="outline" className="text-red-600 text-xs px-1.5 py-0 h-5">
                  <Minus className="h-3 w-3 mr-0.5" />{totalRemoved}
                </Badge>
              )}
              {totalModified > 0 && (
                <Badge variant="outline" className="text-yellow-600 text-xs px-1.5 py-0 h-5">
                  <RefreshCw className="h-3 w-3 mr-0.5" />{totalModified}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {!isIdentical && (
          <div className="ml-8 mr-3 mb-3 border rounded-md overflow-hidden">
            <Tabs defaultValue="tags">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="tags" className="text-xs">
                  Tags ({result.summary.tagsChanged})
                </TabsTrigger>
                <TabsTrigger value="routines" className="text-xs">
                  Routines ({result.summary.routinesChanged})
                </TabsTrigger>
                <TabsTrigger value="modules" className="text-xs">
                  I/O Modules ({result.summary.modulesChanged})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="tags" className="p-3">
                <InlineComparisonSection
                  added={result.tags.added.map((t) => ({ name: t.name, detail: t.data_type }))}
                  removed={result.tags.removed.map((t) => ({ name: t.name, detail: t.data_type }))}
                  modified={result.tags.modified.map((t) => ({ name: t.name, changes: t.changes }))}
                  emptyMessage="No tag differences"
                />
              </TabsContent>
              <TabsContent value="routines" className="p-3">
                <InlineComparisonSection
                  added={result.routines.added.map((r) => ({ name: r.name, detail: `${r.program_name} (${r.type})` }))}
                  removed={result.routines.removed.map((r) => ({ name: r.name, detail: `${r.program_name} (${r.type})` }))}
                  modified={result.routines.modified.map((r) => ({ name: r.name, changes: r.changes }))}
                  emptyMessage="No routine differences"
                />
              </TabsContent>
              <TabsContent value="modules" className="p-3">
                <InlineComparisonSection
                  added={result.modules.added.map((m) => ({ name: m.name, detail: m.catalog_number || "" }))}
                  removed={result.modules.removed.map((m) => ({ name: m.name, detail: m.catalog_number || "" }))}
                  modified={result.modules.modified.map((m) => ({ name: m.name, changes: m.changes }))}
                  emptyMessage="No I/O module differences"
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InlineComparisonSection({
  added,
  removed,
  modified,
  emptyMessage,
}: {
  added: Array<{ name: string; detail: string }>;
  removed: Array<{ name: string; detail: string }>;
  modified: Array<{ name: string; changes: string[] }>;
  emptyMessage: string;
}) {
  const hasChanges = added.length > 0 || removed.length > 0 || modified.length > 0;

  if (!hasChanges) {
    return <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-4">
      {added.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
            <Plus className="h-3 w-3" /> Added ({added.length})
          </h5>
          <div className="space-y-0.5">
            {added.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1 bg-green-50 dark:bg-green-950/20 rounded text-xs">
                <span className="font-mono">{item.name}</span>
                {item.detail && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{item.detail}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
      {removed.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
            <Minus className="h-3 w-3" /> Removed ({removed.length})
          </h5>
          <div className="space-y-0.5">
            {removed.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1 bg-red-50 dark:bg-red-950/20 rounded text-xs">
                <span className="font-mono">{item.name}</span>
                {item.detail && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{item.detail}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
      {modified.length > 0 && (
        <div>
          <h5 className="text-xs font-medium text-yellow-600 mb-1 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Modified ({modified.length})
          </h5>
          <div className="space-y-0.5">
            {modified.map((item, i) => (
              <div key={i} className="px-2 py-1 bg-yellow-50 dark:bg-yellow-950/20 rounded text-xs">
                <span className="font-mono font-medium">{item.name}</span>
                <ul className="mt-0.5 text-[10px] text-muted-foreground">
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

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportFolderComparisonCSV(result: FolderComparisonResult) {
  const rows: string[][] = [["File Name", "Category", "Change Type", "Name", "Detail", "Changes"]];

  for (const comparison of result.comparisons) {
    const { fileName, result: r } = comparison;

    for (const tag of r.tags.added) rows.push([fileName, "Tags", "Added", tag.name, tag.data_type, ""]);
    for (const tag of r.tags.removed) rows.push([fileName, "Tags", "Removed", tag.name, tag.data_type, ""]);
    for (const tag of r.tags.modified) rows.push([fileName, "Tags", "Modified", tag.name, tag.data_type, tag.changes.join("; ")]);

    for (const routine of r.routines.added) rows.push([fileName, "Routines", "Added", routine.name, `${routine.program_name} (${routine.type})`, ""]);
    for (const routine of r.routines.removed) rows.push([fileName, "Routines", "Removed", routine.name, `${routine.program_name} (${routine.type})`, ""]);
    for (const routine of r.routines.modified) rows.push([fileName, "Routines", "Modified", routine.name, routine.program_name, routine.changes.join("; ")]);

    for (const mod of r.modules.added) rows.push([fileName, "I/O Modules", "Added", mod.name, mod.catalog_number || "", ""]);
    for (const mod of r.modules.removed) rows.push([fileName, "I/O Modules", "Removed", mod.name, mod.catalog_number || "", ""]);
    for (const mod of r.modules.modified) rows.push([fileName, "I/O Modules", "Modified", mod.name, "", mod.changes.join("; ")]);
  }

  for (const unmatched of result.unmatchedFiles) {
    rows.push([unmatched.fileName, "Unmatched", unmatched.side === "left" ? "Only in Base" : "Only in Compare", "", "", ""]);
  }

  const csvContent = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const filename = `folder_comparison_${sanitize(result.folder1Name)}_${sanitize(result.folder2Name)}_${date}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function FolderComparisonResults({ result }: { result: FolderComparisonResult }) {
  const { summary, comparisons, unmatchedFiles, folder1Name, folder2Name } = result;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Folder Comparison Results</CardTitle>
            <CardDescription>
              {folder1Name} → {folder2Name}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Badge variant="outline">
              {summary.matchedFiles} matched
            </Badge>
            {summary.filesWithChanges > 0 && (
              <Badge variant="outline" className="text-yellow-600">
                {summary.filesWithChanges} with changes
              </Badge>
            )}
            {(summary.unmatchedLeft + summary.unmatchedRight) > 0 && (
              <Badge variant="outline" className="text-orange-600">
                {summary.unmatchedLeft + summary.unmatchedRight} unmatched
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportFolderComparisonCSV(result)}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unmatched files */}
        {unmatchedFiles.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Unmatched Files ({unmatchedFiles.length})
            </h4>
            <div className="space-y-1">
              {unmatchedFiles.map((file, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded text-sm",
                    file.side === "left"
                      ? "bg-red-50 dark:bg-red-950/20"
                      : "bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="font-mono truncate flex-1">{file.fileName}</span>
                  <Badge variant="secondary" className="text-xs">
                    Only in {file.side === "left" ? folder1Name : folder2Name}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Matched file comparisons */}
        {comparisons.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              Matched Files ({comparisons.length})
            </h4>
            <div className="border rounded-md divide-y">
              {comparisons.map((comparison, i) => (
                <FileComparisonRow key={i} comparison={comparison} />
              ))}
            </div>
          </div>
        )}

        {comparisons.length === 0 && unmatchedFiles.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No files found in the selected folders.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FolderCompareSelector({ projects }: FolderCompareSelectorProps) {
  const [folder1, setFolder1] = useState<{ id: string; name: string } | null>(null);
  const [folder2, setFolder2] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FolderComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!folder1 || !folder2) return;
    if (folder1.id === folder2.id) {
      setError("Please select two different folders to compare");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({ folder1: folder1.id, folder2: folder2.id });
      const response = await fetch(`/api/compare?${params.toString()}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to compare folders");
      }
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

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
          <CardTitle>Select Folders to Compare</CardTitle>
          <CardDescription>
            Browse your projects and select a folder from each panel to compare all matched files
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            <FolderBrowserPanel
              projects={projects}
              selectedFolderId={folder1?.id ?? null}
              onSelectFolder={(id, name) => setFolder1({ id, name })}
              label="Base Folder (Original)"
            />

            <div className="flex items-center justify-center py-4 lg:py-0">
              <div className="flex flex-col items-center gap-2">
                <ArrowRight className="h-6 w-6 text-muted-foreground hidden lg:block" />
                <Button
                  onClick={handleCompare}
                  disabled={!folder1 || !folder2 || loading || folder1.id === folder2.id}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <GitCompare className="mr-2 h-4 w-4" />
                      Compare Folders
                    </>
                  )}
                </Button>
              </div>
            </div>

            <FolderBrowserPanel
              projects={projects}
              selectedFolderId={folder2?.id ?? null}
              onSelectFolder={(id, name) => setFolder2({ id, name })}
              label="Compare Folder (Modified)"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive mt-4 text-center">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && <FolderComparisonResults result={result} />}
    </div>
  );
}
