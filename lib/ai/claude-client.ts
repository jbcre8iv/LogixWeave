import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";

// Initialize client only if API key is available
const getClient = () => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }
  return new Anthropic({ apiKey });
};

export interface AIAnalysisResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
}

export interface ExplanationResult {
  summary: string;
  stepByStep: string[];
  tagsPurpose: Record<string, string>;
  potentialIssues?: string[];
}

export interface IssueResult {
  issues: Array<{
    severity: "error" | "warning" | "info";
    type: string;
    description: string;
    location?: string;
    suggestion?: string;
  }>;
  summary: string;
}

export interface SearchResult {
  matches: Array<{
    name: string;
    type: "tag" | "routine" | "rung" | "udt" | "aoi";
    relevance: number;
    description: string;
    location?: string;
  }>;
  summary: string;
}

/**
 * Extract JSON from Claude responses that may include markdown fences or prose.
 * Tries three strategies: direct parse, code-fence extraction, brace scanning.
 */
function extractJSON<T>(text: string): T {
  const trimmed = text.trim();

  // Strategy 1: Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Strategy 2: Code-fence regex
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Strategy 3: Brace scanning — find first { to last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
    } catch {
      // continue
    }
  }

  throw new Error("Could not extract JSON from response");
}

/**
 * Try to extract individual fields from truncated/malformed JSON via regex.
 * Returns a partial ExplanationResult or null if nothing useful was found.
 */
