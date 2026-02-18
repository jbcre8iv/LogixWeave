import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { ToolProjectGrid } from "@/components/tools/tool-project-grid";

export default async function GlobalUDTsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      description,
      updated_at,
      project_files(id, file_name)
    `)
    .eq("is_archived", false)
    .order("name");

  const projectsWithStats = await Promise.all(
    (projects || []).map(async (project) => {
      const fileIds = project.project_files?.map((f: { id: string; file_name: string }) => f.id) || [];
      let udtCount = 0;

      if (fileIds.length > 0) {
        const { count } = await supabase
          .from("parsed_udts")
          .select("*", { count: "exact", head: true })
          .in("file_id", fileIds);
        udtCount = count || 0;
      }

      return { ...project, udtCount };
    })
  );

  const projectsWithUDTs = projectsWithStats.filter((p) => p.udtCount > 0);

  const healthScores = await getProjectHealthScores(
    projectsWithUDTs.map((p) => p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Defined Types</h1>
        <p className="text-muted-foreground">
          Browse and document UDTs across your projects
        </p>
      </div>

      {projectsWithUDTs.length > 0 ? (
        <ToolProjectGrid
          items={projectsWithUDTs.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            updatedAt: project.updated_at,
            href: `/dashboard/projects/${project.id}/udts?from=tools`,
            healthScore: healthScores.get(project.id)?.overall ?? null,
            hasPartialExports: healthScores.get(project.id)?.hasPartialExports,
            statIcon: <Layers className="h-4 w-4" />,
            statLabel: `${project.udtCount} UDTs`,
            statValue: project.udtCount,
            files: (project.project_files || []) as Array<{ id: string; file_name: string }>,
            actionLabel: "View",
          }))}
          searchPlaceholder="Search projects..."
          statSortLabel="UDT Count"
          statColumnHeader="UDTs"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No UDTs found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Upload L5X files containing User Defined Types to browse them here.
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
