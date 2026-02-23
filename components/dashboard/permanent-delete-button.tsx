"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { permanentlyDeleteProject } from "@/lib/actions/projects";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from "lucide-react";

interface PermanentDeleteButtonProps {
  projectId: string;
  projectName: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "icon";
  onDeleted?: () => void;
}

export function PermanentDeleteButton({
  projectId,
  projectName,
  variant = "outline",
  size = "sm",
  onDeleted,
}: PermanentDeleteButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    try {
      await permanentlyDeleteProject(projectId);
      onDeleted?.();
      router.refresh();
    } catch (error) {
      console.error("Failed to permanently delete project:", error);
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Forever
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently delete &quot;{projectName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. All files and parsed data will be permanently destroyed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Forever"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
