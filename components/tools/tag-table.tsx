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

interface Tag {
  id: string;
  name: string;
  data_type: string;
  scope: string;
  description: string | null;
  usage: string | null;
}

interface TagTableProps {
  tags: Tag[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function TagTable({ tags, totalCount, page, pageSize }: TagTableProps) {
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

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead column="name" className="w-[250px]">Name</SortableTableHead>
              <SortableTableHead column="data_type" className="w-[150px]">Data Type</SortableTableHead>
              <SortableTableHead column="scope" className="hidden sm:table-cell w-[150px]">Scope</SortableTableHead>
              <SortableTableHead column="usage" className="w-[100px]">Usage</SortableTableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No tags found
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-mono text-sm">{tag.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{tag.data_type}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{tag.scope}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {tag.usage || "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                    {tag.description || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2">
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
