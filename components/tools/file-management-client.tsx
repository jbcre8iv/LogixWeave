"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploader } from "@/components/tools/file-uploader";
import { DownloadAllButton } from "@/components/tools/download-all-button";
import { FileBrowser } from "@/components/tools/file-browser";

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
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

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
            <DownloadAllButton
              projectId={projectId}
              projectName={projectName}
              fileCount={files.length}
            />
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
