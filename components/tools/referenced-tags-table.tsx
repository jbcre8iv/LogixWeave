"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableTableHead } from "@/components/tools/sortable-table-head";

interface ReferencedTag {
  name: string;
  referenceCount: number;
  usageTypes: string[];
  routines: string[];
}

interface ReferencedTagsTableProps {
  tags: ReferencedTag[];
  totalCount: number;
  page: number;
  pageSize: number;
  projectId: string;
  search?: string;
  usage?: string;
}

function UsageBadge({ type }: { type: string }) {
  const label = type.toLowerCase();
  const className =
    label === "write"
      ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30"
      : label === "read"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
        : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";

  return <Badge variant="outline" className={`text-xs ${className}`}>{type}</Badge>;
}

export function ReferencedTagsTable({
  tags,
  totalCount,
  page,
  pageSize,
  projectId,
  search,
  usage,
}: ReferencedTagsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(search || "");

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "references");
    if (newPage === 1) {
      params.delete("page");
    } else {
      params.set("page", newPage.toString());
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "references");
    params.delete("page");
    if (searchValue) {
      params.set("search", searchValue);
    } else {
      params.delete("search");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleUsageFilter = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "references");
    params.delete("page");
    if (value && value !== "all") {
      params.set("usage", value);
    } else {
      params.delete("usage");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Search Referenced Tags</CardTitle>
          <CardDescription>
            {totalCount} unique tags found in ladder logic
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tag names..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={usage || "all"} onValueChange={handleUsageFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Usage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Usage</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="write">Write</SelectItem>
                <SelectItem value="read/write">Read/Write</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="name" className="w-[300px]">Tag Name</SortableTableHead>
              <SortableTableHead column="referenceCount" defaultOrder="desc" className="w-[120px]">References</SortableTableHead>
              <SortableTableHead column="usageTypes" className="w-[150px]">Usage</SortableTableHead>
              <SortableTableHead column="routines" defaultOrder="desc" className="w-[150px]">Found In</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No referenced tags found
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.name}>
                  <TableCell className="font-mono text-sm">{tag.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tag.referenceCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {tag.usageTypes.map((type) => (
                        <UsageBadge key={type} type={type} />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                    <div className="flex gap-1 flex-wrap">
                      {tag.routines.slice(0, 3).map((routine) => (
                        <Badge key={routine} variant="secondary" className="text-xs font-normal">
                          {routine}
                        </Badge>
                      ))}
                      {tag.routines.length > 3 && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          +{tag.routines.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex} to {endIndex} of {totalCount} tags
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
