import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { AILanguage, AI_LANGUAGES } from "@/lib/ai/claude-client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExplanationResult {
  summary: string;
  stepByStep: string[];
  tagsPurpose: Record<string, string>;
  potentialIssues?: string[];
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

    const { projectId, routineName, analysisContext, messages } =
      (await request.json()) as {
        projectId: string;
        routineName: string;
        analysisContext: ExplanationResult;
        messages: ChatMessage[];
      };

    if (!projectId || !routineName || !analysisContext || !messages?.length) {
      return NextResponse.json(
        { error: "projectId, routineName, analysisContext, and messages are required" },
        { status: 400 }
      );
    }

    // Verify project access
    const { data: project } = await supabase
      .from("projects")
      .select("id, organization_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Build system prompt with analysis context
    const languageInstruction =
      language !== "en"
        ? `\n\nIMPORTANT: Respond in ${AI_LANGUAGES[language]}.`
        : "";

    const systemPrompt = `You are an expert PLC programmer and industrial automation specialist helping a user understand their ladder logic code. You previously analyzed the routine "${routineName}" and produced this analysis:

Summary: ${analysisContext.summary}

Step-by-step:
${analysisContext.stepByStep.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Tags:
${Object.entries(analysisContext.tagsPurpose).map(([tag, purpose]) => `- ${tag}: ${purpose}`).join("\n")}

${analysisContext.potentialIssues?.length ? `Potential issues:\n${analysisContext.potentialIssues.map((i) => `- ${i}`).join("\n")}` : ""}

Answer follow-up questions about this analysis. Be concise and use PLC terminology. If asked about something outside the analysis scope, say so.${languageInstruction}`;

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
      max_tokens: 1024,
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
      analysis_type: "explain-chat",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      cached: false,
    });

    return NextResponse.json({ reply: textContent.text });
  } catch (error) {
    console.error("AI explain chat error:", error);

    if (error instanceof Error && error.message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "AI features are not configured. Please contact support." },
        { status: 503 }
      );
    }

    if (error instanceof Error && error.message.includes("credit balance")) {
      return NextResponse.json(
        { error: "AI service credits have been exhausted. Please contact support." },
        { status: 503 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
