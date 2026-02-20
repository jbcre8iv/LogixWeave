import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("naming_rule_set_id, organization_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Use service client for naming lookups — viewer may be in a different org
    const serviceClient = createServiceClient();

    let ruleSetId = project.naming_rule_set_id;
    let ruleSetName: string | null = null;
    let ruleCount = 0;
    const isExplicit = !!ruleSetId;

    if (!ruleSetId) {
      // No explicit rule set — check for org default
      const { data: defaultSet } = await serviceClient
        .from("naming_rule_sets")
        .select("id, name")
        .eq("organization_id", project.organization_id)
        .eq("is_default", true)
        .single();

      if (defaultSet) {
        ruleSetId = defaultSet.id;
        ruleSetName = defaultSet.name;
      }
    } else {
      const { data: ruleSet } = await serviceClient
        .from("naming_rule_sets")
        .select("name")
        .eq("id", ruleSetId)
        .single();

      ruleSetName = ruleSet?.name || null;
    }

    if (ruleSetId) {
      const { count } = await serviceClient
        .from("naming_rules")
        .select("id", { count: "exact", head: true })
        .eq("rule_set_id", ruleSetId)
        .eq("is_active", true);

      ruleCount = count || 0;
    }

    return NextResponse.json({ ruleSetId, ruleSetName, ruleCount, isExplicit });
  } catch (error) {
    console.error("Get project rule set error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has access to this project's organization
    const { data: project } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", project.organization_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { ruleSetId } = body; // null = reset to org default

    const { data: updated, error } = await supabase
      .from("projects")
      .update({ naming_rule_set_id: ruleSetId || null })
      .eq("id", projectId)
      .select("id, naming_rule_set_id")
      .single();

    if (error) throw error;

    return NextResponse.json({ project: updated });
  } catch (error) {
    console.error("Update project rule set error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