function extractPartialExplanation(text: string): ExplanationResult | null {
  // Strip fences first
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();

  // Try to pull the "summary" value
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!summaryMatch) return null;

  const summary = summaryMatch[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");

  const result: ExplanationResult = { summary, stepByStep: [], tagsPurpose: {} };

  // Try to pull stepByStep array entries
  const stepsMatch = cleaned.match(/"stepByStep"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (stepsMatch) {
    const stepStrings = [...stepsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)];
    result.stepByStep = stepStrings.map((m) =>
      m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\")
    );
  }

  // Try to pull tagsPurpose entries
  const tagsMatch = cleaned.match(/"tagsPurpose"\s*:\s*\{([\s\S]*?)(?:\}|$)/);
  if (tagsMatch) {
    const tagEntries = [...tagsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
    for (const entry of tagEntries) {
      result.tagsPurpose[entry[1].replace(/\\"/g, '"')] = entry[2]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\\\/g, "\\");
    }
  }

  // Try to pull potentialIssues array entries
  const issuesMatch = cleaned.match(/"potentialIssues"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (issuesMatch) {
    const issueStrings = [...issuesMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)];
    result.potentialIssues = issueStrings.map((m) =>
      m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\")
    );
  }

  return result;
}

/**
 * Try to extract individual fields from truncated/malformed IssueResult JSON via regex.
 */
function extractPartialIssues(text: string): IssueResult | null {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();

  // Try to find issue objects: { "severity": "...", "type": "...", "description": "..." }
  const issuePattern = /\{\s*"severity"\s*:\s*"(error|warning|info)"\s*,\s*"type"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"description"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const issues: IssueResult["issues"] = [];

  let match;
  while ((match = issuePattern.exec(cleaned)) !== null) {
    const entry: IssueResult["issues"][0] = {
      severity: match[1] as "error" | "warning" | "info",
      type: match[2].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\"),
      description: match[3].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\"),
    };

    // Try to grab optional location and suggestion from the same object block
    const remaining = cleaned.substring(match.index + match[0].length);
    const locationMatch = remaining.match(/^\s*,\s*"location"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (locationMatch) {
      entry.location = locationMatch[1].replace(/\\"/g, '"');
    }
    const suggestionMatch = remaining.match(/"suggestion"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (suggestionMatch) {
      entry.suggestion = suggestionMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
    }

    issues.push(entry);
  }

  if (issues.length === 0) return null;

  // Try to pull the summary
  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const summary = summaryMatch
    ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\")
    : `Found ${issues.length} potential issues.`;

  return { issues, summary };
}

/**
 * Strip markdown artifacts from a raw response for use as a plain-text fallback.
 */
function stripMarkdownArtifacts(text: string): string {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();

  // If the entire response is a JSON blob, strip JSON syntax to get readable text
  if (cleaned.startsWith("{")) {
    return cleaned
      .replace(/"[a-zA-Z]+"\s*:/g, "")
      .replace(/[{}[\]",]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return cleaned;
}

export function generateHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 16);
}

// Language codes and their display names
export const AI_LANGUAGES = {
  en: "English",
  it: "Italian",
  es: "Spanish",
} as const;

export type AILanguage = keyof typeof AI_LANGUAGES;

// Get language instruction to append to prompts
function getLanguageInstruction(language: AILanguage): string {
  if (language === "en") {
    return ""; // No instruction needed for English (default)
  }
  const languageName = AI_LANGUAGES[language];
  return `\n\nIMPORTANT: Respond in ${languageName}. All text content in your response (summaries, descriptions, explanations, suggestions) must be written in ${languageName}.`;
}

const SYSTEM_PROMPT = `You are an expert PLC programmer and industrial automation specialist. You analyze Studio 5000 / RSLogix 5000 ladder logic code and provide clear, accurate explanations and insights.

When analyzing ladder logic:
- Explain the purpose and function of the code in plain English
- Identify what each tag represents and its role in the logic
- Note any safety-critical or timing-sensitive operations
- Point out potential issues, anti-patterns, or improvements
- Use terminology familiar to PLC programmers

Always respond with valid JSON matching the requested format.`;

export async function explainLogic(
  routineName: string,
  rungContent: string,
  rungComment?: string,
  tagInfo?: Array<{ name: string; dataType: string; description?: string }>,
  language: AILanguage = "en"
): Promise<ExplanationResult> {
  const client = getClient();

  const tagContext = tagInfo
    ? tagInfo.map((t) => `- ${t.name} (${t.dataType})${t.description ? `: ${t.description}` : ""}`).join("\n")
    : "";

  const languageInstruction = getLanguageInstruction(language);

  const prompt = `Analyze this ladder logic rung from routine "${routineName}":

${rungComment ? `Comment: ${rungComment}\n` : ""}
Ladder Logic:
\`\`\`
${rungContent}
\`\`\`

${tagContext ? `Tags used:\n${tagContext}\n` : ""}

Provide your analysis as JSON with this structure:
{
  "summary": "One paragraph explaining what this rung does overall",
  "stepByStep": ["Step 1...", "Step 2...", ...],
  "tagsPurpose": {"TagName": "What this tag represents", ...},
  "potentialIssues": ["Any issues or concerns (optional)"]
}${languageInstruction}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  try {
    return extractJSON<ExplanationResult>(textContent.text);
  } catch {
    // Response may be truncated or malformed — try to extract fields via regex
    const partial = extractPartialExplanation(textContent.text);
    if (partial) return partial;

    return {
      summary: textContent.text
        .replace(/```(?:json)?\s*/g, "")
        .replace(/```/g, "")
        .replace(/"[a-zA-Z]+"\s*:/g, "")
        .replace(/[{}[\]",]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      stepByStep: [],
      tagsPurpose: {},
    };
  }
}

export async function findIssues(
  routines: Array<{
    name: string;
    programName: string;
    type: string;
    rungCount?: number;
  }>,
  tags: Array<{
    name: string;
    dataType: string;
    scope: string;
    description?: string;
  }>,
  rungs?: Array<{
    routineName: string;
    number: number;
    content: string;
    comment?: string;
  }>,
  language: AILanguage = "en"
): Promise<IssueResult> {
  const client = getClient();

  // Limit content to avoid token limits
  const limitedRungs = rungs?.slice(0, 50) || [];
  const limitedTags = tags.slice(0, 200);

  const languageInstruction = getLanguageInstruction(language);

  const rungSummary = limitedRungs.length > 0
    ? limitedRungs.map((r) => `${r.routineName}:${r.number} - ${r.content.substring(0, 100)}...`).join("\n")
    : "No rung content available";

  const prompt = `Analyze this PLC project for potential issues:

Routines (${routines.length} total):
${routines.slice(0, 20).map((r) => `- ${r.programName}/${r.name} (${r.type}, ${r.rungCount || 0} rungs)`).join("\n")}

Tags (${tags.length} total, showing ${limitedTags.length}):
${limitedTags.slice(0, 50).map((t) => `- ${t.name} (${t.dataType}) in ${t.scope}`).join("\n")}

Sample Rungs:
${rungSummary}

Look for:
1. Potential logic errors or anti-patterns
2. Missing or unclear documentation
3. Naming convention violations
4. Unused or redundant code patterns
5. Safety concerns
6. Performance issues

Respond with JSON:
{
  "issues": [
    {
      "severity": "error|warning|info",
      "type": "Category of issue",
      "description": "Description of the issue",
      "location": "Where the issue was found (optional)",
      "suggestion": "How to fix it (optional)"
    }
  ],
  "summary": "Overall assessment of the project"
}${languageInstruction}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  try {
    return extractJSON<IssueResult>(textContent.text);
  } catch {
    // Response may be truncated — try to extract individual issue objects via regex
    const partial = extractPartialIssues(textContent.text);
    if (partial) return partial;

    return {
      issues: [],
      summary: stripMarkdownArtifacts(textContent.text),
    };
  }
}

export async function naturalLanguageSearch(
  query: string,
  tags: Array<{
    name: string;
    dataType: string;
    scope: string;
    description?: string;
  }>,
  routines: Array<{
    name: string;
    programName: string;
    description?: string;
  }>,
  udts?: Array<{
    name: string;
    description?: string;
  }>,
  aois?: Array<{
    name: string;
    description?: string;
  }>,
  language: AILanguage = "en"
): Promise<SearchResult> {
  const client = getClient();

  // Limit content to avoid token limits
  const limitedTags = tags.slice(0, 300);
  const limitedRoutines = routines.slice(0, 50);

  const languageInstruction = getLanguageInstruction(language);

  const prompt = `A user is searching for: "${query}"

Available items in this PLC project:

Tags (${tags.length} total):
${limitedTags.map((t) => `- ${t.name} (${t.dataType}, ${t.scope})${t.description ? `: ${t.description}` : ""}`).join("\n")}

Routines (${routines.length} total):
${limitedRoutines.map((r) => `- ${r.programName}/${r.name}${r.description ? `: ${r.description}` : ""}`).join("\n")}

${udts && udts.length > 0 ? `UDTs:\n${udts.slice(0, 20).map((u) => `- ${u.name}${u.description ? `: ${u.description}` : ""}`).join("\n")}\n` : ""}
${aois && aois.length > 0 ? `AOIs:\n${aois.slice(0, 20).map((a) => `- ${a.name}${a.description ? `: ${a.description}` : ""}`).join("\n")}\n` : ""}

Find items that match the user's search intent. Consider:
- Direct name matches
- Related functionality
- Description matches
- Implied relationships

Respond with JSON:
{
  "matches": [
    {
      "name": "Item name",
      "type": "tag|routine|rung|udt|aoi",
      "relevance": 0.0-1.0,
      "description": "Why this matches the search",
      "location": "Where to find it (optional)"
    }
  ],
  "summary": "Brief explanation of search results"
}

Return up to 20 most relevant matches, sorted by relevance.${languageInstruction}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1536,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  try {
    return extractJSON<SearchResult>(textContent.text);
  } catch {
    return {
      matches: [],
      summary: stripMarkdownArtifacts(textContent.text),
    };
  }
}
