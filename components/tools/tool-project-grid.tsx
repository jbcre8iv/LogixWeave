"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FolderOpen, LayoutGrid, List, ArrowRight } from "lucide-react";
import { MiniHealthRing } from "@/components/dashboard/mini-health-ring";

export interface ToolProjectItem {
  id: string;
  name: string;
  href: string;
  healthScore: number | null;
  hasPartialExports?: boolean;
  statIcon: React.ReactNode;
  statLabel: string;
  actionLabel: string;
  cardClassName?: string;
  iconClassName?: string;
  actionClassName?: string;
}

interface ToolProjectGridProps {
  items: ToolProjectItem[];
}

export function ToolProjectGrid({ items }: ToolProjectGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("toolProjectViewMode");
      if (saved === "grid" || saved === "list") return saved;
    }
    return "grid";
  });

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("toolProjectViewMode", mode);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
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
      ) : (
        <div className="rounded-md border overflow-hidden bg-white dark:bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Stat</TableHead>
                <TableHead className="text-center">Health</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderOpen
                        className={`h-4 w-4 ${item.iconClassName || "text-primary"}`}
                      />
                      <span className="font-medium">{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      {item.statIcon}
                      {item.statLabel}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">
                      <MiniHealthRing
                        score={item.healthScore}
                        approximate={item.hasPartialExports}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={item.actionClassName}
                      asChild
                    >
                      <Link href={item.href}>
                        {item.actionLabel}{" "}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
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
