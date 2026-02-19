import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { ExportCSVButton } from "@/components/export-csv-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TasksPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function TasksPage({ params }: TasksPageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

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
            <h1 className="text-3xl font-bold">Task Configuration</h1>
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

  const [{ data: tasks }, { data: routines }] = await Promise.all([
    supabase
      .from("parsed_tasks")
      .select("name, type, rate, priority, watchdog, inhibit_task, disable_update_outputs, description, scheduled_programs")
      .in("file_id", fileIds)
      .order("priority"),
    supabase
      .from("parsed_routines")
      .select("program_name")
      .in("file_id", fileIds),
  ]);

  const allTasks = tasks || [];
  const allRoutines = routines || [];

  if (allTasks.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Task Configuration</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No tasks found in the uploaded files. This may be a partial export that does not include task configuration.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Summary counts by type
  const continuousCount = allTasks.filter((t) => t.type === "CONTINUOUS").length;
  const periodicCount = allTasks.filter((t) => t.type === "PERIODIC").length;
  const eventCount = allTasks.filter((t) => t.type === "EVENT").length;

  // Detect orphaned programs
  const scheduledProgramNames = new Set(allTasks.flatMap((t) => t.scheduled_programs || []));
  const allProgramNames = new Set(allRoutines.map((r) => r.program_name));
  const orphanedPrograms = [...allProgramNames].filter((p) => !scheduledProgramNames.has(p));

  const typeBadgeVariant = (type: string) => {
    switch (type) {
      case "CONTINUOUS": return "default" as const;
      case "PERIODIC": return "secondary" as const;
      case "EVENT": return "outline" as const;
      default: return "outline" as const;
    }
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
            <h1 className="text-3xl font-bold">Task Configuration</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <ExportCSVButton
          filename="task_configuration.csv"
          data={[
            ["Name", "Type", "Rate (ms)", "Priority", "Watchdog (ms)", "Inhibited", "Disable Update Outputs", "Scheduled Programs"],
            ...allTasks.map((t) => [
              t.name,
              t.type,
              t.rate != null ? String(t.rate) : "",
              String(t.priority),
              t.watchdog != null ? String(t.watchdog) : "",
              t.inhibit_task ? "Yes" : "No",
              t.disable_update_outputs ? "Yes" : "No",
              (t.scheduled_programs || []).join("; "),
            ]),
          ]}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{allTasks.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Continuous</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{continuousCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Periodic</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{periodicCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Event</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{eventCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Orphaned programs alert */}
      {orphanedPrograms.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-600 dark:text-yellow-400">
                  {orphanedPrograms.length} orphaned {orphanedPrograms.length === 1 ? "program" : "programs"} not scheduled in any task
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orphanedPrograms.join(", ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Rate (ms)</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead className="text-right">Watchdog (ms)</TableHead>
                <TableHead>Programs</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTasks.map((task) => (
                <TableRow key={task.name}>
                  <TableCell className="font-medium">{task.name}</TableCell>
                  <TableCell>
                    <Badge variant={typeBadgeVariant(task.type)}>{task.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {task.type === "PERIODIC" && task.rate != null ? task.rate : "\u2014"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{task.priority}</TableCell>
                  <TableCell className="text-right font-mono">
                    {task.watchdog != null ? task.watchdog : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(task.scheduled_programs || []).map((prog: string) => (
                        <Badge key={prog} variant="outline" className="text-xs">
                          {prog}
                        </Badge>
                      ))}
                      {(!task.scheduled_programs || task.scheduled_programs.length === 0) && (
                        <span className="text-muted-foreground text-sm italic">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {task.inhibit_task && (
                      <Badge variant="secondary" className="text-xs">Inhibited</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
