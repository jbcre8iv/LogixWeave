import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, AlertCircle, AlertTriangle, Info, CheckCircle, Settings, Layers } from "lucide-react";
import { ExportCSVButton } from "@/components/export-csv-button";
import { RuleSetPicker } from "@/components/tools/rule-set-picker";
import { RuleSetPreview } from "@/components/tools/rule-set-preview";

interface NamingPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    severity?: string;
    ruleSet?: string;
  }>;
}

interface NamingRule {
  id: string;
  name: string;
  pattern: string;
  applies_to: string;
  severity: string;
}

interface Violation {
  ruleId: string;
  ruleName: string;
  severity: string;
  pattern: string;
  tagName: string;
  tagScope: string;
  message: string;
}

interface ScopeConflict {
  tagName: string;
  programs: string[];
}

function detectScopeConflicts(tags: { name: string; scope: string }[]): ScopeConflict[] {
  const scopeMap = new Map<string, Set<string>>();
  for (const tag of tags) {
    if (!scopeMap.has(tag.name)) scopeMap.set(tag.name, new Set());
    scopeMap.get(tag.name)!.add(tag.scope);
  }

  const conflicts: ScopeConflict[] = [];
  for (const [name, scopes] of scopeMap) {
    if (scopes.has("Controller") && scopes.size > 1) {
      const programs = [...scopes].filter(s => s !== "Controller").sort();
      conflicts.push({ tagName: name, programs });
    }
  }
  return conflicts.sort((a, b) => a.tagName.localeCompare(b.tagName));
}

function validateTag(
  tagName: string,
  tagScope: string,
  rules: NamingRule[]
): Violation[] {
  const violations: Violation[] = [];

  for (const rule of rules) {
    const appliesToTag =
      rule.applies_to === "all" ||
      (rule.applies_to === "controller" && tagScope === "Controller") ||
      (rule.applies_to === "program" && tagScope !== "Controller");

    if (!appliesToTag) continue;

    try {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(tagName)) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          pattern: rule.pattern,
          tagName,
          tagScope,
          message: `Tag "${tagName}" does not match rule "${rule.name}"`,
        });
      }
    } catch {
      continue;
    }
  }

  return violations;
}

/**
 * Highlights the non-matching portions of a tag name in red.
 * Strips anchors from the regex pattern, finds all matching segments
 * within the tag, and wraps everything else in a red span.
 */
function highlightViolation(tagName: string, pattern: string): React.ReactNode {
  try {
    // Strip ^ and $ anchors so the pattern can find partial matches
    const stripped = pattern.replace(/^\^/, "").replace(/\$$/, "");
    if (!stripped) return <span className="text-red-500">{tagName}</span>;

    const regex = new RegExp(stripped, "g");
    const matches: Array<{ start: number; end: number }> = [];
    let match;

    while ((match = regex.exec(tagName)) !== null) {
      if (match[0].length === 0) {
        regex.lastIndex++;
        continue;
      }
      matches.push({ start: match.index, end: match.index + match[0].length });
    }

    if (matches.length === 0) {
      return <span className="text-red-500">{tagName}</span>;
    }

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    for (const { start, end } of matches) {
      if (start > lastEnd) {
        segments.push(
          <span key={`v-${lastEnd}`} className="text-red-500">{tagName.slice(lastEnd, start)}</span>
        );
      }
      segments.push(
        <span key={`m-${start}`}>{tagName.slice(start, end)}</span>
      );
      lastEnd = end;
    }

    if (lastEnd < tagName.length) {
      segments.push(
        <span key={`v-${lastEnd}`} className="text-red-500">{tagName.slice(lastEnd)}</span>
      );
    }

    return <>{segments}</>;
  } catch {
    return tagName;
  }
}

/**
 * Generates a human-readable reason for why a tag violates a naming rule.
 * Extracts the non-matching characters and categorizes them.
 */
function describeViolation(tagName: string, pattern: string, ruleName: string): string {
  try {
    const stripped = pattern.replace(/^\^/, "").replace(/\$$/, "");
    if (!stripped) return `Does not match the "${ruleName}" pattern`;

    const regex = new RegExp(stripped, "g");
    const matches: Array<{ start: number; end: number }> = [];
    let match;

    while ((match = regex.exec(tagName)) !== null) {
      if (match[0].length === 0) { regex.lastIndex++; continue; }
      matches.push({ start: match.index, end: match.index + match[0].length });
    }

    // Collect non-matching segments
    const nonMatching: string[] = [];
    let lastEnd = 0;
    for (const { start, end } of matches) {
      if (start > lastEnd) nonMatching.push(tagName.slice(lastEnd, start));
      lastEnd = end;
    }
    if (lastEnd < tagName.length) nonMatching.push(tagName.slice(lastEnd));

    if (nonMatching.length === 0) return `Does not match the "${ruleName}" pattern`;

    const chars = nonMatching.join("");
    const types: string[] = [];
    if (/[a-z]/.test(chars)) types.push("lowercase");
    if (/[A-Z]/.test(chars)) types.push("uppercase");
    if (/_/.test(chars)) types.push("underscore");
    if (/\d/.test(chars)) types.push("numeric");
    if (/[^a-zA-Z0-9_]/.test(chars)) types.push("special");

    const quoted = nonMatching.map((s) => `"${s}"`).join(", ");

    if (types.length === 0) return `Does not match the "${ruleName}" pattern`;

    return `Contains ${types.join("/")} characters (${quoted}) not permitted by this rule`;
  } catch {
    return `Does not match the "${ruleName}" pattern`;
  }
}

