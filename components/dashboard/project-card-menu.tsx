"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import { ShareProjectDialog } from "@/components/dashboard/share-project-dialog";
import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { DuplicateProjectDialog } from "@/components/dashboard/duplicate-project-dialog";
import {
  MoreVertical,
  FolderOpen,
  Star,
  Pencil,
  Share2,
  Copy,
  Archive,
  Trash2,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  is_archived?: boolean;
  created_by?: string;
  project_files: { count: number } | Array<unknown>;
}

interface ProjectCardMenuProps {
  project: Project;
  isOwner: boolean;
  onToggleFavorite: (id: string, currentValue: boolean, e: React.MouseEvent) => void;
}

export function ProjectCardMenu({ project, isOwner, onToggleFavorite }: ProjectCardMenuProps) {
  const router = useRouter();
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent AlertDialogAction from auto-closing the dialog
    setActionLoading("archive");
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [project.id],
          action: "archive",
          value: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to archive");

      router.refresh();
    } catch (error) {
      console.error("Failed to archive:", error);
    } finally {
      setActionLoading(null);
      setArchiveDialogOpen(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent AlertDialogAction from auto-closing the dialog
    setActionLoading("delete");
    try {
      const response = await fetch("/api/projects/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [project.id],
        }),
      });

      if (!response.ok) throw new Error("Failed to delete");

      window.location.href = "/dashboard/projects";
    } catch (error) {
      console.error("Failed to delete:", error);
      setActionLoading(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleLeave = async (e: React.MouseEvent) => {
    e.preventDefault();
    setActionLoading("leave");
    try {
      const response = await fetch(`/api/projects/${project.id}/leave`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to leave");

      window.location.href = "/dashboard/projects";
    } catch (error) {
      console.error("Failed to leave project:", error);
      setActionLoading(null);
      setLeaveDialogOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
          >
            <FolderOpen className="h-4 w-4" />
            Open Project
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => onToggleFavorite(project.id, project.is_favorite, e as unknown as React.MouseEvent)}
          >
            <Star
              className={cn(
                "h-4 w-4",
                project.is_favorite
                  ? "fill-yellow-400 text-yellow-400"
                  : ""
              )}
            />
            {project.is_favorite ? "Unfavorite" : "Favorite"}
          </DropdownMenuItem>
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                <Share2 className="h-4 w-4" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
                <Copy className="h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)}>
                <Archive className="h-4 w-4" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </>
          )}
          {!isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setLeaveDialogOpen(true)}
              >
                <LogOut className="h-4 w-4" />
                Leave Project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      {isOwner && (
        <EditProjectDialog
          projectId={project.id}
          projectName={project.name}
          projectDescription={project.description}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      {/* Share dialog */}
      {isOwner && (
        <ShareProjectDialog
          projectId={project.id}
          projectName={project.name}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
        />
      )}

      {/* Duplicate dialog */}
      {isOwner && (
        <DuplicateProjectDialog
          projectId={project.id}
          projectName={project.name}
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
        />
      )}

      {/* Archive confirmation dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This project will be hidden from tools and the sidebar but can be restored at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === "archive"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={actionLoading === "archive"}
            >
              {actionLoading === "archive" ? (
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All files and parsed data associated with this project will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading === "delete"}
            >
              {actionLoading === "delete" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave project confirmation dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave &ldquo;{project.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this project and its files. To rejoin, the owner will need to invite you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === "leave"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading === "leave"}
            >
              {actionLoading === "leave" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Leaving...
                </>
              ) : (
                "Leave Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
