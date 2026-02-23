"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/tools/file-uploader";
import { DownloadAllButton } from "@/components/tools/download-all-button";
import { FileBrowser } from "@/components/tools/file-browser";
import { RefreshCw, Loader2, BarChart3, Sparkles, Tags, HardDrive, ArrowRight } from "lucide-react";

interface FileItem {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  parsing_status: string;
  parsing_error?: string;
  created_at: string;
  folder_id: string | null;
  current_version?: number;
  version_count?: number;
}

interface FolderItem {
  id: string;
  name: string;
  project_id: string;
  created_at: string;
}

interface FileManagementClientProps {
  projectId: string;
  projectName: string;
  files: FileItem[];
  folders: FolderItem[];
  isAdmin?: boolean;
}

export function FileManagementClient({
  projectId,
  projectName,
  files,
  folders,
  isAdmin = false,
}: FileManagementClientProps) {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isReparsingAll, setIsReparsingAll] = useState(false);
  const [reparseProgress, setReparseProgress] = useState({ done: 0, total: 0 });

  const completedFiles = files.filter((f) => f.parsing_status === "completed" || f.parsing_status === "failed");
  const hasCompletedFiles = files.some((f) => f.parsing_status === "completed");

  const handleReparseAll = async () => {
    if (completedFiles.length === 0) return;

    setIsReparsingAll(true);
    setReparseProgress({ done: 0, total: completedFiles.length });

    for (const file of completedFiles) {
      try {
        await fetch("/api/files/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId: file.id }),
        });
      } catch (err) {
        console.error(`Re-parse failed for ${file.file_name}:`, err);
      }
      setReparseProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setIsReparsingAll(false);
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Upload L5X or L5K files exported from Studio 5000. Files will be automatically
            parsed after upload. To convert an .ACD project, open it in Studio 5000 and
            use File &rarr; Export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploader projectId={projectId} folderId={currentFolderId} />
        </CardContent>
      </Card>

      {hasCompletedFiles && (
        <div>
          <h3 className="text-lg font-semibold mb-3">What&apos;s Next</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: `/dashboard/projects/${projectId}`,
                icon: BarChart3,
                label: "Project Overview",
                description: "Health scores, charts, and project summary",
                accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
              },
              {
                href: `/dashboard/projects/${projectId}/ai`,
                icon: Sparkles,
                label: "AI Assistant",
                description: "Ask questions, explain logic, find issues",
                accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
              },
              {
                href: `/dashboard/projects/${projectId}/tags`,
                icon: Tags,
                label: "Tag Explorer",
                description: "Browse, search, and filter tags",
                accent: "text-primary bg-primary/10 border-primary/20",
              },
              {
                href: `/dashboard/projects/${projectId}/io`,
                icon: HardDrive,
                label: "I/O Mapping",
                description: "View physical I/O and modules",
                accent: "text-primary bg-primary/10 border-primary/20",
              },
            ].map(({ href, icon: Icon, label, description, accent }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{label}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Uploaded Files</CardTitle>
              <CardDescription>
                {files.length} file{files.length !== 1 ? "s" : ""}{folders.length > 0 ? ` in ${folders.length} folder${folders.length !== 1 ? "s" : ""}` : ""} in this project
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReparseAll}
                  disabled={isReparsingAll || completedFiles.length === 0}
                >
                  {isReparsingAll ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Re-parsing {reparseProgress.done}/{reparseProgress.total}...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Re-parse All
                    </>
                  )}
                </Button>
              )}
              <DownloadAllButton
                projectId={projectId}
                projectName={projectName}
                fileCount={files.length}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FileBrowser
            projectId={projectId}
            files={files}
            folders={folders}
            onFolderChange={setCurrentFolderId}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </>
  );
}
