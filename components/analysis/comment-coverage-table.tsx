"use client";

import { Fragment, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoutineRow {
  programName: string;
  routineName: string;
  totalRungs: number;
  commentedRungs: number;
  coveragePercent: number;
}

interface ProgramRow {
  name: string;
  totalRungs: number;
  commentedRungs: number;
  coveragePercent: number;
}

interface RungDetail {
  number: number;
  comment: string | null;
}

interface CommentCoverageTableProps {
  byProgram: ProgramRow[];
  byRoutine: RoutineRow[];
  routineRungs: Record<string, RungDetail[]>;
}

function getCoverageBadge(percent: number) {
  if (percent >= 80)
    return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">{percent}%</Badge>;
  if (percent >= 50)
    return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">{percent}%</Badge>;
  return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">{percent}%</Badge>;
}

function getProgressColor(percent: number) {
  if (percent >= 80) return "[&_[data-slot=progress-indicator]]:bg-green-500";
  if (percent >= 50) return "[&_[data-slot=progress-indicator]]:bg-yellow-500";
  return "[&_[data-slot=progress-indicator]]:bg-red-500";
}

export function CommentCoverageTable({ byProgram, byRoutine, routineRungs }: CommentCoverageTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [programFilter, setProgramFilter] = useState<string | null>(null);

  const toggleRow = (key: string) => {
    const next = new Set(expandedRows);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRows(next);
  };

  const filteredRoutines = programFilter
    ? byRoutine.filter((r) => r.programName === programFilter)
    : byRoutine;

  const handleProgramClick = (programName: string) => {
    setProgramFilter((prev) => (prev === programName ? null : programName));
    document.getElementById("coverage-by-routine")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      {/* Coverage by Program */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage by Program</CardTitle>
          <CardDescription>
            Click a program row to filter routines below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead className="text-right">Total Rungs</TableHead>
                <TableHead className="text-right">Commented</TableHead>
                <TableHead className="text-right w-[200px]">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProgram.map((prog) => {
                const isSelected = programFilter === prog.name;
                return (
                  <TableRow
                    key={prog.name}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/5 border-l-4 border-l-primary"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleProgramClick(prog.name)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {isSelected && <Filter className="h-3.5 w-3.5 text-primary shrink-0" />}
                        {prog.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{prog.totalRungs}</TableCell>
                    <TableCell className="text-right">{prog.commentedRungs}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress
                          value={prog.coveragePercent}
                          className={cn("h-2 w-16", getProgressColor(prog.coveragePercent))}
                        />
                        {getCoverageBadge(prog.coveragePercent)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Coverage by Routine */}
      <Card
        id="coverage-by-routine"
        className={cn(
          "transition-all",
          programFilter && "ring-2 ring-primary/20"
        )}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Coverage by Routine</CardTitle>
              {programFilter ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="gap-1.5 bg-primary/10 text-primary border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
                    onClick={() => setProgramFilter(null)}
                  >
                    <Filter className="h-3 w-3" />
                    {programFilter}
                    <X className="h-3 w-3" />
                  </Badge>
                </div>
              ) : (
                <CardDescription>
                  Click a row to see rung-level detail
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Program</TableHead>
                  <TableHead>Routine</TableHead>
                  <TableHead className="text-right">Total Rungs</TableHead>
                  <TableHead className="text-right">Commented</TableHead>
                  <TableHead className="text-right w-[200px]">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoutines.map((routine) => {
                  const key = `${routine.programName}::${routine.routineName}`;
                  const isExpanded = expandedRows.has(key);
                  const rungs = routineRungs[key] || [];

                  return (
                    <Fragment key={key}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleRow(key)}
                      >
                        <TableCell className="w-[40px] px-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{routine.programName}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{routine.routineName}</TableCell>
                        <TableCell className="text-right">{routine.totalRungs}</TableCell>
                        <TableCell className="text-right">{routine.commentedRungs}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress
                              value={routine.coveragePercent}
                              className={cn("h-2 w-16", getProgressColor(routine.coveragePercent))}
                            />
                            {getCoverageBadge(routine.coveragePercent)}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${key}-expanded`}>
                          <TableCell colSpan={6} className="bg-muted/50 p-0">
                            <div className="p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[80px]">Rung #</TableHead>
                                    <TableHead className="w-[80px]">Status</TableHead>
                                    <TableHead>Comment</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rungs.map((rung) => {
                                    const hasComment = rung.comment && rung.comment.trim() !== "";
                                    return (
                                      <TableRow
                                        key={rung.number}
                                        className={cn(!hasComment && "bg-red-500/5")}
                                      >
                                        <TableCell className="font-mono text-sm">
                                          {rung.number}
                                        </TableCell>
                                        <TableCell>
                                          {hasComment ? (
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-500" />
                                          )}
                                        </TableCell>
                                        <TableCell className={cn("text-sm", !hasComment && "text-muted-foreground italic")}>
                                          {hasComment ? rung.comment : "No comment"}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
