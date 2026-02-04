import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderOpen, Tags, HardDrive, FileCode2, Plus, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get user's projects count
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  // Get recent projects
  const { data: recentProjects } = await supabase
    .from("projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome to LogixWeave</h1>
        <p className="text-muted-foreground mt-2">
          Your toolkit for Studio 5000 project analysis and documentation
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active projects in workspace
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tag Explorer</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Search and analyze PLC tags
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/tools/tags">
                Open Tool <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I/O Mapping</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              View hardware configuration
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/tools/io">
                Open Tool <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compare</CardTitle>
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Compare two L5X projects
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/tools/compare">
                Open Tool <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Projects</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Link>
              </Button>
            </div>
            <CardDescription>Your recently updated projects</CardDescription>
          </CardHeader>
          <CardContent>
            {recentProjects && recentProjects.length > 0 ? (
              <div className="space-y-4">
                {recentProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/dashboard/projects/${project.id}`}
                        className="font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/projects/${project.id}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">No projects yet</p>
                <Button asChild>
                  <Link href="/dashboard/projects/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first project
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Quick guide to using LogixWeave</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-3 text-sm">
              <li>
                <span className="font-medium">Create a project</span>
                <p className="text-muted-foreground ml-5">
                  Organize your PLC files by project
                </p>
              </li>
              <li>
                <span className="font-medium">Upload L5X/L5K files</span>
                <p className="text-muted-foreground ml-5">
                  Export from Studio 5000 and upload here
                </p>
              </li>
              <li>
                <span className="font-medium">Explore and analyze</span>
                <p className="text-muted-foreground ml-5">
                  Use tools to search tags, view I/O, compare projects
                </p>
              </li>
              <li>
                <span className="font-medium">Export documentation</span>
                <p className="text-muted-foreground ml-5">
                  Generate reports in CSV, PDF, or Markdown
                </p>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
