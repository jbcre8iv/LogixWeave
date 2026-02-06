import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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

  // Fetch all platform statistics
  const [
    usersResult,
    projectsResult,
    filesResult,
    organizationsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, created_at, is_platform_admin"),
    supabase.from("projects").select("id, name, organization_id, created_at, organizations(name)"),
    supabase.from("project_files").select("id, file_name, file_size, parsing_status, project_id"),
    supabase.from("organizations").select("id, name, created_at"),
  ]);

  const users = usersResult.data || [];
  const projects = projectsResult.data || [];
  const files = filesResult.data || [];
  const organizations = organizationsResult.data || [];

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
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const userProjects = projects.filter(p => {
                  const org = organizations.find(o => o.id === p.organization_id);
                  return org !== undefined;
                });
                const userFiles = files.filter(f =>
                  userProjects.some(p => p.id === f.project_id)
                );

                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name || "—"}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{userProjects.length}</TableCell>
                    <TableCell>{userFiles.length}</TableCell>
                    <TableCell>
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {u.is_platform_admin ? (
                        <Badge className="bg-primary">Admin</Badge>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
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
                const orgName = (project.organizations as { name: string } | null)?.name || "Unknown";

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
