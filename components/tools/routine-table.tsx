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
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { SortableTableHead } from "@/components/tools/sortable-table-head";

interface Routine {
  id: string;
  name: string;
  program_name: string;
  type: string;
  description: string | null;
  rung_count: number | null;
  file_name?: string;
}

interface RoutineTableProps {
  routines: Routine[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function RoutineTable({ routines, totalCount, page, pageSize }: RoutineTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const hasDescription = (routine: Routine) => {
    return routine.description && routine.description.trim().length > 0;
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type.toLowerCase()) {
      case "ladder":
        return "default";
      case "fbd":
        return "secondary";
      case "st":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <SortableTableHead column="name" className="w-[200px]">Name</SortableTableHead>
              <SortableTableHead column="program_name" className="w-[180px]">Program</SortableTableHead>
              <SortableTableHead column="type" className="w-[100px]">Type</SortableTableHead>
              <SortableTableHead column="rung_count" defaultOrder="desc" className="w-[80px]">Rungs</SortableTableHead>
              <TableHead>File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No routines found
                </TableCell>
              </TableRow>
            ) : (
              routines.map((routine) => (
                <>
                  <TableRow key={routine.id}>
                    <TableCell>
                      {hasDescription(routine) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleRow(routine.id)}
                        >
                          {expandedRows.has(routine.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{routine.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{routine.program_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(routine.type)}>
                        {routine.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {routine.rung_count !== null ? routine.rung_count : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {routine.file_name || "-"}
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(routine.id) && hasDescription(routine) && (
                    <TableRow key={`${routine.id}-expanded`}>
                      <TableCell colSpan={6} className="bg-muted/50">
                        <div className="p-4">
                          <p className="text-sm font-medium mb-2">Description</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {routine.description}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex} to {endIndex} of {totalCount} routines
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
