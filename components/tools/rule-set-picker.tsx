"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
}

export function RuleSetPicker({ projectId, ruleSets, currentRuleSetId, className }: RuleSetPickerProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleChange = async (value: string) => {
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

  const selectValue = currentRuleSetId || "org-default";

  return (
    <Select value={selectValue} onValueChange={handleChange} disabled={isUpdating}>
      <SelectTrigger className={className || "w-[220px]"}>
        <SelectValue placeholder="Select rule set..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="org-default">
          <span className="flex items-center gap-2">
            Use organization default
          </span>
        </SelectItem>
        {ruleSets.map((rs) => (
          <SelectItem key={rs.id} value={rs.id}>
            <span className="flex items-center gap-2">
              {rs.name}
              {rs.is_default && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  Default
                </Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
