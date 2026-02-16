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
  const serviceSupabase = await createServiceClient();
  let healthScoreMap: Record<string, { overall: number; tagEfficiency: number; documentation: number; tagUsage: number }> = {};
  if (activeProjectIds.length > 0) {
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

  // Compute health scores from parsed data for projects that have files but no stored score
  const projectsNeedingCompute = activeProjects.filter(
    (p) => !healthScoreMap[p.id] && Array.isArray(p.project_files) && p.project_files.length > 0
  );

  if (projectsNeedingCompute.length > 0) {
    const fileIdToProject: Record<string, string> = {};
    const allFileIds: string[] = [];
    for (const p of projectsNeedingCompute) {
      if (Array.isArray(p.project_files)) {
        for (const f of p.project_files) {
          fileIdToProject[f.id] = p.id;
          allFileIds.push(f.id);
        }
      }
    }

    const [tagsResult, refsResult, rungsResult] = await Promise.all([
      serviceSupabase.from("parsed_tags").select("file_id, name").in("file_id", allFileIds),
      serviceSupabase.from("tag_references").select("file_id, tag_name").in("file_id", allFileIds),
      serviceSupabase.from("parsed_rungs").select("file_id, comment").in("file_id", allFileIds),
    ]);

    // Group by project
    const projectTags: Record<string, string[]> = {};
    const projectRefNames: Record<string, Set<string>> = {};
    const projectRefCount: Record<string, number> = {};
    const projectRungs: Record<string, { total: number; commented: number }> = {};

    for (const tag of tagsResult.data || []) {
      const pid = fileIdToProject[tag.file_id];
      if (!projectTags[pid]) projectTags[pid] = [];
      projectTags[pid].push(tag.name);
    }

    for (const ref of refsResult.data || []) {
      const pid = fileIdToProject[ref.file_id];
      if (!projectRefNames[pid]) projectRefNames[pid] = new Set();
      projectRefNames[pid].add(ref.tag_name);
      projectRefCount[pid] = (projectRefCount[pid] || 0) + 1;
    }

    for (const rung of rungsResult.data || []) {
      const pid = fileIdToProject[rung.file_id];
      if (!projectRungs[pid]) projectRungs[pid] = { total: 0, commented: 0 };
      projectRungs[pid].total++;
      if (rung.comment && rung.comment.trim() !== "") projectRungs[pid].commented++;
    }

    // Compute score for each project (same formula as health-score.tsx)
    for (const p of projectsNeedingCompute) {
      const tags = projectTags[p.id] || [];
      const refNames = projectRefNames[p.id] || new Set<string>();
      const rungs = projectRungs[p.id] || { total: 0, commented: 0 };
      const totalRefs = projectRefCount[p.id] || 0;
      if (tags.length === 0) continue;

      let unusedCount = 0;
      for (const tagName of tags) {
        const tagParts = tagName.split(".");
        let found = false;
        for (let i = 1; i <= tagParts.length; i++) {
          if (refNames.has(tagParts.slice(0, i).join("."))) { found = true; break; }
        }
        if (!found) {
          const baseName = tagName.split("[")[0];
          if (!refNames.has(baseName) && !refNames.has(tagName)) unusedCount++;
        }
      }

      const commentCoverage = rungs.total > 0 ? Math.round((rungs.commented / rungs.total) * 100) : 0;
      const tagEfficiency = Math.max(0, 100 - (unusedCount / tags.length) * 200);
      const documentation = commentCoverage;
      const tagUsage = Math.min(100, (totalRefs / tags.length) * 20);
      const overall = Math.round(tagEfficiency * 0.4 + documentation * 0.35 + tagUsage * 0.25);

      healthScoreMap[p.id] = {
        overall,
        tagEfficiency: Math.round(tagEfficiency),
        documentation: Math.round(documentation),
        tagUsage: Math.round(tagUsage),
      };
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
