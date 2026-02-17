import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, FolderOpen, Plus, ArrowRight, Users, Mail } from "lucide-react";
import { PendingInvites } from "@/components/dashboard/pending-invites";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { getFirstName } from "@/lib/utils/display-name";

interface DashboardPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { page: pageParam } = await searchParams;
  const activityPage = Math.max(1, parseInt(pageParam || "1", 10));
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Get profile for personalized greeting
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, full_name")
    .eq("id", user?.id)
    .single();

  const firstName = getFirstName(profile || {});

  // Get user's projects count (only owned, non-archived projects)
  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user?.id)
    .eq("is_archived", false);

  // Get recent projects (owned by user, not archived)
  const { data: recentProjects } = await supabase
    .from("projects")
    .select("id, name, updated_at")
    .eq("created_by", user?.id)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(5);

  // Get shared projects (only accepted invites)
  const { data: sharedProjects, count: sharedCount } = await supabase
    .from("project_shares")
    .select(`
      permission,
      projects:project_id(id, name, updated_at)
    `, { count: "exact" })
    .or(`shared_with_user_id.eq.${user?.id},shared_with_email.eq.${user?.email}`)
    .not("accepted_at", "is", null)
    .limit(5);

  // Get pending invites count
  const { count: pendingInvitesCount } = await supabase
    .from("project_shares")
    .select("*", { count: "exact", head: true })
    .or(`shared_with_user_id.eq.${user?.id},shared_with_email.eq.${user?.email}`)
    .is("accepted_at", null);

  return (
    <div className="space-y-8">
      {/* Hero Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-indigo-500/5 to-transparent">
        <CardContent className="py-8 px-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            {/* Left: Icon + Greeting + Stats */}
            <div className="flex items-start gap-5">
              <div className="rounded-full bg-primary/10 p-3 ring-1 ring-primary/20">
                <LayoutDashboard className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {firstName ? `Welcome back, ${firstName}` : "Welcome to LogixWeave"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Your toolkit for exploring and documenting Studio 5000 projects
                </p>

                {/* Inline Stats */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
                  <Link
                    href="/dashboard/projects"
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span className="font-semibold text-foreground">{projectCount || 0}</span>
                    {(projectCount || 0) === 1 ? "project" : "projects"}
                  </Link>

                  <div className="h-4 w-px bg-border" />

                  <Link
                    href="/dashboard/projects#shared-with-me"
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    <span className="font-semibold text-foreground">{sharedCount || 0}</span>
                    shared
                  </Link>

                  {pendingInvitesCount ? (
                    <>
                      <div className="h-4 w-px bg-border" />
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Mail className="h-4 w-4" />
                        <span className="font-semibold">{pendingInvitesCount}</span>
                        pending {pendingInvitesCount === 1 ? "invite" : "invites"}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-3 sm:shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/projects">View All Projects</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/dashboard/projects/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  New Project
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites - shows if user has any */}
      <PendingInvites />

      {/* 2-Column Grid: Recent Projects + Shared with Me */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Projects</CardTitle>
              <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href="/dashboard/projects">
                  View all
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentProjects && recentProjects.length > 0 ? (
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className="group flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground shrink-0 ml-3 transition-colors" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
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

        {/* Shared with Me */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Shared with Me</CardTitle>
              </div>
              {sharedProjects && sharedProjects.length > 0 && (
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link href="/dashboard/projects#shared-with-me">
                    View all
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sharedProjects && sharedProjects.length > 0 ? (
              <div className="space-y-2">
                {sharedProjects.map((share) => {
                  const project = share.projects as unknown as { id: string; name: string; updated_at: string } | null;
                  if (!project) return null;
                  return (
                    <Link
                      key={project.id}
                      href={`/dashboard/projects/${project.id}`}
                      className="group flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{project.name}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {share.permission === "edit" ? "Can edit" : "View only"}
                        </Badge>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground shrink-0 ml-3 transition-colors" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  No projects shared with you yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity - shows if there's any activity */}
      <RecentActivity page={activityPage} />
    </div>
  );
}
