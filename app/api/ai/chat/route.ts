import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { AILanguage, AI_LANGUAGES } from "@/lib/ai/claude-client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 20;

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

    const { projectId, messages } = (await request.json()) as {
      projectId: string;
      messages: ChatMessage[];
    };

    if (!projectId || !messages?.length) {
      return NextResponse.json(
        { error: "projectId and messages are required" },
        { status: 400 }
      );
    }

    // Get project and verify access
    const { data: project } = await supabase
      .from("projects")
      .select("id, name, organization_id, project_files(id, parsing_status, current_version)")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const completedFiles =
      project.project_files?.filter(
        (f: { parsing_status: string }) => f.parsing_status === "completed"
      ) || [];
    const fileIds = completedFiles.map((f: { id: string }) => f.id);

    if (fileIds.length === 0) {
      return NextResponse.json(
        { error: "No parsed files in project" },
        { status: 400 }
      );
    }

    // Resolve latest version IDs to avoid duplicate data from old versions
    const { data: latestVersions } = await supabase
      .from("file_versions")
      .select("id, file_id, version_number")
      .in("file_id", fileIds);

    const versionIds = (latestVersions || [])
      .filter((v: { file_id: string; version_number: number }) => {
        const file = completedFiles.find((f: { id: string }) => f.id === v.file_id);
        return file && v.version_number === (file as { current_version: number }).current_version;
      })
      .map((v: { id: string }) => v.id);

    // Gather project context in parallel (filter by version_id for current versions only)
    const [tagsResult, routinesResult, udtsResult, aoisResult] =
      await Promise.all([
        supabase
          .from("parsed_tags")
          .select("name, data_type, scope, description")
          .in("version_id", versionIds)
          .limit(500),
        supabase
          .from("parsed_routines")
          .select("name, program_name, type, description, rung_count")
          .in("version_id", versionIds)
          .limit(100),
        supabase
          .from("parsed_udts")
          .select("name, description")
          .in("version_id", versionIds)
          .limit(50),
        supabase
          .from("parsed_aois")
          .select("name, description")
          .in("version_id", versionIds)
          .limit(50),
      ]);

    const tags = tagsResult.data || [];
    const routines = routinesResult.data || [];
    const udts = udtsResult.data || [];
    const aois = aoisResult.data || [];

    // Build system prompt
    const languageInstruction =
      language !== "en"
        ? `\n\nIMPORTANT: Respond in ${AI_LANGUAGES[language]}.`
        : "";

    const systemPrompt = `You are an expert PLC programmer and industrial automation specialist. You are helping a user understand and work with their Rockwell Automation PLC project "${project.name}".

Here is the project data:

TAGS (${tags.length}):
${tags.map((t) => `- ${t.name} (${t.data_type}, scope: ${t.scope})${t.description ? ` — ${t.description}` : ""}`).join("\n")}

ROUTINES (${routines.length}):
${routines.map((r) => `- ${r.name} (program: ${r.program_name}, type: ${r.type}, rungs: ${r.rung_count})${r.description ? ` — ${r.description}` : ""}`).join("\n")}

${udts.length > 0 ? `USER-DEFINED TYPES (${udts.length}):\n${udts.map((u) => `- ${u.name}${u.description ? ` — ${u.description}` : ""}`).join("\n")}\n` : ""}
${aois.length > 0 ? `ADD-ON INSTRUCTIONS (${aois.length}):\n${aois.map((a) => `- ${a.name}${a.description ? ` — ${a.description}` : ""}`).join("\n")}\n` : ""}
Answer questions about this project. Be concise, accurate, and use PLC terminology. If asked about something not reflected in the data above, say so.${languageInstruction}`;

    // Truncate to most recent messages
    const recentMessages = messages.slice(-MAX_MESSAGES);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI features are not configured. Please contact support." },
        { status: 503 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: systemPrompt,
      messages: recentMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Log usage
    const serviceSupabase = await createServiceClient();
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: project.organization_id,
      analysis_type: "project-chat",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      cached: false,
    });

    return NextResponse.json({ reply: textContent.text });
  } catch (error) {
    console.error("AI project chat error:", error);

    if (error instanceof Error && error.message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "AI features are not configured. Please contact support." },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message.includes("credit balance")) {
      return NextResponse.json(
        {
          error:
            "AI service credits have been exhausted. Please contact support.",
        },
        { status: 503 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
