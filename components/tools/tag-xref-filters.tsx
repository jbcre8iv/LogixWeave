"use client";

import { useCallback, useState, useEffect, useRef } from "react";
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

interface TagXrefFiltersProps {
  programs: string[];
}

export function TagXrefFilters({ programs }: TagXrefFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get("search") || "";
  const usageType = searchParams.get("usageType") || "";
  const program = searchParams.get("program") || "";
  const [searchValue, setSearchValue] = useState(search);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setSearchValue(search); }, [search]);

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

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateParam("search", value || null);
    }, 300);
  };

  const clearSearch = () => {
    setSearchValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    updateParam("search", null);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const hasFilters = search || usageType || program;

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tag names..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Select value={usageType} onValueChange={(value) => updateParam("usageType", value === "all" ? null : value)}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="All Usage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Usage</SelectItem>
          <SelectItem value="read">Read</SelectItem>
          <SelectItem value="write">Write</SelectItem>
          <SelectItem value="both">Read/Write</SelectItem>
        </SelectContent>
      </Select>

      <Select value={program} onValueChange={(value) => updateParam("program", value === "all" ? null : value)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Programs" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Programs</SelectItem>
          {programs.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
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
