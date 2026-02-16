"use client";

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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SortableTableHead } from "@/components/tools/sortable-table-head";

interface TagReference {
  id: string;
  tag_name: string;
  routine_name: string;
  program_name: string;
  rung_number: number;
  usage_type: "read" | "write" | "both";
}

interface TagXrefTableProps {
  references: TagReference[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function TagXrefTable({ references, totalCount, page, pageSize }: TagXrefTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete("page");
    } else {
      params.set("page", newPage.toString());
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const getUsageBadgeClass = (usage: string) => {
    const label = usage.toLowerCase();
    if (label === "write") return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    if (label === "read") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="tag_name" className="w-[250px]">Tag Name</SortableTableHead>
              <SortableTableHead column="program_name" className="w-[150px]">Program</SortableTableHead>
              <SortableTableHead column="routine_name" className="w-[150px]">Routine</SortableTableHead>
              <SortableTableHead column="rung_number" className="w-[100px]">Rung</SortableTableHead>
              <SortableTableHead column="usage_type" className="w-[100px]">Usage</SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {references.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No tag references found
                </TableCell>
              </TableRow>
            ) : (
              references.map((ref) => (
                <TableRow key={ref.id}>
                  <TableCell className="font-mono text-sm">{ref.tag_name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ref.program_name}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{ref.routine_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ref.rung_number}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${getUsageBadgeClass(ref.usage_type)}`}>
                      {ref.usage_type === "both" ? "Read/Write" : ref.usage_type}
                    </Badge>
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
            Showing {startIndex} to {endIndex} of {totalCount} references
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
