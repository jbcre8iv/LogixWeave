import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  FolderOpen,
  FileText,
  Shield,
  ExternalLink,
  Building2,
} from "lucide-react";
import { UserActions } from "@/components/admin/user-actions";

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
    serviceSupabase.from("profiles").select("id, email, full_name, created_at, is_platform_admin, is_disabled"),
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

  // Get recent projects with owner info
  const recentProjects = projects
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                // Get organizations this user belongs to
                const userOrgs = userOrgMap.get(u.id) || new Set<string>();

                // Get projects from those organizations
                let userProjectCount = 0;
                let userFileCount = 0;
                userOrgs.forEach(orgId => {
                  const orgProjects = orgProjectMap.get(orgId) || new Set<string>();
                  userProjectCount += orgProjects.size;
                  orgProjects.forEach(projectId => {
                    userFileCount += projectFileCount.get(projectId) || 0;
                  });
                });

                return (
                  <TableRow key={u.id} className={u.is_disabled ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{userProjectCount}</TableCell>
                    <TableCell>{userFileCount}</TableCell>
                    <TableCell>
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {u.is_platform_admin ? (
                        <Badge className="bg-primary">Admin</Badge>
                      ) : u.is_disabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <UserActions
                        userId={u.id}
                        userEmail={u.email}
                        userName={u.full_name}
                        isDisabled={u.is_disabled || false}
                        isCurrentUser={u.id === user.id}
                        isPlatformAdmin={u.is_platform_admin || false}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
          <CardDescription>Latest projects created across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((project) => {
                const projectFiles = files.filter(f => f.project_id === project.id);
                const org = project.organizations as unknown as { name: string } | null;
                const orgName = org?.name || "Unknown";

                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{orgName}</TableCell>
                    <TableCell>{projectFiles.length}</TableCell>
                    <TableCell>
                      {new Date(project.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/projects/${project.id}`}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
