"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Download,
  RotateCcw,
  GitCompare,
  Loader2,
  Check,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Version {
  id: string;
  version_number: number;
  file_size: number;
  uploaded_by_email: string | null;
  comment: string | null;
  created_at: string;
}

interface FileVersionHistoryProps {
  fileId: string;
  fileName: string;
  currentVersion: number;
  versionCount: number;
  projectId: string;
}

export function FileVersionHistory({
  fileId,
  fileName,
  currentVersion,
  versionCount,
  projectId,
}: FileVersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      fetchVersions();
    }
  }, [open]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/files/${fileId}/versions`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions);
      }
    } catch (error) {
      console.error("Failed to fetch versions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadVersion = async (versionNumber: number) => {
    try {
      const response = await fetch(`/api/files/${fileId}/versions/${versionNumber}`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Create versioned filename
      const nameParts = fileName.split(".");
      const extension = nameParts.pop();
      const baseName = nameParts.join(".");
      a.download = `${baseName}_v${versionNumber}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleRestore = async (versionNumber: number) => {
    if (!confirm(`Restore version ${versionNumber}? This will create a new version based on the selected version.`)) {
      return;
    }

    setRestoring(versionNumber);
    try {
      const response = await fetch(`/api/files/${fileId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionNumber }),
      });

      if (response.ok) {
        await fetchVersions();
        // Refresh the page to show updated file info
        window.location.reload();
      }
    } catch (error) {
      console.error("Restore error:", error);
    } finally {
      setRestoring(null);
    }
  };

  const toggleVersionSelection = (versionNumber: number) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionNumber)) {
        return prev.filter((v) => v !== versionNumber);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], versionNumber];
      }
      return [...prev, versionNumber];
    });
  };

  const canCompare = selectedVersions.length === 2;

  // Only show if there are multiple versions
  if (versionCount <= 1) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
        <History className="h-4 w-4 mr-1" />
        v{currentVersion}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History className="h-4 w-4 mr-1" />
          v{currentVersion} ({versionCount} versions)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            {fileName} - {versionCount} version{versionCount !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {canCompare && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm">
              Compare v{Math.min(...selectedVersions)} with v{Math.max(...selectedVersions)}
            </span>
            <Button size="sm" asChild>
              <Link
                href={`/dashboard/tools/compare?project=${projectId}&file=${fileId}&v1=${Math.min(...selectedVersions)}&v2=${Math.max(...selectedVersions)}`}
                onClick={() => setOpen(false)}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Versions
              </Link>
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground mb-2">
          Select two versions to compare them
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            versions.map((version) => {
              const isCurrent = version.version_number === currentVersion;
              const isSelected = selectedVersions.includes(version.version_number);

              return (
                <div
                  key={version.id}
                  className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                    isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleVersionSelection(version.version_number)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {version.version_number}</span>
                          {isCurrent && (
                            <Badge variant="default" className="text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                          </span>
                          <span>•</span>
                          <span>{(version.file_size / 1024).toFixed(1)} KB</span>
                        </div>
                        {version.uploaded_by_email && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            by {version.uploaded_by_email.split("@")[0]}
                          </p>
                        )}
                        {version.comment && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{version.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDownloadVersion(version.version_number)}
                        title="Download this version"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRestore(version.version_number)}
                          disabled={restoring === version.version_number}
                          title="Restore this version"
                        >
                          {restoring === version.version_number ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
