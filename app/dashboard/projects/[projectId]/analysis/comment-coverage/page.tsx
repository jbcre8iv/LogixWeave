import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle } from "lucide-react";

interface CommentCoveragePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function CommentCoveragePage({ params }: CommentCoveragePageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

  // Get project info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, project_files(id)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

  if (fileIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Comment Coverage</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No files have been uploaded to this project yet.
            </p>
            <Button asChild>
              <Link href={`/dashboard/projects/${projectId}/files`}>
                Upload Files
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all rungs
  const { data: rungs } = await supabase
    .from("parsed_rungs")
    .select("program_name, routine_name, comment")
    .in("file_id", fileIds);

  if (!rungs || rungs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Comment Coverage</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No ladder logic rungs found in the uploaded files.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate overall coverage
  const totalRungs = rungs.length;
  const commentedRungs = rungs.filter((r) => r.comment && r.comment.trim() !== "").length;
  const coveragePercent = totalRungs > 0 ? Math.round((commentedRungs / totalRungs) * 100) : 0;

  // Calculate coverage by program
  const programMap = new Map<string, { total: number; commented: number }>();
  rungs.forEach((rung) => {
    const program = rung.program_name;
    if (!programMap.has(program)) {
      programMap.set(program, { total: 0, commented: 0 });
    }
    const stats = programMap.get(program)!;
    stats.total++;
    if (rung.comment && rung.comment.trim() !== "") {
      stats.commented++;
    }
  });

  const byProgram = Array.from(programMap.entries())
    .map(([name, stats]) => ({
      name,
      totalRungs: stats.total,
      commentedRungs: stats.commented,
      coveragePercent: stats.total > 0 ? Math.round((stats.commented / stats.total) * 100) : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Calculate coverage by routine
  const routineMap = new Map<string, { program: string; total: number; commented: number }>();
  rungs.forEach((rung) => {
    const key = `${rung.program_name}::${rung.routine_name}`;
    if (!routineMap.has(key)) {
      routineMap.set(key, { program: rung.program_name, total: 0, commented: 0 });
    }
    const stats = routineMap.get(key)!;
    stats.total++;
    if (rung.comment && rung.comment.trim() !== "") {
      stats.commented++;
    }
  });

  const byRoutine = Array.from(routineMap.entries())
    .map(([key, stats]) => {
      const [programName, routineName] = key.split("::");
      return {
        programName,
        routineName,
        totalRungs: stats.total,
        commentedRungs: stats.commented,
        coveragePercent: stats.total > 0 ? Math.round((stats.commented / stats.total) * 100) : 0,
      };
    })
    .sort((a, b) => {
      const programCompare = a.programName.localeCompare(b.programName);
      if (programCompare !== 0) return programCompare;
      return a.routineName.localeCompare(b.routineName);
    });

  const getCoverageColor = (percent: number) => {
    if (percent >= 80) return "text-green-500";
    if (percent >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getCoverageBadge = (percent: number) => {
    if (percent >= 80) return <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">{percent}%</Badge>;
    if (percent >= 50) return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20">{percent}%</Badge>;
    return <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">{percent}%</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/projects/${projectId}/analysis`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Comment Coverage</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Overall Coverage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {commentedRungs} of {totalRungs} rungs have comments
                </p>
                <p className={`text-4xl font-bold ${getCoverageColor(coveragePercent)}`}>
                  {coveragePercent}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                {coveragePercent >= 80 ? (
                  <CheckCircle className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertCircle className={`h-8 w-8 ${getCoverageColor(coveragePercent)}`} />
                )}
              </div>
            </div>
            <Progress value={coveragePercent} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Coverage by Program */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage by Program</CardTitle>
          <CardDescription>
            Comment coverage breakdown for each program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program</TableHead>
                <TableHead className="text-right">Total Rungs</TableHead>
                <TableHead className="text-right">Commented</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProgram.map((prog) => (
                <TableRow key={prog.name}>
                  <TableCell className="font-medium">{prog.name}</TableCell>
                  <TableCell className="text-right">{prog.totalRungs}</TableCell>
                  <TableCell className="text-right">{prog.commentedRungs}</TableCell>
                  <TableCell className="text-right">
                    {getCoverageBadge(prog.coveragePercent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Coverage by Routine */}
      <Card>
        <CardHeader>
          <CardTitle>Coverage by Routine</CardTitle>
          <CardDescription>
            Detailed comment coverage for each routine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Routine</TableHead>
                  <TableHead className="text-right">Total Rungs</TableHead>
                  <TableHead className="text-right">Commented</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byRoutine.map((routine) => (
                  <TableRow key={`${routine.programName}::${routine.routineName}`}>
                    <TableCell>
                      <Badge variant="secondary">{routine.programName}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{routine.routineName}</TableCell>
                    <TableCell className="text-right">{routine.totalRungs}</TableCell>
                    <TableCell className="text-right">{routine.commentedRungs}</TableCell>
                    <TableCell className="text-right">
                      {getCoverageBadge(routine.coveragePercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
