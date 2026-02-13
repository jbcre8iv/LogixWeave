import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Layers, ArrowRight } from "lucide-react";

export default async function GlobalUDTsPage() {
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

  // Get UDT counts for each project
  const projectsWithStats = await Promise.all(
    (projects || []).map(async (project) => {
      const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];
      let udtCount = 0;

      if (fileIds.length > 0) {
        const { count } = await supabase
          .from("parsed_udts")
          .select("*", { count: "exact", head: true })
          .in("file_id", fileIds);
        udtCount = count || 0;
      }

      return {
        ...project,
        fileCount: project.project_files?.length || 0,
        udtCount,
      };
    })
  );

  const projectsWithUDTs = projectsWithStats.filter((p) => p.udtCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Defined Types</h1>
        <p className="text-muted-foreground">
          Browse and document UDTs across your projects
        </p>
      </div>

      {projectsWithUDTs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectsWithUDTs.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}/udts?from=tools`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Layers className="h-4 w-4" />
                        {project.udtCount} UDTs
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      View <ArrowRight className="ml-2 h-4 w-4" />
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
