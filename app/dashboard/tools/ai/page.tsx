import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { ToolProjectGrid } from "@/components/tools/tool-project-grid";

export default async function GlobalAIPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      description,
      updated_at,
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
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-amber-500" />
          AI Assistant
        </h1>
        <p className="text-muted-foreground">
          Use AI to analyze, explain, and search your PLC code
        </p>
      </div>

      <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/20">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <Sparkles className="h-6 w-6 text-amber-500 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">AI-Powered Features</h3>
              <p className="text-sm text-muted-foreground">
                Get clear, intuitive explanations of ladder logic, find potential issues,
                and search your code using natural language queries.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {projectsWithData.length > 0 ? (
        <ToolProjectGrid
          items={projectsWithData.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            updatedAt: project.updated_at,
            href: `/dashboard/projects/${project.id}/ai`,
            healthScore: healthScores.get(project.id)?.overall ?? null,
            hasPartialExports: healthScores.get(project.id)?.hasPartialExports,
            statIcon: <Sparkles className="h-4 w-4 text-amber-500" />,
            statLabel: `${project.completedFileCount} file${project.completedFileCount === 1 ? "" : "s"}`,
            statValue: project.completedFileCount,
            files: project.completedFiles,
            actionLabel: "Open",
            cardClassName: "hover:bg-amber-500/10 hover:border-amber-500/30",
            iconClassName: "text-amber-500",
            actionClassName: "text-amber-600 hover:text-amber-700 hover:bg-amber-500/10",
          }))}
          searchPlaceholder="Search projects..."
          statSortLabel="File Count"
          statColumnHeader="Files"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-amber-500/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects available</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Upload and parse L5X files to your projects to use AI features.
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
