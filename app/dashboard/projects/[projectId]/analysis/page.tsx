import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, FileCheck } from "lucide-react";
import { ExportXLSXButton, type ExportSheet } from "@/components/export-xlsx-button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AnalysisCharts } from "@/components/analysis/analysis-charts";
import { HealthScore } from "@/components/analysis/health-score";
import { AnimatedCount } from "@/components/analysis/animated-count";
import { analyzeExportTypes } from "@/lib/partial-export";
import { ActivityLog } from "@/components/projects/activity-log";

function formatTimeAgo(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface AnalysisPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { projectId } = await params;

  const supabase = await createClient();

  // Get project info
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, description, created_by, created_at, updated_at, organization_id, project_files(id, target_type, target_name)")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // Fetch current user and project owner profile in parallel
  const [{ data: { user } }, { data: ownerProfile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", project.created_by)
      .single(),
  ]);

  const isOwner = user?.id === project.created_by;
  const ownerName = isOwner
    ? "You"
    : ownerProfile?.first_name
      ? `${ownerProfile.first_name} ${ownerProfile.last_name || ""}`.trim()
      : "Unknown";
  const ownerInitials = ownerProfile?.first_name
    ? `${ownerProfile.first_name[0]}${ownerProfile.last_name?.[0] || ""}`.toUpperCase()
    : "?";

  // Fetch naming_rule_set_id separately (column may not exist pre-migration)
  const { data: projectRuleSetRow } = await supabase
    .from("projects")
    .select("naming_rule_set_id")
    .eq("id", projectId)
    .single();
  const projectRuleSetId: string | null = projectRuleSetRow?.naming_rule_set_id ?? null;

  const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

  const partialExportInfo = analyzeExportTypes(
    (project.project_files || []).map((f: { target_type: string | null; target_name: string | null }) => ({
      target_type: f.target_type,
      target_name: f.target_name,
    }))
  );

  // Fetch full analysis data (used for both summary stats and CSV export)
  let stats = {
    totalTags: 0,
    unusedTags: 0,
    totalRungs: 0,
    commentedRungs: 0,
    commentCoverage: 0,
    totalReferences: 0,
  };

  let exportSheets: ExportSheet[] = [];
  let usageBreakdown = [
    { name: "Read", value: 0 },
    { name: "Write", value: 0 },
    { name: "Read/Write", value: 0 },
  ];
  let routineCoverageChart: Array<{ routine: string; coverage: number; commented: number; total: number }> = [];
  let topTags: Array<{ name: string; count: number }> = [];

  if (fileIds.length > 0) {
    // Resolve effective rule set for naming rules
    let effectiveRuleSetId = projectRuleSetId;
    if (!effectiveRuleSetId) {
      const { data: defaultSet } = await supabase
        .from("naming_rule_sets")
        .select("id")
        .eq("organization_id", project.organization_id)
        .eq("is_default", true)
        .single();
      effectiveRuleSetId = defaultSet?.id ?? null;
    }

    // Build naming rules query — use rule_set_id if available, fall back to organization_id
    const namingRulesQuery = effectiveRuleSetId
      ? supabase
          .from("naming_rules")
          .select("id, name, pattern, applies_to, severity")
          .eq("rule_set_id", effectiveRuleSetId)
          .eq("is_active", true)
      : supabase
          .from("naming_rules")
          .select("id, name, pattern, applies_to, severity")
          .eq("organization_id", project.organization_id)
          .eq("is_active", true);

    const [tagsResult, referencesResult, rungsResult, rulesResult] = await Promise.all([
      supabase
        .from("parsed_tags")
        .select("id, name, data_type, scope, description, usage")
        .in("file_id", fileIds),
      supabase
        .from("tag_references")
        .select("id, tag_name, routine_name, program_name, rung_number, usage_type")
        .in("file_id", fileIds)
        .order("tag_name")
        .order("program_name")
        .order("routine_name"),
      supabase
        .from("parsed_rungs")
        .select("id, comment, program_name, routine_name")
        .in("file_id", fileIds),
      namingRulesQuery,
    ]);

    const allTags = tagsResult.data || [];
    const references = referencesResult.data || [];
    const rungs = rungsResult.data || [];
    const namingRules = rulesResult.data || [];

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

    const commentedRungs = rungs.filter((r) => r.comment && r.comment.trim() !== "").length;

    stats = {
      totalTags: allTags.length,
      unusedTags: unusedTags.length,
      totalRungs: rungs.length,
      commentedRungs,
      commentCoverage: rungs.length > 0 ? Math.round((commentedRungs / rungs.length) * 100) : 0,
      totalReferences: references.length,
    };

    // --- Build multi-sheet XLSX export ---

    // Sheet 1: Summary
    exportSheets.push({
      name: "Summary",
      data: [
        ["Metric", "Value"],
        ["Total Tags", String(stats.totalTags)],
        ["Total Rungs", String(stats.totalRungs)],
        ["Tag References", String(stats.totalReferences)],
        ["Unused Tags", String(stats.unusedTags)],
        ["Comment Coverage", `${stats.commentCoverage}%`],
      ],
    });

    // Sheet 2: Tag Cross-Reference
    exportSheets.push({
      name: "Tag Cross-Reference",
      data: [
        ["Tag Name", "Program", "Routine", "Rung", "Usage Type"],
        ...references.map((ref) => [
          ref.tag_name,
          ref.program_name,
          ref.routine_name,
          String(ref.rung_number),
          ref.usage_type,
        ]),
      ],
    });

    // Sheet 3: Unused Tags
    exportSheets.push({
      name: "Unused Tags",
      data: [
        ["Name", "Data Type", "Scope", "Usage", "Description"],
        ...unusedTags
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((tag) => [
            tag.name,
            tag.data_type,
            tag.scope,
            tag.usage || "",
            tag.description || "",
          ]),
      ],
    });

    // Sheet 4: Comment Coverage
    const routineCoverage = new Map<string, { program: string; total: number; commented: number }>();
    rungs.forEach((rung) => {
      const key = `${rung.program_name}::${rung.routine_name}`;
      if (!routineCoverage.has(key)) {
        routineCoverage.set(key, { program: rung.program_name, total: 0, commented: 0 });
      }
      const s = routineCoverage.get(key)!;
      s.total++;
      if (rung.comment && rung.comment.trim() !== "") s.commented++;
    });

    const coverageRows = Array.from(routineCoverage.entries())
      .map(([key, s]) => {
        const [programName, routineName] = key.split("::");
        const pct = s.total > 0 ? Math.round((s.commented / s.total) * 100) : 0;
        return [programName, routineName, String(s.total), String(s.commented), `${pct}%`];
      })
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

    exportSheets.push({
      name: "Comment Coverage",
      data: [
        ["Program", "Routine", "Total Rungs", "Commented Rungs", "Coverage"],
        ...coverageRows,
      ],
    });

    // Sheet 5: Naming Violations (only if rules exist)
    if (namingRules.length > 0) {
      const violations: string[][] = [];
      for (const tag of allTags) {
        for (const rule of namingRules) {
          const appliesToTag =
            rule.applies_to === "all" ||
            (rule.applies_to === "controller" && tag.scope === "Controller") ||
            (rule.applies_to === "program" && tag.scope !== "Controller");
          if (!appliesToTag) continue;
          try {
            const regex = new RegExp(rule.pattern);
            if (!regex.test(tag.name)) {
              violations.push([rule.severity, tag.name, tag.scope, rule.name]);
            }
          } catch {
            continue;
          }
        }
      }

      exportSheets.push({
        name: "Naming Violations",
        data: [
          ["Severity", "Tag Name", "Scope", "Rule"],
          ...violations,
        ],
      });
    }

    // --- Compute chart data from already-fetched references and routineCoverage ---

    // Tag usage breakdown (Read / Write / Read/Write)
    const usageCounts: Record<string, number> = { Read: 0, Write: 0, "Read/Write": 0 };
    for (const ref of references) {
      const type = ref.usage_type?.toLowerCase();
      if (type === "write") {
        usageCounts["Write"]++;
      } else if (type === "both") {
        usageCounts["Read/Write"]++;
      } else {
        usageCounts["Read"]++;
      }
    }
    usageBreakdown = [
      { name: "Read", value: usageCounts["Read"] },
      { name: "Write", value: usageCounts["Write"] },
      { name: "Read/Write", value: usageCounts["Read/Write"] },
    ];

    // Comment coverage by routine (reuse routineCoverage map already computed above)
    routineCoverageChart = Array.from(routineCoverage.entries())
      .map(([key, s]) => {
        const routineName = key.split("::")[1] || key;
        const pct = s.total > 0 ? Math.round((s.commented / s.total) * 100) : 0;
        return { routine: routineName, coverage: pct, commented: s.commented, total: s.total };
      })
      .sort((a, b) => a.routine.localeCompare(b.routine));

    // Top referenced tags (top 10 by frequency)
    const tagRefCounts = new Map<string, number>();
    for (const ref of references) {
      tagRefCounts.set(ref.tag_name, (tagRefCounts.get(ref.tag_name) || 0) + 1);
    }
    topTags = Array.from(tagRefCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Overview</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{project.name}</span>
            <span className="text-muted-foreground/40">—</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <Avatar className="size-5">
                <AvatarImage src={ownerProfile?.avatar_url || undefined} alt={ownerName} />
                <AvatarFallback className="text-[9px]">{ownerInitials}</AvatarFallback>
              </Avatar>
              <span>
                {ownerName}
                {" · "}
                Created {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                Modified {formatTimeAgo(project.updated_at)}
                {" · "}
                {project.project_files.length} {project.project_files.length === 1 ? "file" : "files"}
              </span>
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground/80 mt-1">{project.description}</p>
          )}
        </div>
        {fileIds.length > 0 && (
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center gap-1">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/projects/${projectId}/analysis/naming`}>
                  <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                  Naming Validation
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">Impacts health score</p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ExportXLSXButton
                filename={`full_analysis_${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`}
                sheets={exportSheets}
              />
              <p className="text-xs text-muted-foreground">Export overview</p>
            </div>
          </div>
        )}
      </div>

      {fileIds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No files have been uploaded to this project yet.
            </p>
            <Button asChild>
              <Link href={`/dashboard/projects/${projectId}/files`}>
                Upload Files
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Health Score */}
          <HealthScore projectId={projectId} stats={stats} partialExportInfo={partialExportInfo} />

          {/* Summary Stats */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <Link href={`/dashboard/projects/${projectId}/tags?tab=definitions`}>
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Total Tags</CardDescription>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <CardTitle className="text-3xl"><AnimatedCount value={stats.totalTags} /></CardTitle>
                </CardHeader>
              </Card>
            </Link>
            <Link href={`/dashboard/projects/${projectId}/analysis/comment-coverage`}>
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Total Rungs</CardDescription>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <CardTitle className="text-3xl"><AnimatedCount value={stats.totalRungs} /></CardTitle>
                </CardHeader>
              </Card>
            </Link>
            <Link href={`/dashboard/projects/${projectId}/analysis/tag-xref`}>
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Tag Cross-References</CardDescription>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <CardTitle className="text-3xl"><AnimatedCount value={stats.totalReferences} /></CardTitle>
                </CardHeader>
              </Card>
            </Link>
            <Link href={`/dashboard/projects/${projectId}/analysis/unused-tags`}>
              <Card className={`h-full hover:bg-accent/50 transition-colors cursor-pointer group ${stats.unusedTags > 0 ? "border-yellow-500/50" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Unused Tags</CardDescription>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <CardTitle className={`text-3xl ${stats.unusedTags > 0 ? "text-yellow-500" : ""}`}><AnimatedCount value={stats.unusedTags} /></CardTitle>
                </CardHeader>
              </Card>
            </Link>
            <Link href={`/dashboard/projects/${projectId}/analysis/comment-coverage`}>
              <Card className={`h-full hover:bg-accent/50 transition-colors cursor-pointer group ${stats.commentCoverage < 50 ? "border-yellow-500/50" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>Comment Coverage</CardDescription>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <CardTitle className={`text-3xl ${stats.commentCoverage < 50 ? "text-yellow-500" : ""}`}><AnimatedCount value={stats.commentCoverage} suffix="%" /></CardTitle>
                </CardHeader>
              </Card>
            </Link>
          </div>

          {/* Visual Charts */}
          <AnalysisCharts
            usageBreakdown={usageBreakdown}
            routineCoverage={routineCoverageChart}
            topTags={topTags}
            projectId={projectId}
          />

        </>
      )}

      <ActivityLog projectId={projectId} />
    </div>
  );
}
