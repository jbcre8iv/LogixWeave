import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import type {
  ManualSection,
  ProjectData,
  NarrativeContent,
  TasksContent,
  ProgramsContent,
  GenerationProgress,
} from "./types";

const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
};

function generateHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

const NARRATOR_SYSTEM_PROMPT = `You are a senior controls engineer and PLC programming expert writing professional project documentation. You have deep expertise in Rockwell Automation / Allen-Bradley platforms, ladder logic, structured text, and industrial automation systems.

Writing style:
- Be factual and direct. State what the system does, not what it "appears to" or "seems to" do.
- Use precise PLC and automation terminology (e.g., "latching relay," "one-shot rising," "periodic task," "scan cycle") without over-explaining standard concepts.
- Write for an audience of controls engineers, maintenance technicians, and project managers — people who work with these systems daily.
- Never hedge or speculate. If the data shows a program handles motor control, say so directly.

When describing programs and routines:
- Identify the controlled process or equipment based on tag names, I/O references, and program structure.
- Call out safety interlocks, fault handling, and alarm logic when present.
- Note timing-critical operations, periodic task rates, and watchdog configurations.
- Describe data flow between programs when cross-references indicate shared tags.
- Reference specific tag names and routine names to ground descriptions in the actual project.

Always respond with plain text paragraphs, not JSON or markdown formatting.`;

/**
 * Check cache for a narrative result.
 */
async function getCachedNarrative(
  fileId: string,
  target: string,
  inputHash: string
): Promise<string | null> {
  const serviceSupabase = createServiceClient();
  const { data } = await serviceSupabase
    .from("ai_analysis_cache")
    .select("result")
    .eq("file_id", fileId)
    .eq("analysis_type", "manual_narrative")
    .eq("target", target)
    .eq("input_hash", inputHash)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (data?.result) {
    const result = data.result as { narrative: string };
    return result.narrative || null;
  }
  return null;
}

/**
 * Cache a narrative result.
 */
async function cacheNarrative(
  fileId: string,
  target: string,
  inputHash: string,
  narrative: string,
  tokensUsed: number
): Promise<void> {
  const serviceSupabase = createServiceClient();
  await serviceSupabase.from("ai_analysis_cache").insert({
    file_id: fileId,
    analysis_type: "manual_narrative",
    target,
    input_hash: inputHash,
    result: { narrative },
    tokens_used: tokensUsed,
  });
}


function getLanguageInstruction(language: string): string {
  const languages: Record<string, string> = { en: "English", it: "Italian", es: "Spanish" };
  if (language === "en") return "";
  const name = languages[language] || language;
  return `\n\nIMPORTANT: Respond in ${name}. All text must be written in ${name}.`;
}

/**
 * Generate executive summary narrative.
 */
async function generateProjectNarrative(
  data: ProjectData,
  language: string
): Promise<string> {
  const client = getClient();
  const programNames = [...new Set(data.routines.map((r) => r.program_name))];
  const topTags = getTopReferencedTags(data, 10);

  const prompt = `Write a 2-3 paragraph executive summary for this PLC project.

Project: ${data.projectName}
Processor: ${data.metadata.processorType || "Unknown"}
Software Revision: ${data.metadata.softwareRevision || "Unknown"}

Programs (${programNames.length}): ${programNames.join(", ")}
Total Tags: ${data.tags.length}
Total Routines: ${data.routines.length}
Total Rungs: ${data.rungs.length}
I/O Modules: ${data.modules.length}
Tasks: ${data.tasks.map((t) => `${t.name} (${t.type})`).join(", ") || "None defined"}

Most Referenced Tags: ${topTags.map((t) => t.name).join(", ")}

Identify the controlled process, equipment, or system based on the tag names, program names, and project structure. State the project scope, architecture (task types, program organization), and key characteristics. Reference specific names from the data — do not generalize.${getLanguageInstruction(language)}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: NARRATOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((c) => c.type === "text");
  return text?.type === "text" ? text.text.trim() : "";
}

/**
 * Generate narrative for a single program, including routine summaries.
 */
async function generateProgramNarrative(
  programName: string,
  data: ProjectData,
  language: string
): Promise<{ programNarrative: string; routineSummaries: Record<string, string> }> {
  const client = getClient();
  const routines = data.routines.filter((r) => r.program_name === programName);
  const programRungs = data.rungs.filter((r) => r.program_name === programName);

  // Build routine summaries with limited rung content
  const routineDetails = routines.slice(0, 10).map((routine) => {
    const rungsForRoutine = programRungs
      .filter((r) => r.routine_name === routine.name)
      .slice(0, 10);
    const rungSnippets = rungsForRoutine
      .map((r) => `  Rung ${r.number}: ${r.content.substring(0, 150)}${r.comment ? ` // ${r.comment}` : ""}`)
      .join("\n");
    return `Routine: ${routine.name} (${routine.type}, ${routine.rung_count ?? 0} rungs)${routine.description ? `\n  Description: ${routine.description}` : ""}${rungSnippets ? `\n${rungSnippets}` : ""}`;
  });

  // Get top tags used in this program
  const programRefs = data.tagReferences.filter((r) => r.program_name === programName);
  const tagCounts = new Map<string, number>();
  for (const ref of programRefs) {
    tagCounts.set(ref.tag_name, (tagCounts.get(ref.tag_name) || 0) + 1);
  }
  const topProgramTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  const prompt = `Document this PLC program. Provide:
1. A program overview paragraph — state what this program controls, its role in the system, and how it interacts with other programs or I/O. Be specific: reference tag names and routine names.
2. A one-sentence summary for each routine — describe what the routine does, not its structure.

Program: ${programName}
Top Tags: ${topProgramTags.join(", ")}

${routineDetails.join("\n\n")}

Format your response as:
PROGRAM_OVERVIEW:
[Your overview paragraph]

ROUTINE_SUMMARIES:
${routines.map((r) => `${r.name}: [one sentence summary]`).join("\n")}${getLanguageInstruction(language)}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    system: NARRATOR_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content.find((c) => c.type === "text");
  const rawText = text?.type === "text" ? text.text.trim() : "";

  // Parse the structured response
  let programNarrative = "";
  const routineSummaries: Record<string, string> = {};

  const overviewMatch = rawText.match(/PROGRAM_OVERVIEW:\s*([\s\S]*?)(?=ROUTINE_SUMMARIES:|$)/);
  if (overviewMatch) {
    programNarrative = overviewMatch[1].trim();
  }

  const summariesMatch = rawText.match(/ROUTINE_SUMMARIES:\s*([\s\S]*?)$/);
  if (summariesMatch) {
    const summaryLines = summariesMatch[1].trim().split("\n");
    for (const line of summaryLines) {
      const match = line.match(/^([^:]+):\s*(.+)/);
      if (match) {
        routineSummaries[match[1].trim()] = match[2].trim();
      }
    }
  }

  // Fallback: if parsing failed, use the entire text as narrative
  if (!programNarrative && rawText) {
    programNarrative = rawText;
  }

  return { programNarrative, routineSummaries };
}

