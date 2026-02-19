import { createServiceClient } from "@/lib/supabase/server";
import { analyzeExportTypes } from "@/lib/partial-export";

interface HealthScores {
  overall: number;
  tagEfficiency: number;
  documentation: number;
  namingCompliance?: number;
  tagUsage: number;
  hasPartialExports?: boolean;
}

function computeScore(stats: {
  totalTags: number;
  unusedTags: number;
  commentCoverage: number;
  totalReferences: number;
  namingViolationTags?: number;
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

  // When namingViolationTags is provided, use 4-metric weights (30/30/20/20)
  // Otherwise fall back to original 3-metric weights (40/35/25)
  if (stats.namingViolationTags !== undefined) {
    const namingCompliance = stats.totalTags > 0
      ? Math.max(0, ((stats.totalTags - stats.namingViolationTags) / stats.totalTags) * 100)
      : 100;

    const overall = Math.round(
      tagEfficiency * 0.3 + documentation * 0.3 + namingCompliance * 0.2 + tagUsage * 0.2
    );

    return {
      overall,
      tagEfficiency: Math.round(tagEfficiency),
      documentation: Math.round(documentation),
      namingCompliance: Math.round(namingCompliance),
      tagUsage: Math.round(tagUsage),
    };
  }

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
    // Get file IDs and naming toggle for missing projects
    const [{ data: files }, { data: projectSettings }] = await Promise.all([
      supabase
        .from("project_files")
        .select("id, project_id")
        .in("project_id", missing),
      supabase
        .from("projects")
        .select("id, naming_rule_set_id, naming_affects_health_score, organization_id")
        .in("id", missing),
    ]);

    const filesByProject = new Map<string, string[]>();
    for (const f of files || []) {
      const arr = filesByProject.get(f.project_id) || [];
      arr.push(f.id);
      filesByProject.set(f.project_id, arr);
    }

    // Build a map of project settings
    const settingsMap = new Map<string, { namingEnabled: boolean; ruleSetId: string | null; orgId: string }>();
    for (const p of projectSettings || []) {
      settingsMap.set(p.id, {
        namingEnabled: p.naming_affects_health_score ?? true,
        ruleSetId: p.naming_rule_set_id,
        orgId: p.organization_id,
      });
    }

    // Resolve naming rules for projects with naming enabled
    const projectsWithNaming = missing.filter((id) => settingsMap.get(id)?.namingEnabled);
    const namingRulesByProject = new Map<string, Array<{ pattern: string; applies_to: string }>>();

    if (projectsWithNaming.length > 0) {
      // Collect rule set IDs and org IDs that need default lookups
      const ruleSetIds = new Set<string>();
      const orgsNeedingDefault = new Set<string>();

      for (const pid of projectsWithNaming) {
        const settings = settingsMap.get(pid);
        if (!settings) continue;
        if (settings.ruleSetId) {
          ruleSetIds.add(settings.ruleSetId);
        } else {
          orgsNeedingDefault.add(settings.orgId);
        }
      }

      // Fetch org default rule sets
      const orgDefaultSets = new Map<string, string>();
      if (orgsNeedingDefault.size > 0) {
        const { data: defaults } = await supabase
          .from("naming_rule_sets")
          .select("id, organization_id")
          .in("organization_id", [...orgsNeedingDefault])
          .eq("is_default", true);
        for (const d of defaults || []) {
          orgDefaultSets.set(d.organization_id, d.id);
          ruleSetIds.add(d.id);
        }
      }

      // Fetch all active rules for resolved set IDs
      if (ruleSetIds.size > 0) {
        const { data: rules } = await supabase
          .from("naming_rules")
          .select("rule_set_id, pattern, applies_to")
          .in("rule_set_id", [...ruleSetIds])
          .eq("is_active", true);

        const rulesBySet = new Map<string, Array<{ pattern: string; applies_to: string }>>();
        for (const r of rules || []) {
          const arr = rulesBySet.get(r.rule_set_id) || [];
          arr.push({ pattern: r.pattern, applies_to: r.applies_to });
          rulesBySet.set(r.rule_set_id, arr);
        }

        // Map rules to projects
        for (const pid of projectsWithNaming) {
          const settings = settingsMap.get(pid);
          if (!settings) continue;
          const setId = settings.ruleSetId || orgDefaultSets.get(settings.orgId);
          if (setId && rulesBySet.has(setId)) {
            namingRulesByProject.set(pid, rulesBySet.get(setId)!);
          }
        }
      }
    }

    const allFileIds = (files || []).map((f) => f.id);
    if (allFileIds.length > 0) {
      const [tagsResult, referencesResult, rungsResult] = await Promise.all([
        supabase
          .from("parsed_tags")
          .select("name, scope, file_id")
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

        // Compute naming violations if enabled
        const settings = settingsMap.get(projectId);
        const namingEnabled = settings?.namingEnabled ?? true;
        let namingViolationTags: number | undefined;

        if (namingEnabled) {
          const rules = namingRulesByProject.get(projectId);
          if (rules && rules.length > 0) {
            const violatingTags = new Set<string>();
            for (const tag of tags) {
              for (const rule of rules) {
                const appliesToTag =
                  rule.applies_to === "all" ||
                  (rule.applies_to === "controller" && tag.scope === "Controller") ||
                  (rule.applies_to === "program" && tag.scope !== "Controller");
                if (!appliesToTag) continue;
                try {
                  if (!new RegExp(rule.pattern).test(tag.name)) {
                    violatingTags.add(tag.name);
                    break;
                  }
                } catch { continue; }
              }
            }
            namingViolationTags = violatingTags.size;
          } else {
            namingViolationTags = 0;
          }
        }

        scores.set(projectId, computeScore({
          totalTags: tags.length,
          unusedTags: unusedTags.length,
          commentCoverage,
          totalReferences: references.length,
          namingViolationTags,
        }));
      }
    }
  }

  // 3. Query target_type for all projects to detect partial exports
  const { data: allFiles } = await supabase
    .from("project_files")
    .select("project_id, target_type, target_name")
    .in("project_id", projectIds);

  if (allFiles && allFiles.length > 0) {
    const filesByProjectAll = new Map<string, Array<{ target_type: string | null; target_name: string | null }>>();
    for (const f of allFiles) {
      const arr = filesByProjectAll.get(f.project_id) || [];
      arr.push({ target_type: f.target_type, target_name: f.target_name });
      filesByProjectAll.set(f.project_id, arr);
    }

    for (const projectId of projectIds) {
      const projFiles = filesByProjectAll.get(projectId);
      if (!projFiles) continue;
      const exportInfo = analyzeExportTypes(projFiles);
      const existing = scores.get(projectId);
      if (existing) {
        existing.hasPartialExports = exportInfo.hasPartialExports;
      }
    }
  }

  return scores;
}
