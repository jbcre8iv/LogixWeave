"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShareProjectDialog } from "@/components/dashboard/share-project-dialog";
import { Star, Share2, Archive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectActionsProps {
  projectId: string;
  projectName: string;
  isFavorite: boolean;
  isOwner: boolean;
}

export function ProjectActions({ projectId, projectName, isFavorite, isOwner }: ProjectActionsProps) {
  const router = useRouter();
  const [optimisticFavorite, setOptimisticFavorite] = useState(isFavorite);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const handleToggleFavorite = async () => {
    const prev = optimisticFavorite;
    setOptimisticFavorite(!prev);

    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [projectId],
          action: "favorite",
          value: !prev,
        }),
      });
      if (!response.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      setOptimisticFavorite(prev);
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    setArchiveLoading(true);
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [projectId],
          action: "archive",
          value: true,
        }),
      });
      if (!response.ok) throw new Error("Failed to archive");
      window.location.href = "/dashboard/projects";
    } catch {
      setArchiveLoading(false);
      setArchiveDialogOpen(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleToggleFavorite}>
        <Star className={cn("h-4 w-4", optimisticFavorite && "fill-yellow-400 text-yellow-400")} />
      </Button>
      {isOwner && (
        <>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShareDialogOpen(true)}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setArchiveDialogOpen(true)}>
            <Archive className="h-4 w-4" />
          </Button>
        </>
      )}

      {isOwner && (
        <ShareProjectDialog
          projectId={projectId}
          projectName={projectName}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &ldquo;{projectName}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This project will be hidden from tools and the sidebar but can be restored at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiveLoading}>
              {archiveLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
