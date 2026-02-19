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
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" className="flex-shrink-0 mt-0.5" asChild>
          <Link href={`/dashboard/projects/${projectId}/analysis/naming`}>
            <FileCheck className="h-3.5 w-3.5 mr-1.5" />
            Naming Validation
          </Link>
        </Button>
        <span className="w-px self-stretch bg-border" />
        <Switch
          id="naming-health-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isPending}
          className="mt-1 flex-shrink-0"
        />
        <div className="space-y-0.5">
          <label className="text-sm font-medium cursor-pointer" htmlFor="naming-health-toggle">
            Include in health score
          </label>
          <p className="text-xs text-muted-foreground">
            Naming rule violations affect the Naming Compliance metric (20% of score).
          </p>
        </div>
      </div>
    </div>
  );
}
