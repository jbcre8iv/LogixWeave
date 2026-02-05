import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { naturalLanguageSearch, generateHash, AILanguage } from "@/lib/ai/claude-client";

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

    const { projectId, query } = await request.json();

    if (!projectId || !query) {
      return NextResponse.json(
        { error: "projectId and query are required" },
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

    // Get all searchable data
    const [tagsResult, routinesResult, udtsResult, aoisResult] = await Promise.all([
      supabase
        .from("parsed_tags")
        .select("name, data_type, scope, description")
        .in("file_id", fileIds)
        .limit(500),
      supabase
        .from("parsed_routines")
        .select("name, program_name, description")
        .in("file_id", fileIds)
        .limit(100),
      supabase
        .from("parsed_udts")
        .select("name, description")
        .in("file_id", fileIds)
        .limit(50),
      supabase
        .from("parsed_aois")
        .select("name, description")
        .in("file_id", fileIds)
        .limit(50),
    ]);

    const tags = tagsResult.data || [];
    const routines = routinesResult.data || [];
    const udts = udtsResult.data || [];
    const aois = aoisResult.data || [];

    // Check cache (include language in hash for language-specific caching)
    const fileId = fileIds[0];
    const inputHash = generateHash(query + JSON.stringify(tags.slice(0, 50)) + language);

    const serviceSupabase = await createServiceClient();

    const { data: cached } = await serviceSupabase
      .from("ai_analysis_cache")
      .select("result, tokens_used")
      .eq("file_id", fileId)
      .eq("analysis_type", "search")
      .eq("target", query)
      .eq("input_hash", inputHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cached) {
      await serviceSupabase.from("ai_usage_log").insert({
        user_id: user.id,
        organization_id: project.organization_id,
        analysis_type: "search",
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
    const result = await naturalLanguageSearch(
      query,
      tags.map((t) => ({
        name: t.name,
        dataType: t.data_type,
        scope: t.scope,
        description: t.description || undefined,
      })),
      routines.map((r) => ({
        name: r.name,
        programName: r.program_name,
        description: r.description || undefined,
      })),
      udts.length > 0
        ? udts.map((u) => ({
            name: u.name,
            description: u.description || undefined,
          }))
        : undefined,
      aois.length > 0
        ? aois.map((a) => ({
            name: a.name,
            description: a.description || undefined,
          }))
        : undefined,
      language
    );

    // Cache result
    await serviceSupabase.from("ai_analysis_cache").insert({
      file_id: fileId,
      analysis_type: "search",
      target: query,
      input_hash: inputHash,
      result: result as unknown as Record<string, unknown>,
      tokens_used: 1500,
    });

    // Log usage
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: project.organization_id,
      analysis_type: "search",
      input_tokens: 750,
      output_tokens: 750,
      total_tokens: 1500,
      cached: false,
    });

    return NextResponse.json({
      result,
      cached: false,
    });
  } catch (error) {
    console.error("AI search error:", error);

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
