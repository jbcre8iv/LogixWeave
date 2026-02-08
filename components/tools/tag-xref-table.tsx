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
import { ExportCSVButton } from "@/components/export-csv-button";

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
  allReferences: TagReference[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function TagXrefTable({ references, allReferences, totalCount, page, pageSize }: TagXrefTableProps) {
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

  const getUsageBadgeVariant = (usage: string) => {
    switch (usage) {
      case "read":
        return "secondary";
      case "write":
        return "default";
      case "both":
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
              <TableHead className="w-[250px]">Tag Name</TableHead>
              <TableHead className="w-[150px]">Program</TableHead>
              <TableHead className="w-[150px]">Routine</TableHead>
              <TableHead className="w-[100px]">Rung</TableHead>
              <TableHead className="w-[100px]">Usage</TableHead>
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
                    <Badge variant={getUsageBadgeVariant(ref.usage_type)}>
                      {ref.usage_type}
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
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex} to {endIndex} of {totalCount} references
            </p>
            <ExportCSVButton
              filename={`tag_cross_reference_${new Date().toISOString().slice(0, 10)}.csv`}
              data={[
                ["Tag Name", "Program", "Routine", "Rung", "Usage Type"],
                ...allReferences.map((ref) => [
                  ref.tag_name,
                  ref.program_name,
                  ref.routine_name,
                  String(ref.rung_number),
                  ref.usage_type,
                ]),
              ]}
            />
          </div>
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