export default async function NamingValidationPage({ params, searchParams }: NamingPageProps) {
  const { projectId } = await params;
  const { severity: severityFilter, ruleSet: ruleSetParam } = await searchParams;

  const supabase = await createClient();

  // Get project info and current user in parallel
  const [{ data: project, error: projectError }, { data: { user } }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, organization_id, project_files(id)")
      .eq("id", projectId)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (projectError || !project) {
    notFound();
  }

  // Fetch naming_rule_set_id separately (column may not exist pre-migration)
  const { data: projectRuleSetRow } = await supabase
    .from("projects")
    .select("naming_rule_set_id")
    .eq("id", projectId)
    .single();
  const projectRuleSetId: string | null = projectRuleSetRow?.naming_rule_set_id ?? null;

  const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

  // Always use the project's org — all viewers see the same naming results
  const ruleSetOrgId = project.organization_id;

  // Use service client for naming rule lookups — the viewer may be in a
  // different org (e.g. after ownership transfer) so RLS on naming tables
  // would block cross-org reads. Project access was already verified above.
  const serviceClient = createServiceClient();

  // Fetch all rule sets for the picker (may be empty pre-migration)
  const { data: allRuleSets } = await serviceClient
    .from("naming_rule_sets")
    .select("id, name, is_default")
    .eq("organization_id", ruleSetOrgId)
    .order("is_default", { ascending: false })
    .order("name");

  // Resolve effective rule set — project's explicit assignment, or org default
  let effectiveRuleSetId: string | null = projectRuleSetId;
  if (!effectiveRuleSetId) {
    const defaultSet = allRuleSets?.find((rs) => rs.is_default);
    effectiveRuleSetId = defaultSet?.id ?? null;
  }

  const effectiveRuleSetName = allRuleSets?.find((rs) => rs.id === effectiveRuleSetId)?.name ?? "Naming Rules";

  if (fileIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Naming Validation</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
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
      </div>
    );
  }

  // Get active naming rules — use rule_set_id if available, fall back to organization_id
  let rules: NamingRule[] = [];
  if (effectiveRuleSetId) {
    const { data } = await serviceClient
      .from("naming_rules")
      .select("id, name, pattern, applies_to, severity")
      .eq("rule_set_id", effectiveRuleSetId)
      .eq("is_active", true);
    rules = data || [];
  }
  if (rules.length === 0 && !effectiveRuleSetId) {
    const { data } = await serviceClient
      .from("naming_rules")
      .select("id, name, pattern, applies_to, severity")
      .eq("organization_id", ruleSetOrgId)
      .eq("is_active", true);
    rules = data || [];
  }

  const pickerCurrentRuleSetId = projectRuleSetId;

  if (rules.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Naming Validation</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <div className="space-y-6">
              <p className="text-muted-foreground">
                No active naming rules found in the current rule set.
              </p>
              <div>
                <Button asChild>
                  <Link href="/dashboard/settings/naming-rules">
                    <Settings className="mr-2 h-4 w-4" />
                    Configure Naming Rules
                  </Link>
                </Button>
              </div>
              {(allRuleSets || []).length > 1 && (
                <div className="flex flex-col items-center gap-2.5 pt-6 border-t">
                  <span className="text-xs text-muted-foreground">Or switch rule set</span>
                  <RuleSetPicker
                    projectId={projectId}
                    ruleSets={allRuleSets || []}
                    currentRuleSetId={pickerCurrentRuleSetId}
                    mode="persist"
                    currentSeverityFilter={severityFilter}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get all tags
  const { data: tags } = await supabase
    .from("parsed_tags")
    .select("name, scope")
    .in("file_id", fileIds);

  // Detect scope conflicts
  const scopeConflicts = detectScopeConflicts(tags || []);

  // Validate all tags
  const allViolations: Violation[] = [];
  for (const tag of tags || []) {
    const violations = validateTag(tag.name, tag.scope, rules);
    allViolations.push(...violations);
  }

  // Apply filter
  let filteredViolations = allViolations;
  if (severityFilter && severityFilter !== "all") {
    filteredViolations = allViolations.filter((v) => v.severity === severityFilter);
  }

  // Calculate summary
  const summary = {
    errors: allViolations.filter((v) => v.severity === "error").length,
    warnings: allViolations.filter((v) => v.severity === "warning").length,
    info: allViolations.filter((v) => v.severity === "info").length,
    total: allViolations.length,
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge className="bg-red-500/10 text-red-500">Error</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Warning</Badge>;
      case "info":
        return <Badge className="bg-blue-500/10 text-blue-500">Info</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  // Build severity filter URLs that preserve the ruleSet param
  const buildFilterUrl = (severity: string) => {
    const params = new URLSearchParams();
    params.set("severity", severity);
    if (ruleSetParam) params.set("ruleSet", ruleSetParam);
    return `?${params.toString()}`;
  };

  const buildClearFilterUrl = () => {
    if (ruleSetParam) return `?ruleSet=${encodeURIComponent(ruleSetParam)}`;
    return "?";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/projects/${projectId}/analysis`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Naming Validation</h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <span>{project.name}</span>
              <span className="mx-0.5">&middot;</span>
              <span>{tags?.length || 0} tags</span>
              <span className="mx-0.5">&middot;</span>
              <span>{rules.length} active rules</span>
              {scopeConflicts.length > 0 && (
                <>
                  <span className="mx-0.5">&middot;</span>
                  <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                    <Layers className="h-3 w-3 mr-1" />
                    {scopeConflicts.length} scope conflict{scopeConflicts.length === 1 ? "" : "s"}
                  </Badge>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <RuleSetPicker
                projectId={projectId}
                ruleSets={allRuleSets || []}
                currentRuleSetId={pickerCurrentRuleSetId}
                mode="persist"
                currentSeverityFilter={severityFilter}
              />
              <RuleSetPreview
                ruleSetName={effectiveRuleSetName}
                rules={rules}
              />
              {severityFilter && severityFilter !== "all" && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={buildClearFilterUrl()}>Clear Filter</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/naming-rules">
              <Settings className="mr-2 h-4 w-4" />
              Manage Rules
            </Link>
          </Button>
          <ExportCSVButton
            filename="naming_validation.csv"
            disabled={allViolations.length === 0 && scopeConflicts.length === 0}
            data={[
              ["Severity", "Tag Name", "Scope", "Rule", "Reason"],
              ...allViolations.map((v) => [
                v.severity,
                v.tagName,
                v.tagScope,
                v.ruleName,
                describeViolation(v.tagName, v.pattern, v.ruleName),
              ]),
              ...scopeConflicts.map((c) => [
                "scope-conflict",
                c.tagName,
                `Controller + ${c.programs.join(", ")}`,
                "Scope Conflict",
                `Tag exists in both Controller and program scope(s): ${c.programs.join(", ")}`,
              ]),
            ]}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={summary.total === 0 ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>Total Violations</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {summary.total === 0 ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <span className="text-green-500">0</span>
                </>
              ) : (
                summary.total.toLocaleString()
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Link href={buildFilterUrl("error")}>
          <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${severityFilter === "error" ? "border-primary" : ""}`}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Errors
              </CardDescription>
              <CardTitle className="text-3xl text-red-500">{summary.errors}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href={buildFilterUrl("warning")}>
          <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${severityFilter === "warning" ? "border-primary" : ""}`}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Warnings
              </CardDescription>
              <CardTitle className="text-3xl text-yellow-500">{summary.warnings}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link href={buildFilterUrl("info")}>
          <Card className={`hover:bg-accent/50 transition-colors cursor-pointer ${severityFilter === "info" ? "border-primary" : ""}`}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                Info
              </CardDescription>
              <CardTitle className="text-3xl text-blue-500">{summary.info}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Scope Conflicts */}
      {scopeConflicts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <Layers className="h-5 w-5" />
              Scope Conflicts
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 ml-1">
                {scopeConflicts.length}
              </Badge>
            </CardTitle>
            <CardDescription>
              These tags exist in both Controller scope and one or more Program scopes.
              The program-scoped tag shadows the controller tag within that program.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag Name</TableHead>
                  <TableHead>Shadowed In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopeConflicts.map((conflict) => (
                  <TableRow key={conflict.tagName}>
                    <TableCell className="font-mono text-sm">{conflict.tagName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {conflict.programs.map((program) => (
                          <Badge key={program} variant="secondary">{program}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Violations Table */}
      {filteredViolations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Violations</CardTitle>
            <CardDescription>
              {filteredViolations.length} violation{filteredViolations.length === 1 ? "" : "s"}
              {severityFilter && severityFilter !== "all" ? ` (filtered by ${severityFilter})` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Severity</TableHead>
                    <TableHead>Tag Name</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Rule</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredViolations.map((violation, idx) => (
                    <TableRow key={`${violation.tagName}-${violation.ruleId}-${idx}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(violation.severity)}
                          {getSeverityBadge(violation.severity)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{highlightViolation(violation.tagName, violation.pattern)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{violation.tagScope}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {violation.ruleName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {describeViolation(violation.tagName, violation.pattern, violation.ruleName)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-600">
              {severityFilter && severityFilter !== "all"
                ? `No ${severityFilter} violations found!`
                : "All tags pass naming validation!"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Your tags comply with the configured naming rules.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
