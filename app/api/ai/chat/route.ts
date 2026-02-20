import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { logActivity } from "@/lib/activity-log";
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

    const { projectId, messages, conversationId } = (await request.json()) as {
      projectId: string;
      messages: ChatMessage[];
      conversationId?: string;
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
    const [tagsResult, routinesResult, udtsResult, aoisResult, rungsResult, refsResult, tasksResult] =
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
        supabase
          .from("parsed_rungs")
          .select("routine_name, program_name, number, content, comment")
          .in("version_id", versionIds)
          .order("number")
          .limit(500),
        supabase
          .from("tag_references")
          .select("tag_name, routine_name, program_name, rung_number, usage_type")
          .in("file_id", fileIds)
          .limit(1000),
        supabase
          .from("parsed_tasks")
          .select("name, type, rate, priority, watchdog, scheduled_programs")
          .in("version_id", versionIds),
      ]);

    const tags = tagsResult.data || [];
    const routines = routinesResult.data || [];
    const udts = udtsResult.data || [];
    const aois = aoisResult.data || [];
    const rungs = rungsResult.data || [];
    const tagRefs = refsResult.data || [];
    const tasks = tasksResult.data || [];

    // Build system prompt
    const languageInstruction =
      language !== "en"
        ? `\n\nIMPORTANT: Respond in ${AI_LANGUAGES[language]}.`
        : "";

    const pid = projectId;
    const toolLinks = {
      tags: `/dashboard/projects/${pid}/tags`,
      routines: `/dashboard/projects/${pid}/routines`,
      udts: `/dashboard/projects/${pid}/udts`,
      aois: `/dashboard/projects/${pid}/aois`,
      io: `/dashboard/projects/${pid}/io`,
      ioMapping: `/dashboard/projects/${pid}/io-mapping`,
      analysis: `/dashboard/projects/${pid}/analysis`,
      tagXref: `/dashboard/projects/${pid}/analysis/tag-xref`,
      unusedTags: `/dashboard/projects/${pid}/analysis/unused-tags`,
      naming: `/dashboard/projects/${pid}/analysis/naming`,
      commentCoverage: `/dashboard/projects/${pid}/analysis/comment-coverage`,
      tasks: `/dashboard/projects/${pid}/analysis/tasks`,
      explain: `/dashboard/projects/${pid}/ai/explain`,
      issues: `/dashboard/projects/${pid}/ai/issues`,
      search: `/dashboard/projects/${pid}/ai/search`,
      health: `/dashboard/projects/${pid}/ai/health`,
      documentation: `/dashboard/projects/${pid}/tools/documentation`,
      bulkTags: `/dashboard/projects/${pid}/tools/bulk-tags`,
    };

    // Group rungs by routine for structured context
    const rungsByRoutine: Record<string, typeof rungs> = {};
    for (const r of rungs) {
      const key = `${r.program_name}/${r.routine_name}`;
      if (!rungsByRoutine[key]) rungsByRoutine[key] = [];
      rungsByRoutine[key].push(r);
    }

    const rungsSection = Object.entries(rungsByRoutine)
      .map(([key, rungList]) => {
        const lines = rungList.map(
          (r) =>
            `  Rung ${r.number}${r.comment ? ` [${r.comment}]` : ""}${r.content ? `: ${r.content}` : ""}`
        );
        return `${key}:\n${lines.join("\n")}`;
      })
      .join("\n\n");

    // Build tag cross-reference summary
    const tagRefSummary = tagRefs.reduce<Record<string, { routines: Set<string>; usage: Set<string> }>>(
      (acc, ref) => {
        if (!acc[ref.tag_name]) acc[ref.tag_name] = { routines: new Set(), usage: new Set() };
        acc[ref.tag_name].routines.add(`${ref.program_name}/${ref.routine_name}`);
        acc[ref.tag_name].usage.add(ref.usage_type);
        return acc;
      },
      {}
    );

    const tagRefSection = Object.entries(tagRefSummary)
      .map(([name, info]) => `- ${name}: used in ${[...info.routines].join(", ")} (${[...info.usage].join("/")})`)
      .join("\n");

    const systemPrompt = `You are an expert PLC programmer and industrial automation specialist. You are helping a user understand and work with their Rockwell Automation PLC project "${project.name}" inside the LogixWeave platform.

You have FULL ACCESS to all parsed project data including ladder logic, tags, routines, cross-references, and more. You CAN and SHOULD examine, analyze, and explain any part of the project when asked. Never say you don't have access or can't see the data — it's all provided below.

PROJECT DATA:

TAGS (${tags.length}):
${tags.map((t) => `- ${t.name} (${t.data_type}, scope: ${t.scope})${t.description ? ` — ${t.description}` : ""}`).join("\n")}

ROUTINES (${routines.length}):
${routines.map((r) => `- ${r.name} (program: ${r.program_name}, type: ${r.type}, rungs: ${r.rung_count})${r.description ? ` — ${r.description}` : ""}`).join("\n")}

${udts.length > 0 ? `USER-DEFINED TYPES (${udts.length}):\n${udts.map((u) => `- ${u.name}${u.description ? ` — ${u.description}` : ""}`).join("\n")}\n` : ""}
${aois.length > 0 ? `ADD-ON INSTRUCTIONS (${aois.length}):\n${aois.map((a) => `- ${a.name}${a.description ? ` — ${a.description}` : ""}`).join("\n")}\n` : ""}
${tasks.length > 0 ? `TASKS (${tasks.length}):\n${tasks.map((t) => `- ${t.name} (${t.type}${t.type === "PERIODIC" && t.rate ? `, rate: ${t.rate}ms` : ""}, priority: ${t.priority}${t.watchdog ? `, watchdog: ${t.watchdog}ms` : ""}, programs: ${(t.scheduled_programs || []).join(", ") || "none"})`).join("\n")}\n` : ""}
LADDER LOGIC (${rungs.length} rungs):
${rungsSection}

TAG CROSS-REFERENCES (${tagRefs.length} references):
${tagRefSection}

RESPONSE GUIDELINES:

1. **Summarize first.** When a question could produce a lengthy answer, give a concise high-level summary (a few sentences or short bullet points). Then ask the user if they'd like more detail on specific parts or the full breakdown.

2. **Be concise.** Use PLC terminology. Avoid repeating raw data the user can already see in the app.

3. **Direct tool links.** When a LogixWeave tool can help the user, provide a direct clickable link — do NOT explain navigation steps or tell the user "go to X page". Just include the link naturally in your response.

CRITICAL FORMATTING RULES for links:
- Use EXACTLY this markdown syntax: [Link Text](url) — no emojis before the bracket, no spaces between ] and (, no extra characters.
- GOOD: "Check the [Unused Tags](${toolLinks.unusedTags}) tool to find unreferenced tags."
- GOOD: "You can explore this in the [Tag Cross-Reference](${toolLinks.tagXref})."
- BAD: "👉 [Open Unused Tags Tool](url)" — no emojis before links
- BAD: Showing the raw URL path to the user
- BAD: "Navigate to Analysis > Unused Tags" — never give navigation instructions, just link directly

Available tools (use exact URLs below):
- Tag Explorer: ${toolLinks.tags}
- Routines: ${toolLinks.routines}
- UDTs: ${toolLinks.udts}
- AOIs: ${toolLinks.aois}
- I/O Modules: ${toolLinks.io}
- I/O Mapping: ${toolLinks.ioMapping}
- Analysis Dashboard: ${toolLinks.analysis}
- Tag Cross-Reference: ${toolLinks.tagXref}
- Unused Tags: ${toolLinks.unusedTags}
- Naming Conventions: ${toolLinks.naming}
- Comment Coverage: ${toolLinks.commentCoverage}
- Task Configuration: ${toolLinks.tasks}
- Logic Explainer: ${toolLinks.explain}
- Issue Finder: ${toolLinks.issues}
- AI Search: ${toolLinks.search}
- Health Coach: ${toolLinks.health}
- Project Manual: ${toolLinks.documentation}
- Bulk Tag Editor: ${toolLinks.bulkTags}

4. Only suggest 1-3 of the most relevant tools per response — don't list them all.

5. **Never claim you lack access.** You have the full project data above — tags, routines, ladder logic, and cross-references. When the user asks you to examine something, do it directly using the data provided. Only mention limitations if specific data is genuinely absent from the sections above (e.g., the project has no AOIs).${languageInstruction}`;

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
    const serviceSupabase = createServiceClient();
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: project.organization_id,
      analysis_type: "project-chat",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      cached: false,
    });

    // Persist messages to conversation if conversationId provided
    if (conversationId) {
      const lastUserMessage = messages[messages.length - 1];
      const messagesToInsert = [
        {
          conversation_id: conversationId,
          role: "user" as const,
          content: lastUserMessage.content,
        },
        {
          conversation_id: conversationId,
          role: "assistant" as const,
          content: textContent.text,
        },
      ];

      await serviceSupabase.from("ai_chat_messages").insert(messagesToInsert);

      // Auto-title on first message: check if this is the first exchange
      const { count } = await serviceSupabase
        .from("ai_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      if (count !== null && count <= 2) {
        // First exchange — set title from first user message
        const title = lastUserMessage.content.slice(0, 80);
        await serviceSupabase
          .from("ai_chat_conversations")
          .update({ title })
          .eq("id", conversationId);
      } else {
        // Touch updated_at via a no-op update (trigger handles timestamp)
        await serviceSupabase
          .from("ai_chat_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }
    }

    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "ai_analysis_run",
      targetType: "analysis",
      targetName: "chat",
    });

    return NextResponse.json({
      reply: textContent.text,
      conversationId: conversationId || null,
    });
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
