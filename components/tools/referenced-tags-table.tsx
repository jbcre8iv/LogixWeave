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
}

function UsageBadge({ type }: { type: string }) {
  const variant = type === "Write"
    ? "destructive"
    : type === "Read"
    ? "secondary"
    : "default";

  return <Badge variant={variant} className="text-xs">{type}</Badge>;
}

export function ReferencedTagsTable({
  tags,
  totalCount,
  page,
  pageSize,
  projectId,
  search,
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
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Tag Name</TableHead>
              <TableHead className="w-[120px]">References</TableHead>
              <TableHead className="w-[150px]">Usage</TableHead>
              <TableHead>Found In</TableHead>
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
