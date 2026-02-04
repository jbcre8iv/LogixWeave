import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Sparkles, ArrowRight } from "lucide-react";

export default async function GlobalAIPage() {
  const supabase = await createClient();

  // Get all projects with their file counts
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      project_files(id, parsing_status)
    `)
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
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8" />
          AI Assistant
        </h1>
        <p className="text-muted-foreground">
          Use AI to analyze, explain, and search your PLC code
        </p>
      </div>

      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <CardContent className="py-6">
          <div className="flex items-start gap-4">
            <Sparkles className="h-6 w-6 text-purple-500 mt-1" />
            <div>
              <h3 className="font-semibold mb-1">AI-Powered Features</h3>
              <p className="text-sm text-muted-foreground">
                Get plain-English explanations of ladder logic, find potential issues,
                and search your code using natural language queries.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {projectsWithData.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectsWithData.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}/ai`}>
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
                        <Sparkles className="h-4 w-4" />
                        {project.completedFileCount} file{project.completedFileCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      Open <ArrowRight className="ml-2 h-4 w-4" />
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
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
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
