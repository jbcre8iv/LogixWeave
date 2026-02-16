import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Tags, ArrowRight } from "lucide-react";
import { getProjectHealthScores } from "@/lib/health-scores";
import { MiniHealthRing } from "@/components/dashboard/mini-health-ring";

export default async function GlobalTagExplorerPage() {
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

  // Get tag counts for each project
  const projectsWithStats = await Promise.all(
    (projects || []).map(async (project) => {
      const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];
      let tagCount = 0;

      if (fileIds.length > 0) {
        const { count } = await supabase
          .from("parsed_tags")
          .select("*", { count: "exact", head: true })
          .in("file_id", fileIds);
        tagCount = count || 0;
      }

      return {
        ...project,
        fileCount: project.project_files?.length || 0,
        tagCount,
      };
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectsWithTags.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}/tags?from=tools`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                    </div>
                    {healthScores.has(project.id) && (
                      <MiniHealthRing score={healthScores.get(project.id)!.overall} />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Tags className="h-4 w-4" />
                        {project.tagCount} tags
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Explore <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
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
