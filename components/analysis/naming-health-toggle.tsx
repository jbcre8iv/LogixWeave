"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useNamingToggle } from "@/components/analysis/health-score";

interface NamingHealthToggleProps {
  projectId: string;
  enabled: boolean;
}

export function NamingHealthToggle({ projectId, enabled: initialEnabled }: NamingHealthToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const onScoreToggle = useNamingToggle();

  const handleToggle = async (checked: boolean) => {
    setEnabled(checked);
    onScoreToggle?.(checked);
    try {
      const res = await fetch(`/api/projects/${projectId}/naming-health-toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) {
        setEnabled(!checked);
        onScoreToggle?.(!checked);
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setEnabled(!checked);
      onScoreToggle?.(!checked);
    }
  };

  return (
    <div className="rounded-lg border border-dashed p-3">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="flex-shrink-0" asChild>
          <Link href={`/dashboard/projects/${projectId}/analysis/naming`}>
            <FileCheck className="h-3.5 w-3.5 mr-1.5" />
            Naming Validation
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground flex-1 min-w-0">
          When enabled, naming rule violations count toward your Naming Compliance metric (20% of overall score).
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
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
