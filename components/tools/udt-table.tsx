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

interface UDTMember {
  id: string;
  name: string;
  data_type: string;
  dimension: string | null;
  description: string | null;
}

interface UDT {
  id: string;
  name: string;
  description: string | null;
  family_type: string | null;
  parsed_udt_members: UDTMember[];
}

interface UDTTableProps {
  udts: UDT[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function UDTRow({ udt }: { udt: UDT }) {
  const [isOpen, setIsOpen] = useState(false);
  const memberCount = udt.parsed_udt_members?.length || 0;

  return (
    <>
      <TableRow className="hover:bg-muted/50">
        <TableCell>
          <Button variant="ghost" size="sm" className="p-0 h-auto" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 mr-2" />
            ) : (
              <ChevronDown className="h-4 w-4 mr-2" />
            )}
            <span className="font-mono">{udt.name}</span>
          </Button>
        </TableCell>
        <TableCell>
          {udt.family_type ? (
            <Badge variant="outline">{udt.family_type}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm">{memberCount}</TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
          {udt.description || "-"}
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-0">
            {memberCount > 0 ? (
              <div className="p-4">
                <h4 className="text-sm font-medium mb-2">Members</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Name</TableHead>
                      <TableHead className="w-[150px]">Data Type</TableHead>
                      <TableHead className="w-[100px]">Dimension</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {udt.parsed_udt_members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-mono text-sm">{member.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{member.data_type}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.dimension || "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.description || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No members defined</div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function UDTTable({ udts, totalCount, page, pageSize }: UDTTableProps) {
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
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Name</TableHead>
              <TableHead className="w-[150px]">Family</TableHead>
              <TableHead className="w-[100px]">Members</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {udts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No UDTs found
                </TableCell>
              </TableRow>
            ) : (
              udts.map((udt) => <UDTRow key={udt.id} udt={udt} />)
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex} to {endIndex} of {totalCount} UDTs
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
