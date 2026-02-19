"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface NamingHealthToggleProps {
  projectId: string;
  enabled: boolean;
}

export function NamingHealthToggle({ projectId, enabled: initialEnabled }: NamingHealthToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked);
    try {
      const res = await fetch(`/api/projects/${projectId}/naming-health-toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) {
        setEnabled(!checked);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setEnabled(!checked);
    }
  };

  return (
    <div className="rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/projects/${projectId}/analysis/naming`}>
            <FileCheck className="h-3.5 w-3.5 mr-1.5" />
            Naming Validation
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground cursor-pointer" htmlFor="naming-health-toggle">
            Include in health score
          </label>
          <Switch
            id="naming-health-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  );
}
