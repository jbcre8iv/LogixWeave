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

    // Gather project context in parallel — higher limits for troubleshooting
    const [tagsResult, routinesResult, udtsResult, aoisResult, rungsResult, refsResult, tasksResult] =
      await Promise.all([
        supabase
          .from("parsed_tags")
          .select("name, data_type, scope, description")
          .in("version_id", versionIds)
          .limit(1000),
        supabase
          .from("parsed_routines")
          .select("name, program_name, type, description, rung_count")
          .in("version_id", versionIds)
          .limit(200),
        supabase
          .from("parsed_udts")
          .select("name, description")
          .in("version_id", versionIds)
          .limit(100),
        supabase
          .from("parsed_aois")
          .select("name, description")
          .in("version_id", versionIds)
          .limit(100),
        supabase
          .from("parsed_rungs")
          .select("routine_name, program_name, number, content, comment")
          .in("version_id", versionIds)
          .order("number")
          .limit(1500),
        supabase
          .from("tag_references")
          .select("tag_name, routine_name, program_name, rung_number, usage_type")
          .in("file_id", fileIds)
          .limit(3000),
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
      tagXref: `/dashboard/projects/${pid}/analysis/tag-xref`,
      ioMapping: `/dashboard/projects/${pid}/io-mapping`,
      explain: `/dashboard/projects/${pid}/ai/explain`,
      issues: `/dashboard/projects/${pid}/ai/issues`,
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

    const systemPrompt = `You are an expert PLC troubleshooting specialist. You are helping a user diagnose a real-world issue in their Rockwell Automation PLC project "${project.name}" inside the LogixWeave platform.

You have FULL ACCESS to all parsed project data including ladder logic, tags, routines, cross-references, and more. Use this data to trace logic paths and identify root causes.

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

TROUBLESHOOTING APPROACH:

1. **Clarify symptoms first.** If the user's description is vague, ask 1-2 targeted follow-up questions: "What is the expected vs actual behavior?", "When does this happen — always, intermittently, or after a specific event?", "Are there any faults in the controller?" Keep follow-ups brief and specific.

2. **Trace logic backward.** Starting from the reported symptom (e.g., an output that won't turn on), trace the permissive chain backward through the ladder logic. Name specific tags, rungs, and routines. Show the chain of conditions that must be true.

3. **Rank root causes.** List the most likely to least likely causes, with reasoning grounded in the actual rung logic. Consider:
   - Missing permissives (a condition in the rung is not met)
   - Latched conditions (OTL/OTU imbalance, seal-in circuits stuck)
   - Race conditions (tag written in multiple routines — check cross-references)
   - Sensor/input failure (physical input not energized)
   - Communication faults (I/O module offline, network issues)
   - Timing issues (scan time, periodic task rate, one-shot missed)
   - Fault routines (check if a major/minor fault handler is active)

4. **Give diagnostic checklists.** Structure as actionable steps the user can take at the PLC:
   - "Check tag \`TagName\` — it should be 1 if the motor starter is energized"
   - "Look at rung N in Program/Routine — the XIC condition \`Tag\` may be false"
   - "Verify the physical input at the field device"

5. **Use cross-reference data.** Flag tags that are written in multiple routines (potential race conditions), tags that are read but never written (may need an external source), and tags referenced in fault-handling routines.

RESPONSE FORMAT:

Structure diagnostic responses with these sections (use markdown headers):

**Likely Causes** — Ranked from most to least likely, each with reasoning from the actual logic

**Diagnostic Steps** — Numbered, actionable steps referencing specific tags and rungs the user can check

**Logic Trace** — The specific rung chain you traced, showing the permissive path

Omit sections that don't apply (e.g., skip Logic Trace if you need more info first). Keep responses focused and actionable — avoid generic PLC theory unless the user asks for it.

FORMATTING RULES for links:
- Use EXACTLY this markdown syntax: [Link Text](url)
- GOOD: "Check the [Tag Cross-Reference](${toolLinks.tagXref}) to see where this tag is used."
- BAD: "Navigate to Analysis > Tag Cross-Reference"

Available tools (use exact URLs):
- Tag Explorer: ${toolLinks.tags}
- Routines: ${toolLinks.routines}
- Tag Cross-Reference: ${toolLinks.tagXref}
- I/O Mapping: ${toolLinks.ioMapping}
- Logic Explainer: ${toolLinks.explain}
- Issue Finder: ${toolLinks.issues}

Only suggest the most relevant tool per response — don't list them all.

**Never claim you lack access.** You have the full project data above. When the user asks you to examine something, do it directly.${languageInstruction}`;

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
      max_tokens: 4096,
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
      analysis_type: "troubleshoot-chat",
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

      // Auto-title on first message
      const { count } = await serviceSupabase
        .from("ai_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      if (count !== null && count <= 2) {
        const title = lastUserMessage.content.slice(0, 80);
        await serviceSupabase
          .from("ai_chat_conversations")
          .update({ title })
          .eq("id", conversationId);
      } else {
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
      targetName: "troubleshoot",
    });

    return NextResponse.json({
      reply: textContent.text,
      conversationId: conversationId || null,
    });
  } catch (error) {
    console.error("AI troubleshoot chat error:", error);

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
