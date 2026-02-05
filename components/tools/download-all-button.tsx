"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

interface DownloadAllButtonProps {
  projectId: string;
  projectName: string;
  fileCount: number;
}

export function DownloadAllButton({ projectId, projectName, fileCount }: DownloadAllButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/files/download-all?projectId=${projectId}`);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Sanitize project name for filename
      const safeProjectName = projectName.replace(/[^a-zA-Z0-9-_]/g, "_");
      a.download = `${safeProjectName}_files.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (fileCount === 0) {
    return null;
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Preparing ZIP...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Download All ({fileCount})
        </>
      )}
    </Button>
  );
}
