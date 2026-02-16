import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FolderOpen } from "lucide-react";
import { ProjectList } from "@/components/dashboard/project-list";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      description,
      created_at,
      updated_at,
      is_favorite,
      is_archived,
      created_by,
      project_files(id, file_name)
    `)
    .order("updated_at", { ascending: false });

  const activeProjects = projects?.filter((p) => !p.is_archived) || [];
  const archivedProjects = projects?.filter((p) => p.is_archived) || [];

  // Fetch latest health score per project
  const activeProjectIds = activeProjects.map((p) => p.id);
  let healthScoreMap: Record<string, { overall: number; tagEfficiency: number; documentation: number; tagUsage: number }> = {};
  if (activeProjectIds.length > 0) {
    const serviceSupabase = await createServiceClient();
    const { data: healthRows } = await serviceSupabase
      .from("ai_analysis_history")
      .select("project_id, health_scores")
      .eq("analysis_type", "health")
      .in("project_id", activeProjectIds)
      .order("created_at", { ascending: false });

    if (healthRows) {
      for (const row of healthRows) {
        if (!healthScoreMap[row.project_id] && row.health_scores) {
          const hs = row.health_scores as { overall: number; tagEfficiency: number; documentation: number; tagUsage: number };
          healthScoreMap[row.project_id] = hs;
        }
      }
    }
  }

  // Fetch owner names for shared projects
  const sharedOwnerIds = projects
    ?.filter((p) => user && p.created_by && p.created_by !== user.id)
    .map((p) => p.created_by)
    .filter((id, i, arr) => arr.indexOf(id) === i) || [];

  let ownerMap: Record<string, string> = {};
  if (sharedOwnerIds.length > 0) {
    const { data: owners } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", sharedOwnerIds);

    if (owners) {
      ownerMap = Object.fromEntries(
        owners.map((o) => [
          o.id,
          [o.first_name, o.last_name].filter(Boolean).join(" ") || "Unknown",
        ])
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Manage your Studio 5000 projects
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {activeProjects.length > 0 || archivedProjects.length > 0 ? (
        <ProjectList projects={activeProjects} archivedProjects={archivedProjects} currentUserId={user?.id} ownerMap={ownerMap} healthScoreMap={healthScoreMap} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4 text-center">
              Create your first project to start organizing your L5X/L5K files
            </p>
            <Button asChild>
              <Link href="/dashboard/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
