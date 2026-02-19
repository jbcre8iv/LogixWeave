import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    // Check if rule applies to this tag type
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
          tagName,
          tagScope,
          message: `Tag "${tagName}" does not match rule "${rule.name}"`,
        });
      }
    } catch {
      // Invalid regex, skip this rule
      continue;
    }
  }

  return violations;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const severityFilter = searchParams.get("severity");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get project and organization
    const { data: project } = await supabase
      .from("projects")
      .select("id, organization_id, project_files(id)")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Fetch naming_rule_set_id separately (column may not exist pre-migration)
    const { data: projectRuleSetRow } = await supabase
      .from("projects")
      .select("naming_rule_set_id")
      .eq("id", projectId)
      .single();
    const projectRuleSetId: string | null = projectRuleSetRow?.naming_rule_set_id ?? null;

    const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

    if (fileIds.length === 0) {
      return NextResponse.json({
        violations: [],
        summary: { errors: 0, warnings: 0, info: 0, total: 0 },
        tagsChecked: 0,
      });
    }

    // Resolve the effective rule set: project override or org default
    let ruleSetId = projectRuleSetId;
    if (!ruleSetId) {
      const { data: defaultSet } = await supabase
        .from("naming_rule_sets")
        .select("id")
        .eq("organization_id", project.organization_id)
        .eq("is_default", true)
        .single();

      ruleSetId = defaultSet?.id ?? null;
    }

    // Get active naming rules — use rule_set_id if available, fall back to organization_id
    let rules;
    if (ruleSetId) {
      const { data } = await supabase
        .from("naming_rules")
        .select("id, name, pattern, applies_to, severity")
        .eq("rule_set_id", ruleSetId)
        .eq("is_active", true);
      rules = data;
    } else {
      const { data } = await supabase
        .from("naming_rules")
        .select("id, name, pattern, applies_to, severity")
        .eq("organization_id", project.organization_id)
        .eq("is_active", true);
      rules = data;
    }

    if (!rules || rules.length === 0) {
      return NextResponse.json({
        violations: [],
        summary: { errors: 0, warnings: 0, info: 0, total: 0 },
        tagsChecked: 0,
        message: "No active naming rules configured",
      });
    }

    // Get all tags for validation
    const { data: tags } = await supabase
      .from("parsed_tags")
      .select("name, scope")
      .in("file_id", fileIds);

    if (!tags || tags.length === 0) {
      return NextResponse.json({
        violations: [],
        summary: { errors: 0, warnings: 0, info: 0, total: 0 },
        tagsChecked: 0,
      });
    }

    // Detect scope conflicts
    const scopeConflicts = detectScopeConflicts(tags);

    // Validate all tags
    const allViolations: Violation[] = [];
    for (const tag of tags) {
      const violations = validateTag(tag.name, tag.scope, rules);
      allViolations.push(...violations);
    }

    // Apply severity filter if provided
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
      scopeConflicts: scopeConflicts.length,
    };

    return NextResponse.json({
      violations: filteredViolations,
      scopeConflicts,
      summary,
      tagsChecked: tags.length,
      rulesApplied: rules.length,
    });
  } catch (error) {
    console.error("Naming validation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
