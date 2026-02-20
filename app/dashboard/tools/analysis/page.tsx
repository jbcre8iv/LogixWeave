import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { ToolProjectGrid } from "@/components/tools/tool-project-grid";

export default async function GlobalAnalysisPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      description,
      updated_at,
      created_by,
      project_files(id, file_name, parsing_status)
    `)
    .eq("is_archived", false)
    .order("name");

  const projectsWithData = (projects || [])
    .map((project) => {
      const completedFiles = project.project_files?.filter(
        (f: { id: string; file_name: string; parsing_status: string }) => f.parsing_status === "completed"
      ) || [];
      return {
        ...project,
        completedFiles: completedFiles as Array<{ id: string; file_name: string; parsing_status: string }>,
        completedFileCount: completedFiles.length,
      };
    })
    .filter((p) => p.completedFileCount > 0);

  const healthScores = await getProjectHealthScores(
    projectsWithData.map((p) => p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Overview</h1>
        <p className="text-muted-foreground">
          Select a project to view its overview and quality metrics
        </p>
      </div>

      {projectsWithData.length > 0 ? (
        <ToolProjectGrid
          items={projectsWithData.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            updatedAt: project.updated_at,
            href: `/dashboard/projects/${project.id}/analysis?from=tools`,
            healthScore: healthScores.get(project.id)?.overall ?? null,
            hasPartialExports: healthScores.get(project.id)?.hasPartialExports,
            statIcon: <BarChart3 className="h-4 w-4" />,
            statLabel: `${project.completedFileCount} file${project.completedFileCount === 1 ? "" : "s"}`,
            statValue: project.completedFileCount,
            files: project.completedFiles,
            actionLabel: "Analyze",
            isOwned: !user || !project.created_by || project.created_by === user.id,
          }))}
          searchPlaceholder="Search projects..."
          statSortLabel="File Count"
          statColumnHeader="Files"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects to analyze</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Upload and parse L5X files to your projects to run analysis tools.
            </p>
            <Button asChild>
              <Link href="/dashboard/projects">
                Go to Projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
