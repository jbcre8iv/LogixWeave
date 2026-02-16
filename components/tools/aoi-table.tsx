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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { SortableTableHead } from "@/components/tools/sortable-table-head";

interface AOIParameter {
  id: string;
  name: string;
  data_type: string;
  usage: "Input" | "Output" | "InOut";
  required: boolean;
  visible: boolean;
  description: string | null;
}

interface AOILocalTag {
  id: string;
  name: string;
  data_type: string;
  description: string | null;
}

interface AOIRoutine {
  id: string;
  name: string;
  type: string;
  rung_count: number | null;
}

interface AOI {
  id: string;
  name: string;
  description: string | null;
  revision: string | null;
  vendor: string | null;
  created_by: string | null;
  edited_by: string | null;
  parsed_aoi_parameters: AOIParameter[];
  parsed_aoi_local_tags: AOILocalTag[];
  parsed_aoi_routines: AOIRoutine[];
}

interface AOITableProps {
  aois: AOI[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function AOIRow({ aoi }: { aoi: AOI }) {
  const [isOpen, setIsOpen] = useState(false);
  const paramCount = aoi.parsed_aoi_parameters?.length || 0;
  const localTagCount = aoi.parsed_aoi_local_tags?.length || 0;
  const routineCount = aoi.parsed_aoi_routines?.length || 0;

  const getUsageBadgeVariant = (usage: string) => {
    switch (usage) {
      case "Input":
        return "secondary";
      case "Output":
        return "default";
      case "InOut":
        return "outline";
      default:
        return "secondary";
    }
  };

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
            <span className="font-mono">{aoi.name}</span>
          </Button>
        </TableCell>
        <TableCell className="text-sm">{aoi.revision || "-"}</TableCell>
        <TableCell>
          {aoi.vendor ? (
            <Badge variant="outline">{aoi.vendor}</Badge>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm">{paramCount}</TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
          {aoi.description || "-"}
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <div className="p-4">
              <Tabs defaultValue="parameters" className="w-full">
                <TabsList>
                  <TabsTrigger value="parameters">
                    Parameters ({paramCount})
                  </TabsTrigger>
                  <TabsTrigger value="localTags">
                    Local Tags ({localTagCount})
                  </TabsTrigger>
                  <TabsTrigger value="routines">
                    Routines ({routineCount})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="parameters" className="mt-4">
                  {paramCount > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead className="w-[150px]">Data Type</TableHead>
                          <TableHead className="w-[100px]">Usage</TableHead>
                          <TableHead className="w-[80px]">Required</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aoi.parsed_aoi_parameters.map((param) => (
                          <TableRow key={param.id}>
                            <TableCell className="font-mono text-sm">{param.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{param.data_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getUsageBadgeVariant(param.usage)}>
                                {param.usage}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {param.required ? "Yes" : "No"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {param.description || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No parameters defined</p>
                  )}
                </TabsContent>
                <TabsContent value="localTags" className="mt-4">
                  {localTagCount > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead className="w-[150px]">Data Type</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aoi.parsed_aoi_local_tags.map((tag) => (
                          <TableRow key={tag.id}>
                            <TableCell className="font-mono text-sm">{tag.name}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{tag.data_type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {tag.description || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No local tags defined</p>
                  )}
                </TabsContent>
                <TabsContent value="routines" className="mt-4">
                  {routineCount > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Name</TableHead>
                          <TableHead className="w-[150px]">Type</TableHead>
                          <TableHead>Rung Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aoi.parsed_aoi_routines.map((routine) => (
                          <TableRow key={routine.id}>
                            <TableCell className="font-mono text-sm">{routine.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{routine.type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {routine.rung_count ?? "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">No routines defined</p>
                  )}
                </TabsContent>
              </Tabs>
              {(aoi.created_by || aoi.edited_by) && (
                <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
                  {aoi.created_by && <span>Created by: {aoi.created_by}</span>}
                  {aoi.created_by && aoi.edited_by && <span className="mx-2">|</span>}
                  {aoi.edited_by && <span>Edited by: {aoi.edited_by}</span>}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function AOITable({ aois, totalCount, page, pageSize }: AOITableProps) {
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
              <SortableTableHead column="name" className="w-[250px]">Name</SortableTableHead>
              <SortableTableHead column="revision" className="w-[100px]">Revision</SortableTableHead>
              <SortableTableHead column="vendor" className="w-[150px]">Vendor</SortableTableHead>
              <TableHead className="w-[100px]">Params</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aois.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No AOIs found
                </TableCell>
              </TableRow>
            ) : (
              aois.map((aoi) => <AOIRow key={aoi.id} aoi={aoi} />)
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex} to {endIndex} of {totalCount} AOIs
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
