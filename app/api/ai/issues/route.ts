import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { findIssues, generateHash, AILanguage } from "@/lib/ai/claude-client";

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
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get project and verify access
    const { data: project } = await supabase
      .from("projects")
      .select("id, organization_id, project_files(id, parsing_status)")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const fileIds = project.project_files
      ?.filter((f: { parsing_status: string }) => f.parsing_status === "completed")
      .map((f: { id: string }) => f.id) || [];

    if (fileIds.length === 0) {
      return NextResponse.json({ error: "No parsed files in project" }, { status: 400 });
    }

    // Get routines
    const { data: routines } = await supabase
      .from("parsed_routines")
      .select("name, program_name, type, rung_count")
      .in("file_id", fileIds);

    // Get tags
    const { data: tags } = await supabase
      .from("parsed_tags")
      .select("name, data_type, scope, description")
      .in("file_id", fileIds)
      .limit(500);

    // Get sample rungs
    const { data: rungs } = await supabase
      .from("parsed_rungs")
      .select("routine_name, number, content, comment")
      .in("file_id", fileIds)
      .limit(100);

    if (!routines || !tags) {
      return NextResponse.json({ error: "No data found for analysis" }, { status: 400 });
    }

    // Check cache (include language in hash for language-specific caching)
    const fileId = fileIds[0];
    const target = "project-issues";
    const inputHash = generateHash(
      JSON.stringify(routines.slice(0, 20)) +
      JSON.stringify(tags.slice(0, 100)) +
      JSON.stringify(rungs?.slice(0, 50) || []) +
      language
    );

    const serviceSupabase = await createServiceClient();

    const { data: cached } = await serviceSupabase
      .from("ai_analysis_cache")
      .select("result, tokens_used")
      .eq("file_id", fileId)
      .eq("analysis_type", "issues")
      .eq("target", target)
      .eq("input_hash", inputHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      await serviceSupabase.from("ai_usage_log").insert({
        user_id: user.id,
        organization_id: project.organization_id,
        analysis_type: "issues",
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: cached.tokens_used || 0,
        cached: true,
      });

      return NextResponse.json({
        result: cached.result,
        cached: true,
      });
    }

    // Call Claude API
    const result = await findIssues(
      routines.map((r) => ({
        name: r.name,
        programName: r.program_name,
        type: r.type,
        rungCount: r.rung_count || undefined,
      })),
      tags.map((t) => ({
        name: t.name,
        dataType: t.data_type,
        scope: t.scope,
        description: t.description || undefined,
      })),
      rungs?.map((r) => ({
        routineName: r.routine_name,
        number: r.number,
        content: r.content || "",
        comment: r.comment || undefined,
      })),
      language
    );

    // Cache result
    await serviceSupabase.from("ai_analysis_cache").insert({
      file_id: fileId,
      analysis_type: "issues",
      target,
      input_hash: inputHash,
      result: result as unknown as Record<string, unknown>,
      tokens_used: 2000,
    });

    // Log usage
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: project.organization_id,
      analysis_type: "issues",
      input_tokens: 1000,
      output_tokens: 1000,
      total_tokens: 2000,
      cached: false,
    });

    return NextResponse.json({
      result,
      cached: false,
    });
  } catch (error) {
    console.error("AI issues error:", error);

    if (error instanceof Error && error.message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "AI features are not configured. Please contact support." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
