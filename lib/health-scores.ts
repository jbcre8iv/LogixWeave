import { createServiceClient } from "@/lib/supabase/server";

interface HealthScores {
  overall: number;
  tagEfficiency: number;
  documentation: number;
  tagUsage: number;
}

/**
 * Fetches the latest health score for each project. Returns a Map
 * keyed by project ID. Projects without a health analysis are omitted.
 */
export async function getProjectHealthScores(
  projectIds: string[]
): Promise<Map<string, HealthScores>> {
  if (projectIds.length === 0) return new Map();

  const supabase = createServiceClient();

  const { data } = await supabase
    .from("ai_analysis_history")
    .select("project_id, health_scores")
    .in("project_id", projectIds)
    .eq("analysis_type", "health")
    .not("health_scores", "is", null)
    .order("created_at", { ascending: false });

  const scores = new Map<string, HealthScores>();
  for (const row of data || []) {
    // First occurrence per project is the latest (ordered by created_at DESC)
    if (!scores.has(row.project_id)) {
      scores.set(row.project_id, row.health_scores as HealthScores);
    }
  }

  return scores;
}
