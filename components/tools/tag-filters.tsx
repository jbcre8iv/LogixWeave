"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

interface TagFiltersProps {
  scopes: string[];
  dataTypes: string[];
}

export function TagFilters({ scopes, dataTypes }: TagFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const scope = searchParams.get("scope") || "";
  const dataType = searchParams.get("dataType") || "";

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString());

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === "") {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });

      // Reset page when filters change
      if (!("page" in params)) {
        newParams.delete("page");
      }

      return newParams.toString();
    },
    [searchParams]
  );

  const updateParam = (key: string, value: string | null) => {
    const queryString = createQueryString({ [key]: value });
    router.push(`${pathname}?${queryString}`);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = search || scope || dataType;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tag names..."
          value={search}
          onChange={(e) => updateParam("search", e.target.value || null)}
          className="pl-9"
        />
      </div>

      <Select value={scope} onValueChange={(value) => updateParam("scope", value === "all" ? null : value)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Scopes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Scopes</SelectItem>
          {scopes.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={dataType} onValueChange={(value) => updateParam("dataType", value === "all" ? null : value)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Data Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Data Types</SelectItem>
          {dataTypes.map((dt) => (
            <SelectItem key={dt} value={dt}>
              {dt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" onClick={clearFilters} size="icon">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
