import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FolderOpen,
  FileText,
  Shield,

  MessageSquare,
} from "lucide-react";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { AdminProjectsTable } from "@/components/admin/admin-projects-table";
import { AdminFeedbackTable } from "@/components/admin/admin-feedback-table";
import { SecurityDashboardSection } from "@/components/admin/security-dashboard-section";
import { RoleDistributionCard } from "@/components/admin/role-distribution-card";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Check if user is platform admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) {
    redirect("/dashboard");
  }

  // Use service client to bypass RLS for admin queries
  const serviceSupabase = await createServiceClient();

  // Fetch all platform statistics using service client
  const [
    usersResult,
    projectsResult,
    filesResult,
    feedbackResult,
  ] = await Promise.all([
    serviceSupabase.from("profiles").select("id, email, first_name, last_name, full_name, created_at, is_platform_admin, is_disabled"),
    serviceSupabase.from("projects").select("id, name, created_by, organization_id, created_at, deleted_at, organizations(name)"),
    serviceSupabase.from("project_files").select("id, file_name, file_size, parsing_status, project_id"),
    serviceSupabase.from("feedback").select("id, user_email, type, subject, description, created_at, read_at").order("created_at", { ascending: false }),
  ]);

  const users = usersResult.data || [];
  const projects = projectsResult.data || [];
  const files = filesResult.data || [];

  // Explicitly normalize feedback to ensure read_at is null or string across RSC boundary
  const feedbackItems = (feedbackResult.data || []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    user_email: f.user_email as string,
    type: f.type as string,
    subject: f.subject as string,
    description: f.description as string,
    created_at: f.created_at as string,
    read_at: typeof f.read_at === "string" ? f.read_at : null,
  }));
  const unreadFeedbackCount = feedbackItems.filter(f => f.read_at === null).length;

  // Build lookup maps for per-user stats
  // Map project_id -> file count
  const projectFileCount = new Map<string, number>();
  files.forEach(f => {
    projectFileCount.set(f.project_id, (projectFileCount.get(f.project_id) || 0) + 1);
  });

  // Map user_id -> project_ids they own (via created_by)
  const userProjectMap = new Map<string, string[]>();
  projects.forEach(p => {
    if (!userProjectMap.has(p.created_by)) {
      userProjectMap.set(p.created_by, []);
    }
    userProjectMap.get(p.created_by)!.push(p.id);
  });

  // Calculate stats
  const totalStorage = files.reduce((acc, f) => acc + (f.file_size || 0), 0);
  const parsedFiles = files.filter(f => f.parsing_status === "completed").length;

  // Prepare user data with computed counts based on project ownership
  const usersWithCounts = users.map(u => {
    const ownedProjects = userProjectMap.get(u.id) || [];
    const fileCount = ownedProjects.reduce((sum, pid) => sum + (projectFileCount.get(pid) || 0), 0);
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: u.full_name,
      created_at: u.created_at,
      is_platform_admin: u.is_platform_admin || false,
      is_disabled: u.is_disabled || false,
      projectCount: ownedProjects.length,
      fileCount,
    };
  });

  // Prepare project data with organization names and file counts
  const projectsWithDetails = projects.map(p => {
    const org = p.organizations as unknown as { name: string } | null;
    return {
      id: p.id,
      name: p.name,
      organization_name: org?.name || "Unknown",
      created_at: p.created_at,
      deleted_at: p.deleted_at as string | null,
      file_count: projectFileCount.get(p.id) || 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold">Platform Admin</h1>
          </div>
          <p className="text-muted-foreground">
            Manage and monitor all platform activity
          </p>
        </div>
        <Badge variant="outline" className="text-primary border-primary">
          Admin Access
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6 text-muted-foreground" />
              {users.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Projects</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
              {projects.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Files Uploaded</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <FileText className="h-6 w-6 text-muted-foreground" />
              {files.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {parsedFiles} parsed • {(totalStorage / 1024 / 1024).toFixed(1)} MB total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Feedback</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
              {feedbackItems.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {unreadFeedbackCount} unread
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Role Distribution */}
      <RoleDistributionCard />

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Users</CardTitle>
          <CardDescription>All registered users on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminUsersTable users={usersWithCounts} currentUserId={user.id} />
        </CardContent>
      </Card>

      {/* All Projects */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>All projects created across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminProjectsTable projects={projectsWithDetails} />
        </CardContent>
      </Card>

      {/* User Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>User Feedback</CardTitle>
          <CardDescription>
            Feedback submissions from users
            {unreadFeedbackCount > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadFeedbackCount} unread
              </Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminFeedbackTable feedback={feedbackItems} />
        </CardContent>
      </Card>

      {/* Security Dashboard (inline collapsible) */}
      <SecurityDashboardSection />
    </div>
  );
}
