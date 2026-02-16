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

interface IOModule {
  id: string;
  name: string;
  catalog_number: string | null;
  parent_module: string | null;
  slot: number | null;
  connection_info: Record<string, unknown> | null;
  file_name?: string;
}

interface IOTableProps {
  modules: IOModule[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function IOTable({ modules, totalCount, page, pageSize }: IOTableProps) {
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

  const hasConnectionInfo = (module: IOModule) => {
    return module.connection_info && Object.keys(module.connection_info).length > 0;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <SortableTableHead column="name" className="w-[200px]">Name</SortableTableHead>
              <SortableTableHead column="catalog_number" className="w-[180px]">Catalog Number</SortableTableHead>
              <SortableTableHead column="parent_module" className="w-[150px]">Parent Module</SortableTableHead>
              <SortableTableHead column="slot" className="w-[80px]">Slot</SortableTableHead>
              <TableHead>File</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No I/O modules found
                </TableCell>
              </TableRow>
            ) : (
              modules.map((module) => (
                <>
                  <TableRow key={module.id}>
                    <TableCell>
                      {hasConnectionInfo(module) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleRow(module.id)}
                        >
                          {expandedRows.has(module.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{module.name}</TableCell>
                    <TableCell>
                      {module.catalog_number ? (
                        <Badge variant="outline">{module.catalog_number}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {module.parent_module ? (
                        <Badge variant="secondary">{module.parent_module}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {module.slot !== null ? module.slot : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {module.file_name || "-"}
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(module.id) && hasConnectionInfo(module) && (
                    <TableRow key={`${module.id}-expanded`}>
                      <TableCell colSpan={6} className="bg-muted/50">
                        <div className="p-4">
                          <p className="text-sm font-medium mb-2">Connection Info</p>
                          <pre className="text-xs bg-background rounded p-3 overflow-auto max-h-[200px]">
                            {JSON.stringify(module.connection_info, null, 2)}
                          </pre>
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
            Showing {startIndex} to {endIndex} of {totalCount} modules
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