function getTopReferencedTags(data: ProjectData, limit: number) {
  const tagCounts = new Map<string, number>();
  for (const ref of data.tagReferences) {
    tagCounts.set(ref.tag_name, (tagCounts.get(ref.tag_name) || 0) + 1);
  }
  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Generate all AI narratives and inject them into the sections.
 * Uses caching to avoid redundant API calls.
 */
export async function generateNarratives(
  sections: ManualSection[],
  data: ProjectData,
  projectId: string,
  language: string,
  onProgress: (progress: GenerationProgress) => void
): Promise<void> {
  // Find file ID for caching
  const fileId = await getFirstProjectFileId(projectId);
  if (!fileId) return;

  const programNames = [...new Set(data.routines.map((r) => r.program_name))];
  const totalSteps = 1 + programNames.length; // executive summary + programs
  let currentStep = 0;

  // 1. Executive Summary narrative
  const execSection = sections.find((s) => s.id === "executiveSummary");
  if (execSection && execSection.content.type === "narrative") {
    onProgress({ stage: "narrating", message: "Generating project overview...", current: currentStep, total: totalSteps });

    const content = execSection.content as NarrativeContent;
    const inputHash = generateHash(`exec:${data.projectName}:${data.tags.length}:${data.routines.length}:${language}`);

    let narrative = await getCachedNarrative(fileId, "executive_summary", inputHash);
    if (!narrative) {
      try {
        narrative = await generateProjectNarrative(data, language);
        await cacheNarrative(fileId, "executive_summary", inputHash, narrative, 1000);
      } catch (err) {
        console.error("Failed to generate executive narrative:", err);
        narrative = null;
      }
    }

    if (narrative) {
      content.narrative = narrative;
    }
    currentStep++;
  }

  // 2. System Architecture narrative
  const archSection = sections.find((s) => s.id === "systemArchitecture");
  if (archSection && archSection.content.type === "tasks") {
    // No separate AI call for tasks — included in exec summary
  }

  // 3. Program narratives
  const programSection = sections.find((s) => s.id === "programsRoutines");
  if (programSection && programSection.content.type === "programs") {
    const content = programSection.content as ProgramsContent;

    for (const program of content.programs) {
      onProgress({
        stage: "narrating",
        message: `Generating narrative for ${program.name}...`,
        current: currentStep,
        total: totalSteps,
      });

      const routineNames = program.routines.map((r) => r.name).join(",");
      const inputHash = generateHash(`program:${program.name}:${routineNames}:${language}`);

      const cachedNarrative = await getCachedNarrative(fileId, `program:${program.name}`, inputHash);
      if (cachedNarrative) {
        // Parse cached result — it may be the full narrative or include routine summaries
        program.narrative = cachedNarrative;
        currentStep++;
        continue;
      }

      try {
        const { programNarrative, routineSummaries } = await generateProgramNarrative(
          program.name,
          data,
          language
        );

        program.narrative = programNarrative;

        // Inject routine summaries
        for (const routine of program.routines) {
          if (routineSummaries[routine.name]) {
            routine.summary = routineSummaries[routine.name];
          }
        }

        // Cache the combined result
        const cacheValue = JSON.stringify({ narrative: programNarrative, routineSummaries });
        await cacheNarrative(fileId, `program:${program.name}`, inputHash, cacheValue, 1500);
      } catch (err) {
        console.error(`Failed to generate narrative for ${program.name}:`, err);
      }

      currentStep++;
    }
  }
}

async function getFirstProjectFileId(projectId: string): Promise<string | null> {
  const serviceSupabase = createServiceClient();
  const { data: file } = await serviceSupabase
    .from("project_files")
    .select("id")
    .eq("project_id", projectId)
    .eq("parsing_status", "completed")
    .limit(1)
    .single();
  return file?.id || null;
}
