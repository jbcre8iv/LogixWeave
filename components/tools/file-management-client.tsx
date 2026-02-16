"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/tools/file-uploader";
import { DownloadAllButton } from "@/components/tools/download-all-button";
import { FileBrowser } from "@/components/tools/file-browser";
import { RefreshCw, Loader2 } from "lucide-react";

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
}

export function FileManagementClient({
  projectId,
  projectName,
  files,
  folders,
}: FileManagementClientProps) {
  const router = useRouter();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isReparsingAll, setIsReparsingAll] = useState(false);
  const [reparseProgress, setReparseProgress] = useState({ done: 0, total: 0 });

  const completedFiles = files.filter((f) => f.parsing_status === "completed" || f.parsing_status === "failed");

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
          />
        </CardContent>
      </Card>
    </>
  );
}
