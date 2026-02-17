import { createServiceClient } from "@/lib/supabase/server";

interface HealthScores {
  overall: number;
  tagEfficiency: number;
  documentation: number;
  tagUsage: number;
}

function computeScore(stats: {
  totalTags: number;
  unusedTags: number;
  commentCoverage: number;
  totalReferences: number;
}): HealthScores {
  const tagEfficiency =
    stats.totalTags > 0
      ? Math.max(0, 100 - (stats.unusedTags / stats.totalTags) * 200)
      : 100;
  const documentation = stats.commentCoverage;
  const tagUsage =
    stats.totalTags > 0
      ? Math.min(100, (stats.totalReferences / stats.totalTags) * 20)
      : 0;

  const overall = Math.round(
    tagEfficiency * 0.4 + documentation * 0.35 + tagUsage * 0.25
  );

  return {
    overall,
    tagEfficiency: Math.round(tagEfficiency),
    documentation: Math.round(documentation),
    tagUsage: Math.round(tagUsage),
  };
}

/**
 * Fetches the latest health score for each project. Uses AI analysis
 * history when available, otherwise computes a real-time score from
 * parsed data. Returns a Map keyed by project ID.
 */
export async function getProjectHealthScores(
  projectIds: string[]
): Promise<Map<string, HealthScores>> {
  if (projectIds.length === 0) return new Map();

  const supabase = createServiceClient();

  // 1. Try AI analysis history first
  const { data } = await supabase
    .from("ai_analysis_history")
    .select("project_id, health_scores")
    .in("project_id", projectIds)
    .eq("analysis_type", "health")
    .not("health_scores", "is", null)
    .order("created_at", { ascending: false });

  const scores = new Map<string, HealthScores>();
  for (const row of data || []) {
    if (!scores.has(row.project_id)) {
      scores.set(row.project_id, row.health_scores as HealthScores);
    }
  }

  // 2. Compute real-time scores for projects without AI analysis
  const missing = projectIds.filter((id) => !scores.has(id));
  if (missing.length > 0) {
    // Get file IDs for missing projects
    const { data: files } = await supabase
      .from("project_files")
      .select("id, project_id")
      .in("project_id", missing);

    const filesByProject = new Map<string, string[]>();
    for (const f of files || []) {
      const arr = filesByProject.get(f.project_id) || [];
      arr.push(f.id);
      filesByProject.set(f.project_id, arr);
    }

    const allFileIds = (files || []).map((f) => f.id);
    if (allFileIds.length > 0) {
      const [tagsResult, referencesResult, rungsResult] = await Promise.all([
        supabase
          .from("parsed_tags")
          .select("name, file_id")
          .in("file_id", allFileIds),
        supabase
          .from("tag_references")
          .select("tag_name, file_id")
          .in("file_id", allFileIds),
        supabase
          .from("parsed_rungs")
          .select("comment, file_id")
          .in("file_id", allFileIds),
      ]);

      // Group data by project
      for (const projectId of missing) {
        const projFileIds = new Set(filesByProject.get(projectId) || []);
        if (projFileIds.size === 0) continue;

        const tags = (tagsResult.data || []).filter((t) => projFileIds.has(t.file_id));
        const references = (referencesResult.data || []).filter((r) => projFileIds.has(r.file_id));
        const rungs = (rungsResult.data || []).filter((r) => projFileIds.has(r.file_id));

        const referencedTagNames = new Set(references.map((r) => r.tag_name));
        const unusedTags = tags.filter((tag) => {
          const tagParts = tag.name.split(".");
          for (let i = 1; i <= tagParts.length; i++) {
            const partialName = tagParts.slice(0, i).join(".");
            if (referencedTagNames.has(partialName)) return false;
          }
          const baseName = tag.name.split("[")[0];
          if (referencedTagNames.has(baseName)) return false;
          return !referencedTagNames.has(tag.name);
        });

        const commentedRungs = rungs.filter((r) => r.comment && r.comment.trim() !== "").length;
        const commentCoverage = rungs.length > 0
          ? Math.round((commentedRungs / rungs.length) * 100)
          : 0;

        scores.set(projectId, computeScore({
          totalTags: tags.length,
          unusedTags: unusedTags.length,
          commentCoverage,
          totalReferences: references.length,
        }));
      }
    }
  }

  return scores;
}
