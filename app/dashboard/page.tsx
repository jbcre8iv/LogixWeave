import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Tags, HardDrive, FileCode2, Plus, ArrowRight, Users } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Get user's projects count (only owned projects)
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user?.id);

  // Get recent projects (owned by user)
  const { data: recentProjects } = await supabase
    .from("projects")
    .select("id, name, updated_at")
    .eq("created_by", user?.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  // Get shared projects
  const { data: sharedProjects } = await supabase
    .from("project_shares")
    .select(`
      permission,
      projects:project_id(id, name, updated_at)
    `)
    .or(`shared_with_user_id.eq.${user?.id},shared_with_email.eq.${user?.email}`)
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
        {/* Blue - Projects */}
        <Card className="border-l-4 border-l-[#3B82F6] bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
              <FolderOpen className="h-4 w-4 text-[#3B82F6]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active projects in workspace
            </p>
          </CardContent>
        </Card>

        {/* Indigo - Tags */}
        <Card className="border-l-4 border-l-[#6366F1] bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tag Explorer</CardTitle>
            <div className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 p-2">
              <Tags className="h-4 w-4 text-[#6366F1]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Search and analyze PLC tags
            </p>
            <Button variant="outline" size="sm" asChild className="border-[#6366F1]/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
              <Link href="/dashboard/tools/tags">
                Open Tool <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Violet - I/O */}
        <Card className="border-l-4 border-l-[#8B5CF6] bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">I/O Mapping</CardTitle>
            <div className="rounded-full bg-violet-100 dark:bg-violet-900/30 p-2">
              <HardDrive className="h-4 w-4 text-[#8B5CF6]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              View hardware configuration
            </p>
            <Button variant="outline" size="sm" asChild className="border-[#8B5CF6]/30 hover:bg-violet-50 dark:hover:bg-violet-950/30">
              <Link href="/dashboard/tools/io">
                Open Tool <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Emerald - Compare */}
        <Card className="border-l-4 border-l-[#10B981] bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compare</CardTitle>
            <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-2">
              <FileCode2 className="h-4 w-4 text-[#10B981]" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-2">
              Compare two L5X projects
            </p>
            <Button variant="outline" size="sm" asChild className="border-[#10B981]/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
              <Link href="/dashboard/tools/compare">
                Open Tool <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Shared with Me</CardTitle>
            </div>
            <CardDescription>Projects others have shared with you</CardDescription>
          </CardHeader>
          <CardContent>
            {sharedProjects && sharedProjects.length > 0 ? (
              <div className="space-y-4">
                {sharedProjects.map((share) => {
                  const project = share.projects as unknown as { id: string; name: string; updated_at: string } | null;
                  if (!project) return null;
                  return (
                    <div key={project.id} className="flex items-center justify-between">
                      <div>
                        <Link
                          href={`/dashboard/projects/${project.id}`}
                          className="font-medium hover:underline"
                        >
                          {project.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {share.permission === "edit" ? "Can edit" : "View only"}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  No projects shared with you yet
                </p>
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
