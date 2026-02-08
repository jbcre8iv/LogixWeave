import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { explainLogic, generateHash, AILanguage } from "@/lib/ai/claude-client";

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

    const { projectId, routineName, rungNumber } = await request.json();

    if (!projectId || !routineName) {
      return NextResponse.json(
        { error: "projectId and routineName are required" },
        { status: 400 }
      );
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

    // Get rung(s) to analyze
    let rungsQuery = supabase
      .from("parsed_rungs")
      .select("*")
      .in("file_id", fileIds)
      .eq("routine_name", routineName);

    if (rungNumber !== undefined) {
      rungsQuery = rungsQuery.eq("number", rungNumber);
    }

    const { data: rungs } = await rungsQuery.order("number").limit(10);

    if (!rungs || rungs.length === 0) {
      return NextResponse.json({ error: "No rungs found for this routine" }, { status: 404 });
    }

    // Get tags referenced in these rungs
    const rungNumbers = rungs.map((r) => r.number);
    const { data: tagRefs } = await supabase
      .from("tag_references")
      .select("tag_name")
      .in("file_id", fileIds)
      .eq("routine_name", routineName)
      .in("rung_number", rungNumbers);

    const tagNames = [...new Set(tagRefs?.map((r) => r.tag_name) || [])];

    // Get tag info
    let tagInfo: Array<{ name: string; dataType: string; description?: string }> = [];
    if (tagNames.length > 0) {
      const { data: tags } = await supabase
        .from("parsed_tags")
        .select("name, data_type, description")
        .in("file_id", fileIds)
        .in("name", tagNames.slice(0, 50)); // Limit to avoid token overflow

      tagInfo = tags?.map((t) => ({
        name: t.name,
        dataType: t.data_type,
        description: t.description || undefined,
      })) || [];
    }

    // Combine rung content for analysis
    const rungContent = rungs.map((r) => r.content).join("\n");
    const rungComment = rungs.map((r) => r.comment).filter(Boolean).join(" | ");

    // Check cache (include language in hash for language-specific caching)
    const fileId = fileIds[0];
    const target = rungNumber !== undefined ? `${routineName}:${rungNumber}` : routineName;
    const inputHash = generateHash(rungContent + JSON.stringify(tagInfo) + language);

    const serviceSupabase = await createServiceClient();

    const { data: cached } = await serviceSupabase
      .from("ai_analysis_cache")
      .select("result, tokens_used")
      .eq("file_id", fileId)
      .eq("analysis_type", "explain")
      .eq("target", target)
      .eq("input_hash", inputHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      // Log cached usage
      await serviceSupabase.from("ai_usage_log").insert({
        user_id: user.id,
        organization_id: project.organization_id,
        analysis_type: "explain",
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
    const result = await explainLogic(
      routineName,
      rungContent,
      rungComment || undefined,
      tagInfo.length > 0 ? tagInfo : undefined,
      language
    );

    // Cache result
    await serviceSupabase.from("ai_analysis_cache").insert({
      file_id: fileId,
      analysis_type: "explain",
      target,
      input_hash: inputHash,
      result: result as unknown as Record<string, unknown>,
      tokens_used: 1000, // Approximate - Claude API doesn't always return token counts
    });

    // Log usage
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: project.organization_id,
      analysis_type: "explain",
      input_tokens: 500,
      output_tokens: 500,
      total_tokens: 1000,
      cached: false,
    });

    return NextResponse.json({
      result,
      cached: false,
    });
  } catch (error) {
    console.error("AI explain error:", error);

    if (error instanceof Error && error.message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "AI features are not configured. Please contact support." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
