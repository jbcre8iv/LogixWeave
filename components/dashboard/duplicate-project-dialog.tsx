"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface DuplicateProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: DuplicateProjectDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(`Copy of ${projectName}`);
  const [includeFiles, setIncludeFiles] = useState(true);
  const [includeNamingRules, setIncludeNamingRules] = useState(true);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(`Copy of ${projectName}`);
      setIncludeFiles(true);
      setIncludeNamingRules(true);
      setError(null);
    }
  }, [open, projectName]);

  const handleDuplicate = async () => {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setDuplicating(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          includeFiles,
          includeNamingRules,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to duplicate project");
      }

      const { projectId: newProjectId } = await response.json();

      window.dispatchEvent(new CustomEvent("project-updated"));
      onOpenChange(false);
      router.push(`/dashboard/projects/${newProjectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate project");
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate Project</DialogTitle>
          <DialogDescription>
            Create a copy of &ldquo;{projectName}&rdquo; with a new name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="duplicate-project-name">Project Name</Label>
            <Input
              id="duplicate-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              disabled={duplicating}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleDuplicate();
                }
              }}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-files"
                checked={includeFiles}
                onCheckedChange={(checked) => setIncludeFiles(checked === true)}
                disabled={duplicating}
              />
              <Label htmlFor="include-files" className="text-sm font-normal cursor-pointer">
                Include files & parsed data
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-naming-rules"
                checked={includeNamingRules}
                onCheckedChange={(checked) => setIncludeNamingRules(checked === true)}
                disabled={duplicating}
              />
              <Label htmlFor="include-naming-rules" className="text-sm font-normal cursor-pointer">
                Include naming rules
              </Label>
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={duplicating}>
            Cancel
          </Button>
          <Button onClick={handleDuplicate} disabled={duplicating || !name.trim()}>
            {duplicating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Duplicating...
              </>
            ) : (
              "Duplicate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
