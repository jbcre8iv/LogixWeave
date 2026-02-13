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

interface IOFiltersProps {
  catalogNumbers: string[];
  parentModules: string[];
}

export function IOFilters({ catalogNumbers, parentModules }: IOFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const catalogNumber = searchParams.get("catalogNumber") || "";
  const parentModule = searchParams.get("parentModule") || "";

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
    const fromParam = searchParams.get("from");
    router.push(fromParam ? `${pathname}?from=${fromParam}` : pathname);
  };

  const hasFilters = search || catalogNumber || parentModule;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search module names..."
          value={search}
          onChange={(e) => updateParam("search", e.target.value || null)}
          className="pl-9"
        />
      </div>

      <Select value={catalogNumber} onValueChange={(value) => updateParam("catalogNumber", value === "all" ? null : value)}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="All Catalog Numbers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Catalog Numbers</SelectItem>
          {catalogNumbers.map((cn) => (
            <SelectItem key={cn} value={cn}>
              {cn}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={parentModule} onValueChange={(value) => updateParam("parentModule", value === "all" ? null : value)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Parents" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Parents</SelectItem>
          {parentModules.map((pm) => (
            <SelectItem key={pm} value={pm}>
              {pm}
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
