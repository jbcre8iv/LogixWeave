"use client";

import { useState } from "react";
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
import { LogOut, Loader2 } from "lucide-react";

interface LeaveProjectButtonProps {
  projectId: string;
  projectName?: string;
}

export function LeaveProjectButton({ projectId, projectName }: LeaveProjectButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLeave = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/leave`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to leave");
      window.location.href = "/dashboard/projects";
    } catch {
      setLoading(false);
      setDialogOpen(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setDialogOpen(true)}>
        <LogOut className="h-4 w-4 mr-2" />
        Leave Project
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Leave{projectName ? ` "${projectName}"` : " this project"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this project and its files. The owner will need to invite you again to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
            >
              {loading ? (
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
