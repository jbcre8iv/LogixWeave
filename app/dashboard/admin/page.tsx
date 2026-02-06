import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FolderOpen,
  FileText,
  Shield,
  Building2,
} from "lucide-react";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { AdminProjectsTable } from "@/components/admin/admin-projects-table";

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
    organizationsResult,
    membershipsResult,
  ] = await Promise.all([
    serviceSupabase.from("profiles").select("id, email, first_name, last_name, full_name, created_at, is_platform_admin, is_disabled"),
    serviceSupabase.from("projects").select("id, name, organization_id, created_at, organizations(name)"),
    serviceSupabase.from("project_files").select("id, file_name, file_size, parsing_status, project_id"),
    serviceSupabase.from("organizations").select("id, name, created_at"),
    serviceSupabase.from("organization_members").select("user_id, organization_id"),
  ]);

  const users = usersResult.data || [];
  const projects = projectsResult.data || [];
  const files = filesResult.data || [];
  const organizations = organizationsResult.data || [];
  const memberships = membershipsResult.data || [];

  // Build lookup maps for per-user stats
  // Map user_id -> organization_ids they belong to
  const userOrgMap = new Map<string, Set<string>>();
  memberships.forEach(m => {
    if (!userOrgMap.has(m.user_id)) {
      userOrgMap.set(m.user_id, new Set());
    }
    userOrgMap.get(m.user_id)!.add(m.organization_id);
  });

  // Map organization_id -> project_ids
  const orgProjectMap = new Map<string, Set<string>>();
  projects.forEach(p => {
    if (!orgProjectMap.has(p.organization_id)) {
      orgProjectMap.set(p.organization_id, new Set());
    }
    orgProjectMap.get(p.organization_id)!.add(p.id);
  });

  // Map project_id -> file count
  const projectFileCount = new Map<string, number>();
  files.forEach(f => {
    projectFileCount.set(f.project_id, (projectFileCount.get(f.project_id) || 0) + 1);
  });

  // Calculate stats
  const totalStorage = files.reduce((acc, f) => acc + (f.file_size || 0), 0);
  const parsedFiles = files.filter(f => f.parsing_status === "completed").length;

  // Prepare user data with computed counts
  const usersWithCounts = users.map(u => {
    const userOrgs = userOrgMap.get(u.id) || new Set<string>();
    let projectCount = 0;
    let fileCount = 0;
    userOrgs.forEach(orgId => {
      const orgProjects = orgProjectMap.get(orgId) || new Set<string>();
      projectCount += orgProjects.size;
      orgProjects.forEach(projectId => {
        fileCount += projectFileCount.get(projectId) || 0;
      });
    });
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: u.full_name,
      created_at: u.created_at,
      is_platform_admin: u.is_platform_admin || false,
      is_disabled: u.is_disabled || false,
      projectCount,
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
      file_count: projectFileCount.get(p.id) || 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Platform Admin</h1>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <CardDescription>Organizations</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              {organizations.length}
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
      </div>

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
    </div>
  );
}
