import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectAccess } from "@/lib/project-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, MessageSquare, AlertCircle, CheckCircle } from "lucide-react";
import { ExportCSVButton } from "@/components/export-csv-button";
import { CommentCoverageTable } from "@/components/analysis/comment-coverage-table";

interface CommentCoveragePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function CommentCoveragePage({ params }: CommentCoveragePageProps) {
  const { projectId } = await params;

  const access = await getProjectAccess();
  if (!access) notFound();
  const { supabase } = access;

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
    .select("program_name, routine_name, number, comment")
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

  // Build rung detail map for drill-down
  const routineRungs: Record<string, { number: number; comment: string | null }[]> = {};
  rungs.forEach((rung) => {
    const key = `${rung.program_name}::${rung.routine_name}`;
    if (!routineRungs[key]) {
      routineRungs[key] = [];
    }
    routineRungs[key].push({ number: rung.number, comment: rung.comment });
  });
  // Sort rungs within each routine by rung number
  Object.values(routineRungs).forEach((arr) => arr.sort((a, b) => a.number - b.number));

  const getCoverageColor = (percent: number) => {
    if (percent >= 80) return "text-green-500";
    if (percent >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <ExportCSVButton
          filename="comment_coverage.csv"
          data={[
            ["Level", "Program", "Routine", "Rung #", "Comment", "Total Rungs", "Commented Rungs", "Coverage %"],
            ["Overall", "", "", "", "", String(totalRungs), String(commentedRungs), `${coveragePercent}%`],
            ...byProgram.map((p) => [
              "Program",
              p.name,
              "",
              "",
              "",
              String(p.totalRungs),
              String(p.commentedRungs),
              `${p.coveragePercent}%`,
            ]),
            ...byRoutine.flatMap((r) => [
              [
                "Routine",
                r.programName,
                r.routineName,
                "",
                "",
                String(r.totalRungs),
                String(r.commentedRungs),
                `${r.coveragePercent}%`,
              ],
              ...(routineRungs[`${r.programName}::${r.routineName}`] || []).map((rung) => [
                "Rung",
                r.programName,
                r.routineName,
                String(rung.number),
                rung.comment || "",
                "",
                "",
                "",
              ]),
            ]),
          ]}
        />
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

      <CommentCoverageTable
        byProgram={byProgram}
        byRoutine={byRoutine}
        routineRungs={routineRungs}
      />
    </div>
  );
}
