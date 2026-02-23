"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { restoreProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";

interface RestoreProjectButtonProps {
  projectId: string;
  projectName: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  onRestored?: () => void;
}

export function RestoreProjectButton({
  projectId,
  projectName,
  variant = "default",
  size = "default",
  onRestored,
}: RestoreProjectButtonProps) {
  const router = useRouter();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await restoreProject(projectId);
      onRestored?.();
      router.refresh();
    } catch (error) {
      console.error("Failed to restore project:", error);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleRestore} disabled={isRestoring}>
      {isRestoring ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4 mr-2" />
      )}
      Restore
    </Button>
  );
}
