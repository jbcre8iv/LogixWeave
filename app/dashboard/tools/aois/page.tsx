import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { ToolProjectGrid } from "@/components/tools/tool-project-grid";

export default async function GlobalAOIsPage() {
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

  // Get AOI counts for each project
  const projectsWithStats = await Promise.all(
    (projects || []).map(async (project) => {
      const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];
      let aoiCount = 0;

      if (fileIds.length > 0) {
        const { count } = await supabase
          .from("parsed_aois")
          .select("*", { count: "exact", head: true })
          .in("file_id", fileIds);
        aoiCount = count || 0;
      }

      return {
        ...project,
        fileCount: project.project_files?.length || 0,
        aoiCount,
      };
    })
  );

  const projectsWithAOIs = projectsWithStats.filter((p) => p.aoiCount > 0);

  const healthScores = await getProjectHealthScores(
    projectsWithAOIs.map((p) => p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add-On Instructions</h1>
        <p className="text-muted-foreground">
          Browse and document AOIs across your projects
        </p>
      </div>

      {projectsWithAOIs.length > 0 ? (
        <ToolProjectGrid
          items={projectsWithAOIs.map((project) => ({
            id: project.id,
            name: project.name,
            href: `/dashboard/projects/${project.id}/aois?from=tools`,
            healthScore: healthScores.get(project.id)?.overall ?? null,
            hasPartialExports: healthScores.get(project.id)?.hasPartialExports,
            statIcon: <Package className="h-4 w-4" />,
            statLabel: `${project.aoiCount} AOIs`,
            statValue: project.aoiCount,
            actionLabel: "View",
          }))}
          searchPlaceholder="Search projects..."
          statSortLabel="AOI Count"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No AOIs found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Upload L5X files containing Add-On Instructions to browse them here.
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
