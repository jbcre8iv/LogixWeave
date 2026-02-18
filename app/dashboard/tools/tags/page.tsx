import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tags } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { ToolProjectGrid } from "@/components/tools/tool-project-grid";

export default async function GlobalTagExplorerPage() {
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
      let tagCount = 0;

      if (fileIds.length > 0) {
        const { count } = await supabase
          .from("parsed_tags")
          .select("*", { count: "exact", head: true })
          .in("file_id", fileIds);
        tagCount = count || 0;
      }

      return { ...project, tagCount };
    })
  );

  const projectsWithTags = projectsWithStats.filter((p) => p.tagCount > 0);

  const healthScores = await getProjectHealthScores(
    projectsWithTags.map((p) => p.id)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tag Explorer</h1>
        <p className="text-muted-foreground">
          Search and analyze tags across your projects
        </p>
      </div>

      {projectsWithTags.length > 0 ? (
        <ToolProjectGrid
          items={projectsWithTags.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            updatedAt: project.updated_at,
            href: `/dashboard/projects/${project.id}/tags?from=tools`,
            healthScore: healthScores.get(project.id)?.overall ?? null,
            hasPartialExports: healthScores.get(project.id)?.hasPartialExports,
            statIcon: <Tags className="h-4 w-4" />,
            statLabel: `${project.tagCount} tags`,
            statValue: project.tagCount,
            files: (project.project_files || []) as Array<{ id: string; file_name: string }>,
            actionLabel: "Explore",
          }))}
          searchPlaceholder="Search projects..."
          statSortLabel="Tag Count"
          statColumnHeader="Tags"
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tags className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tags found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Upload L5X/L5K files to your projects to start exploring tags.
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
