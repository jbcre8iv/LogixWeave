"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";

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
        setEnabled(!checked); // revert on error
        return;
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setEnabled(!checked); // revert on error
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isPending}
        className="mt-0.5"
      />
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-none">
          Include in health score
        </p>
        <p className="text-xs text-muted-foreground">
          When enabled, naming rule violations count toward your project health score.
          Tags that don&apos;t match your configured naming rules will lower the
          Naming Compliance metric (20% of overall score).
        </p>
      </div>
    </div>
  );
}
