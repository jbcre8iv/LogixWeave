import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HardDrive } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { ToolProjectGrid } from "@/components/tools/tool-project-grid";

export default async function GlobalIOPage() {
  const supabase = await createClient();

  // Get all projects with their file counts
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      project_files(id)
    `)
    .eq("is_archived", false)
    .order("name");

  // Get I/O module counts for each project
  const projectsWithStats = await Promise.all(
    (projects || []).map(async (project) => {
      const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];
      let moduleCount = 0;

      if (fileIds.length > 0) {
        const { count } = await supabase
          .from("parsed_io_modules")
          .select("*", { count: "exact", head: true })
          .in("file_id", fileIds);
        moduleCount = count || 0;
      }

      return {
        ...project,
        fileCount: project.project_files?.length || 0,
        moduleCount,
      };
    })
  );

  const projectsWithModules = projectsWithStats.filter((p) => p.moduleCount > 0);

  const healthScores = await getProjectHealthScores(
    projectsWithModules.map((p) => p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">I/O Mapping</h1>
        <p className="text-muted-foreground">
          View and analyze hardware I/O configuration across your projects
        </p>
      </div>

      {projectsWithModules.length > 0 ? (
        <ToolProjectGrid
          items={projectsWithModules.map((project) => ({
            id: project.id,
            name: project.name,
            href: `/dashboard/projects/${project.id}/io-mapping?from=tools`,
            healthScore: healthScores.get(project.id)?.overall ?? null,
            hasPartialExports: healthScores.get(project.id)?.hasPartialExports,
            statIcon: <HardDrive className="h-4 w-4" />,
            statLabel: `${project.moduleCount} modules`,
            statValue: project.moduleCount,
            actionLabel: "Explore",
          }))}
          searchPlaceholder="Search projects..."
          statSortLabel="Module Count"
          statColumnHeader="Modules"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HardDrive className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No I/O modules found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Upload L5X/L5K files to your projects to start exploring I/O modules.
              Files are automatically parsed after upload.
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
