"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { emptyTrash } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { RestoreProjectButton } from "@/components/dashboard/restore-project-button";
import { PermanentDeleteButton } from "@/components/dashboard/permanent-delete-button";
import { Trash2, Loader2, FolderOpen, FileText } from "lucide-react";

interface TrashedProject {
  id: string;
  name: string;
  deleted_at: string;
  file_count: number;
}

interface TrashListProps {
  projects: TrashedProject[];
}

export function TrashList({ projects }: TrashListProps) {
  const router = useRouter();
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [emptying, setEmptying] = useState(false);

  const handleEmptyTrash = async (e: React.MouseEvent) => {
    e.preventDefault();
    setEmptying(true);
    try {
      await emptyTrash();
      router.refresh();
    } catch (error) {
      console.error("Failed to empty trash:", error);
    } finally {
      setEmptying(false);
      setEmptyDialogOpen(false);
    }
  };

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Trash2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Trash is empty</h3>
          <p className="text-muted-foreground text-sm text-center max-w-sm">
            Projects you delete will appear here for 30 days before being permanently removed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {projects.length} {projects.length === 1 ? "project" : "projects"} in trash
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setEmptyDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Empty Trash
        </Button>
      </div>

      <div className="space-y-3">
        {projects.map((project) => {
          const deletedDate = new Date(project.deleted_at);
          const expiresDate = new Date(deletedDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          const daysRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

          return (
            <Card key={project.id}>
              <CardContent className="flex items-center justify-between py-4 px-5 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FolderOpen className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{project.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>Deleted {deletedDate.toLocaleDateString()}</span>
                      <span className="text-destructive">
                        {daysRemaining === 0 ? "Expires today" : `${daysRemaining}d remaining`}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {project.file_count} {project.file_count === 1 ? "file" : "files"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <RestoreProjectButton
                    projectId={project.id}
                    projectName={project.name}
                    variant="outline"
                    size="sm"
                  />
                  <PermanentDeleteButton
                    projectId={project.id}
                    projectName={project.name}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {projects.length} {projects.length === 1 ? "project" : "projects"} in the trash.
              All files and parsed data will be destroyed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emptying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={emptying}
            >
              {emptying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Emptying...
                </>
              ) : (
                "Empty Trash"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
