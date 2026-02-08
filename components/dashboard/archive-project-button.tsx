"use client";

import { useState } from "react";
import { archiveProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Archive } from "lucide-react";

interface ArchiveProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function ArchiveProjectButton({ projectId, projectName }: ArchiveProjectButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveProject(projectId);
    } catch (error) {
      console.error("Failed to archive project:", error);
      setIsArchiving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Archive className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive Project</DialogTitle>
          <DialogDescription>
            Archive &quot;{projectName}&quot;? It will be hidden from tools and the sidebar
            but can be restored at any time from the Projects page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isArchiving}>
            Cancel
          </Button>
          <Button onClick={handleArchive} disabled={isArchiving}>
            {isArchiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Archive Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
