"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface RuleSet {
  id: string;
  name: string;
  is_default: boolean;
}

interface RuleSetPickerProps {
  projectId: string;
  ruleSets: RuleSet[];
  currentRuleSetId: string | null;
  className?: string;
  mode?: "persist" | "preview";
  isCrossOrg?: boolean;
  currentSeverityFilter?: string;
}

export function RuleSetPicker({
  projectId,
  ruleSets,
  currentRuleSetId,
  className,
  mode = "persist",
  isCrossOrg = false,
  currentSeverityFilter,
}: RuleSetPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (value: string) => {
    if (mode === "preview") {
      const params = new URLSearchParams();
      if (value === "org-default") {
        // No ruleSet param needed — page will use viewer's default
      } else {
        params.set("ruleSet", value);
      }
      if (currentSeverityFilter && currentSeverityFilter !== "all") {
        params.set("severity", currentSeverityFilter);
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
      return;
    }

    setIsUpdating(true);
    try {
      const ruleSetId = value === "org-default" ? null : value;
      const response = await fetch(`/api/projects/${projectId}/rule-set`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleSetId }),
      });
      if (!response.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      console.error("Failed to update project rule set");
    } finally {
      setIsUpdating(false);
    }
  };

  const defaultSet = ruleSets.find((rs) => rs.is_default);
  const selectValue = !currentRuleSetId || (defaultSet && currentRuleSetId === defaultSet.id)
    ? "org-default"
    : currentRuleSetId;

  return (
    <Select value={selectValue} onValueChange={handleChange} disabled={isUpdating}>
      <SelectTrigger className={className || "w-[220px]"}>
        <SelectValue placeholder="Select rule set..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="org-default">
          <span className="flex items-center gap-2">
            {isCrossOrg ? "Use your org default" : "Use organization default"}
          </span>
        </SelectItem>
        {isCrossOrg && (
          <SelectItem value="project-default">
            <span className="flex items-center gap-2">
              Use project owner&apos;s rules
            </span>
          </SelectItem>
        )}
        {ruleSets.filter((rs) => !rs.is_default).map((rs) => (
          <SelectItem key={rs.id} value={rs.id}>
            <span className="flex items-center gap-2">
              {rs.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
