import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  recommendHealthImprovements,
  generateHash,
  AILanguage,
} from "@/lib/ai/claude-client";
import { logActivity } from "@/lib/activity-log";
import { analyzeExportTypes } from "@/lib/partial-export";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's language preference
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_language")
      .eq("id", user.id)
      .single();

    const language = (profile?.ai_language || "en") as AILanguage;

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Get project and verify access
    const { data: project } = await supabase
      .from("projects")
      .select(
        "id, organization_id, naming_rule_set_id, naming_affects_health_score, project_files(id, parsing_status, current_version, version_count, target_type, target_name)"
      )
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const parsedFiles =
      project.project_files?.filter(
        (f: { parsing_status: string }) => f.parsing_status === "completed"
      ) || [];
    const fileIds = parsedFiles.map((f: { id: string }) => f.id);

    const partialExportInfo = analyzeExportTypes(
      (project.project_files || []).map(
        (f: { target_type: string | null; target_name: string | null }) => ({
          target_type: f.target_type,
          target_name: f.target_name,
        })
      )
    );

    if (fileIds.length === 0) {
      return NextResponse.json(
        { error: "No parsed files in project" },
        { status: 400 }
      );
    }

    // Fetch file versions first to resolve latest version IDs
    const { data: allFileVersions } = await supabase
      .from("file_versions")
      .select("id, file_id, version_number, created_at, comment")
      .in("file_id", fileIds)
      .order("version_number", { ascending: true });

    const allVersions = allFileVersions || [];

    // Get latest version IDs to avoid duplicate data from old versions
    const versionIds = allVersions
      .filter((v) => {
        const file = parsedFiles.find((f: { id: string }) => f.id === v.file_id);
        return file && v.version_number === (file as { current_version: number }).current_version;
      })
      .map((v) => v.id);

    // Parallel fetch: tags, references, rungs, routines (using version_id for current data only)
    const [tagsResult, referencesResult, rungsResult, routinesResult] =
      await Promise.all([
        supabase
          .from("parsed_tags")
          .select("name, data_type, scope, description, usage")
          .in("version_id", versionIds),
        supabase
          .from("tag_references")
          .select("tag_name, usage_type")
          .in("file_id", fileIds),
        supabase
          .from("parsed_rungs")
          .select("program_name, routine_name, comment")
          .in("version_id", versionIds),
        supabase
          .from("parsed_routines")
          .select("name, program_name, type, rung_count")
          .in("version_id", versionIds),
      ]);

    const allTags = tagsResult.data || [];
    const references = referencesResult.data || [];
    const rungs = rungsResult.data || [];
    const routines = routinesResult.data || [];

    if (allTags.length === 0 && routines.length === 0) {
      return NextResponse.json(
        { error: "No data found for analysis" },
        { status: 400 }
      );
    }

    // Fetch naming rules if naming compliance is enabled for this project
    const namingAffectsHealthScore = (project as { naming_affects_health_score?: boolean }).naming_affects_health_score ?? true;
    let namingViolationTags = 0;
    let namingRulesList: Array<{ name: string; pattern: string; applies_to: string }> = [];
    let topViolatedRules: Array<{ ruleName: string; violationCount: number }> = [];

    if (namingAffectsHealthScore) {
      // Resolve effective rule set
      let effectiveRuleSetId = (project as { naming_rule_set_id?: string | null }).naming_rule_set_id ?? null;
      if (!effectiveRuleSetId) {
        const { data: defaultSet } = await supabase
          .from("naming_rule_sets")
          .select("id")
          .eq("organization_id", project.organization_id)
          .eq("is_default", true)
          .single();
        effectiveRuleSetId = defaultSet?.id ?? null;
      }

      if (effectiveRuleSetId) {
        const { data: rules } = await supabase
          .from("naming_rules")
          .select("name, pattern, applies_to")
          .eq("rule_set_id", effectiveRuleSetId)
          .eq("is_active", true);
        namingRulesList = rules || [];
      }

      if (namingRulesList.length > 0) {
        const violatingTagNames = new Set<string>();
        const ruleViolationCounts = new Map<string, number>();

        for (const tag of allTags) {
          for (const rule of namingRulesList) {
            const appliesToTag =
              rule.applies_to === "all" ||
              (rule.applies_to === "controller" && tag.scope === "Controller") ||
              (rule.applies_to === "program" && tag.scope !== "Controller");
            if (!appliesToTag) continue;
            try {
              if (!new RegExp(rule.pattern).test(tag.name)) {
                violatingTagNames.add(tag.name);
                ruleViolationCounts.set(rule.name, (ruleViolationCounts.get(rule.name) || 0) + 1);
              }
            } catch { continue; }
          }
        }

        namingViolationTags = violatingTagNames.size;
        topViolatedRules = Array.from(ruleViolationCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([ruleName, violationCount]) => ({ ruleName, violationCount }));
      }
    }

    // Compute unused tags
    const referencedTagNames = new Set(references.map((r) => r.tag_name));
    const unusedTags = allTags.filter((tag) => {
      const tagParts = tag.name.split(".");
      for (let i = 1; i <= tagParts.length; i++) {
        const partialName = tagParts.slice(0, i).join(".");
        if (referencedTagNames.has(partialName)) return false;
      }
      const baseName = tag.name.split("[")[0];
      if (referencedTagNames.has(baseName)) return false;
      return !referencedTagNames.has(tag.name);
    });

    // Compute per-routine coverage map
    const routineCoverageMap = new Map<
      string,
      { total: number; commented: number }
    >();
    for (const rung of rungs) {
      const key = `${rung.program_name}/${rung.routine_name}`;
      if (!routineCoverageMap.has(key)) {
        routineCoverageMap.set(key, { total: 0, commented: 0 });
      }
      const entry = routineCoverageMap.get(key)!;
      entry.total++;
      if (rung.comment && rung.comment.trim() !== "") entry.commented++;
    }

    const routineCoverage = Array.from(routineCoverageMap.entries())
      .map(([routine, s]) => ({
        routine,
        coverage: s.total > 0 ? Math.round((s.commented / s.total) * 100) : 0,
        commented: s.commented,
        total: s.total,
      }))
      .sort((a, b) => a.coverage - b.coverage);

    // Compute usage breakdown
    const usageCounts = { read: 0, write: 0, both: 0 };
    for (const ref of references) {
      const type = ref.usage_type?.toLowerCase();
      if (type === "write") usageCounts.write++;
      else if (type === "both") usageCounts.both++;
      else usageCounts.read++;
    }

    // Top referenced tags
    const tagRefCounts = new Map<string, number>();
    for (const ref of references) {
      tagRefCounts.set(ref.tag_name, (tagRefCounts.get(ref.tag_name) || 0) + 1);
    }
    const topTags = Array.from(tagRefCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Compute health scores (mirrors health-score.tsx computeScore)
    const tagEfficiency =
      allTags.length > 0
        ? Math.max(0, 100 - (unusedTags.length / allTags.length) * 200)
        : 100;
    const commentedRungs = rungs.filter(
      (r) => r.comment && r.comment.trim() !== ""
    ).length;
    const documentation =
      rungs.length > 0
        ? Math.round((commentedRungs / rungs.length) * 100)
        : 0;
    const tagUsage =
      allTags.length > 0
        ? Math.min(100, (references.length / allTags.length) * 20)
        : 0;

    let namingCompliance: number | undefined;
    let overall: number;

    if (namingAffectsHealthScore) {
      namingCompliance = allTags.length > 0
        ? Math.max(0, ((allTags.length - namingViolationTags) / allTags.length) * 100)
        : 100;
      overall = Math.round(
        tagEfficiency * 0.3 + documentation * 0.3 + namingCompliance * 0.2 + tagUsage * 0.2
      );
    } else {
      overall = Math.round(
        tagEfficiency * 0.4 + documentation * 0.35 + tagUsage * 0.25
      );
    }

    const healthScores: {
      overall: number;
      tagEfficiency: number;
      documentation: number;
      namingCompliance?: number;
      tagUsage: number;
    } = {
      overall,
      tagEfficiency: Math.round(tagEfficiency),
      documentation: Math.round(documentation),
      ...(namingAffectsHealthScore ? { namingCompliance: Math.round(namingCompliance!) } : {}),
      tagUsage: Math.round(tagUsage),
    };

    // Build version history context for AI
    let versionHistory:
      | {
          totalVersions: number;
          latestVersion: number;
          versionSummaries: Array<{
            versionNumber: number;
            uploadedAt: string;
            comment?: string;
            stats?: {
              totalTags: number;
              unusedTags: number;
              totalRungs: number;
              commentedRungs: number;
              totalReferences: number;
            };
          }>;
        }
      | undefined;

    const maxVersionCount = Math.max(
      ...parsedFiles.map(
        (f: { version_count?: number }) => f.version_count || 1
      )
    );

    if (maxVersionCount > 1 && allVersions.length > 0) {
      const serviceSupabase = await createServiceClient();

      // Get stats per version (limit to last 5 versions for context window)
      const recentVersions = allVersions.slice(-5);
      const versionSummaries = [];

      for (const version of recentVersions) {
        // Query parsed data for this version
        const [vTags, vRefs, vRungs] = await Promise.all([
          serviceSupabase
            .from("parsed_tags")
            .select("name", { count: "exact" })
            .eq("version_id", version.id),
          serviceSupabase
            .from("tag_references")
            .select("tag_name", { count: "exact" })
            .eq("file_id", version.file_id)
            .not("version_id", "is", null)
            .eq("version_id", version.id),
          serviceSupabase
            .from("parsed_rungs")
            .select("comment", { count: "exact" })
            .eq("version_id", version.id),
        ]);

        // Only include stats if this version has parsed data
        const totalTagsV = vTags.count || 0;
        const totalRungs = vRungs.count || 0;

        // Count unused tags for this version
        const vRefNames = new Set(
          (vRefs.data || []).map((r: { tag_name: string }) => r.tag_name)
        );
        const vTagNames = (vTags.data || []).map(
          (t: { name: string }) => t.name
        );
        const unusedTagsV = vTagNames.filter(
          (name: string) => !vRefNames.has(name)
        ).length;

        // Count commented rungs for this version
        const commentedRungsV = (vRungs.data || []).filter(
          (r: { comment: string | null }) => r.comment && r.comment.trim() !== ""
        ).length;

        versionSummaries.push({
          versionNumber: version.version_number,
          uploadedAt: new Date(version.created_at).toLocaleDateString(),
          comment: version.comment || undefined,
          ...(totalTagsV > 0 || totalRungs > 0
            ? {
                stats: {
                  totalTags: totalTagsV,
                  unusedTags: unusedTagsV,
                  totalRungs,
                  commentedRungs: commentedRungsV,
                  totalReferences: vRefs.count || 0,
                },
              }
            : {}),
        });
      }

      const latestVersion = Math.max(
        ...parsedFiles.map(
          (f: { current_version?: number }) => f.current_version || 1
        )
      );

      versionHistory = {
        totalVersions: allVersions.length,
        latestVersion,
        versionSummaries,
      };
    }

    const serviceSupabase = await createServiceClient();

    // Fetch previous health analyses for trend awareness
    const { data: previousRuns } = await serviceSupabase
      .from("ai_analysis_history")
      .select("result, health_scores, created_at")
      .eq("project_id", projectId)
      .eq("analysis_type", "health")
      .order("created_at", { ascending: false })
      .limit(3);

    const previousAnalyses = previousRuns && previousRuns.length > 0
      ? previousRuns.map((run) => ({
          healthScores: run.health_scores as { overall: number; tagEfficiency: number; documentation: number; tagUsage: number },
          summary: (run.result as { summary?: string })?.summary || "",
          quickWins: ((run.result as { quickWins?: string[] })?.quickWins || []),
          analyzedAt: new Date(run.created_at).toLocaleDateString(),
        }))
      : null;

    // Generate input hash (includes history count so cache invalidates when new history exists)
    const inputHash = generateHash(
      JSON.stringify(unusedTags.map((t) => t.name).slice(0, 50)) +
        JSON.stringify(
          routineCoverage.map((r) => `${r.routine}:${r.coverage}`)
        ) +
        JSON.stringify(usageCounts) +
        JSON.stringify(versionHistory?.versionSummaries?.length || 0) +
        JSON.stringify(previousRuns?.length || 0) +
        JSON.stringify(partialExportInfo.hasPartialExports) +
        JSON.stringify(namingViolationTags) +
        JSON.stringify(namingAffectsHealthScore) +
        language
    );

    // Cache check
    const fileId = fileIds[0];
    const target = "project-health";

    const { data: cached } = await serviceSupabase
      .from("ai_analysis_cache")
      .select("result, tokens_used")
      .eq("file_id", fileId)
      .eq("analysis_type", "health")
      .eq("target", target)
      .eq("input_hash", inputHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      // Fire-and-forget: log usage + save to history
      serviceSupabase.from("ai_usage_log").insert({
        user_id: user.id,
        organization_id: project.organization_id,
        analysis_type: "health",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: cached.tokens_used || 0,
        cached: true,
      }).then(() => {});

      serviceSupabase.from("ai_analysis_history").insert({
        project_id: projectId,
        file_id: fileId,
        user_id: user.id,
        analysis_type: "health",
        target: "project-health",
        result: cached.result,
        health_scores: healthScores,
        tokens_used: cached.tokens_used || 0,
      }).then(() => {});

      return NextResponse.json({
        result: cached.result,
        cached: true,
      });
    }

    // Call Claude API
    const result = await recommendHealthImprovements(
      healthScores,
      unusedTags.map((t) => ({
        name: t.name,
        dataType: t.data_type,
        scope: t.scope,
      })),
      routineCoverage,
      usageCounts,
      topTags,
      routines.map((r) => ({
        name: r.name,
        programName: r.program_name,
        type: r.type,
        rungCount: r.rung_count || undefined,
      })),
      versionHistory,
      language,
      previousAnalyses,
      partialExportInfo.hasPartialExports ? partialExportInfo : undefined,
      namingAffectsHealthScore
        ? { violationCount: namingViolationTags, totalTags: allTags.length, topViolatedRules }
        : undefined
    );

    // Cache result (7-day TTL)
    await serviceSupabase.from("ai_analysis_cache").insert({
      file_id: fileId,
      analysis_type: "health",
      target,
      input_hash: inputHash,
      result: result as unknown as Record<string, unknown>,
      tokens_used: 2000,
    });

    // Log usage
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: project.organization_id,
      analysis_type: "health",
      input_tokens: 1000,
      output_tokens: 1000,
      total_tokens: 2000,
      cached: false,
    });

    // Save to history (fire-and-forget)
    serviceSupabase.from("ai_analysis_history").insert({
      project_id: projectId,
      file_id: fileId,
      user_id: user.id,
      analysis_type: "health",
      target: "project-health",
      result: result as unknown as Record<string, unknown>,
      health_scores: healthScores,
      tokens_used: 2000,
    }).then(() => {});

    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "ai_analysis_run",
      targetType: "analysis",
      targetName: "health",
    });

    return NextResponse.json({
      result,
      cached: false,
    });
  } catch (error) {
    console.error("AI health error:", error);

    if (error instanceof Error && error.message.includes("API_KEY")) {
      return NextResponse.json(
        {
          error:
            "AI features are not configured. Please contact support.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
