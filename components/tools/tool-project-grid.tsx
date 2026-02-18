"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FolderOpen,
  LayoutGrid,
  List,
  ArrowRight,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MiniHealthRing } from "@/components/dashboard/mini-health-ring";

type SortOption = "name" | "stat" | "health";

export interface ToolProjectItem {
  id: string;
  name: string;
  href: string;
  healthScore: number | null;
  hasPartialExports?: boolean;
  statIcon: React.ReactNode;
  statLabel: string;
  statValue: number;
  actionLabel: string;
  cardClassName?: string;
  iconClassName?: string;
  actionClassName?: string;
}

interface ToolProjectGridProps {
  items: ToolProjectItem[];
  searchPlaceholder?: string;
  statSortLabel?: string;
  statColumnHeader?: string;
}

export function ToolProjectGrid({
  items,
  searchPlaceholder = "Search projects...",
  statSortLabel = "Stat Count",
  statColumnHeader = "Stat",
}: ToolProjectGridProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("toolProjectViewMode");
      if (saved === "grid" || saved === "list") return saved;
    }
    return "grid";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDesc, setSortDesc] = useState(false);
  const preSearchViewMode = useRef<"grid" | "list" | null>(null);

  const handleSearchChange = (query: string) => {
    if (query.trim() && !searchQuery.trim() && viewMode === "grid") {
      preSearchViewMode.current = viewMode;
      setViewMode("list");
    }
    if (!query.trim() && searchQuery.trim() && preSearchViewMode.current !== null) {
      setViewMode(preSearchViewMode.current);
      preSearchViewMode.current = null;
    }
    setSearchQuery(query);
  };

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    preSearchViewMode.current = null;
    localStorage.setItem("toolProjectViewMode", mode);
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => item.name.toLowerCase().includes(query));
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "stat":
          comparison = a.statValue - b.statValue;
          break;
        case "health":
          comparison = (a.healthScore ?? -1) - (b.healthScore ?? -1);
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

    return result;
  }, [items, searchQuery, sortBy, sortDesc]);

  return (
    <div className="space-y-4">
      {/* Search and sort toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="stat">{statSortLabel}</SelectItem>
              <SelectItem value="health">Health Score</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDesc(!sortDesc)}
          >
            <ArrowUpDown className={cn("h-4 w-4", sortDesc && "rotate-180")} />
          </Button>
        </div>
      </div>

      {/* Count + view toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredAndSorted.length} project{filteredAndSorted.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => handleViewModeChange("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => handleViewModeChange("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* No results */}
      {filteredAndSorted.length === 0 && searchQuery && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              No projects match &ldquo;{searchQuery}&rdquo;. Try a different search term.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grid view */}
      {filteredAndSorted.length > 0 && viewMode === "grid" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((item) => (
            <Link key={item.id} href={item.href}>
              <Card
                className={`h-full transition-colors ${item.cardClassName || "hover:bg-accent/50"}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen
                        className={`h-5 w-5 ${item.iconClassName || "text-primary"}`}
                      />
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                    </div>
                    <MiniHealthRing
                      score={item.healthScore}
                      approximate={item.hasPartialExports}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {item.statIcon}
                        {item.statLabel}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={item.actionClassName}
                    >
                      {item.actionLabel}{" "}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* List view — same table structure as Projects page */}
      {filteredAndSorted.length > 0 && viewMode === "list" && (
        <div className="rounded-md border overflow-hidden bg-white dark:bg-card">
          <Table className="table-fixed">
            <colgroup>
              <col />
              <col className="w-[70px]" />
              <col className="w-[70px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>{statColumnHeader}</TableHead>
                <TableHead>Health</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => router.push(item.href)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderOpen
                        className={`h-4 w-4 shrink-0 ${item.iconClassName || "text-primary"}`}
                      />
                      <span className="font-medium truncate">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{item.statValue}</TableCell>
                  <TableCell>
                    {item.healthScore !== null ? (
                      <MiniHealthRing
                        score={item.healthScore}
                        size={32}
                        approximate={item.hasPartialExports}
                      />
                    ) : (
                      <span className="text-[10px] text-muted-foreground/60">No Data</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
