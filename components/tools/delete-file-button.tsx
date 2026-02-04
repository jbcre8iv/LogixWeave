"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Loader2, Trash2 } from "lucide-react";

interface DeleteFileButtonProps {
  fileId: string;
  fileName: string;
}

export function DeleteFileButton({ fileId, fileName }: DeleteFileButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Get file details to find storage path
      const { data: file } = await supabase
        .from("project_files")
        .select("storage_path")
        .eq("id", fileId)
        .single();

      if (file) {
        // Delete from storage
        await supabase.storage.from("project-files").remove([file.storage_path]);
      }

      // Delete from database (cascades to parsed data)
      await supabase.from("project_files").delete().eq("id", fileId);

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete file:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{fileName}&quot;? This will also delete all
            parsed data (tags, routines, modules) associated with this file. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
