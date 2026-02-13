import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, BarChart3, ArrowRight } from "lucide-react";

export default async function GlobalAnalysisPage() {
  const supabase = await createClient();

  // Get all projects with their file counts
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      project_files(id, parsing_status)
    `)
    .eq("is_archived", false)
    .order("name");

  // Filter to projects with completed parsing
  const projectsWithData = (projects || [])
    .map((project) => {
      const completedFiles = project.project_files?.filter(
        (f: { parsing_status: string }) => f.parsing_status === "completed"
      ) || [];
      return {
        ...project,
        completedFileCount: completedFiles.length,
      };
    })
    .filter((p) => p.completedFileCount > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analysis Tools</h1>
        <p className="text-muted-foreground">
          Run analysis and quality checks on your projects
        </p>
      </div>

      {projectsWithData.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectsWithData.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}/analysis?from=tools`}>
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
                        <BarChart3 className="h-4 w-4" />
                        {project.completedFileCount} file{project.completedFileCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Analyze <ArrowRight className="ml-2 h-4 w-4" />
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
