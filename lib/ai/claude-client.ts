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

export interface HealthRecommendation {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  impact: string;
  specificItems?: string[];
  actionLink?: {
    label: string;
    tool: "issues" | "explainer" | "tag-xref" | "unused-tags" | "comment-coverage";
  };
}

export interface HealthRecommendationResult {
  summary: string;
  quickWins: string[];
  sections: Array<{
    metric: "tagEfficiency" | "documentation" | "tagUsage";
    currentScore: number;
    weight: string;
    recommendations: HealthRecommendation[];
  }>;
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
 * Try to extract individual fields from truncated/malformed SearchResult JSON via regex.
 */
function extractPartialSearch(text: string): SearchResult | null {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();

  // Match objects like { "name": "...", "type": "...", "relevance": 0.9, "description": "..." }
  const matchPattern = /\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"type"\s*:\s*"(tag|routine|rung|udt|aoi)"\s*,\s*"relevance"\s*:\s*([\d.]+)\s*,\s*"description"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  const matches: SearchResult["matches"] = [];

  let m;
  while ((m = matchPattern.exec(cleaned)) !== null) {
    const entry: SearchResult["matches"][0] = {
      name: m[1].replace(/\\"/g, '"'),
      type: m[2] as "tag" | "routine" | "rung" | "udt" | "aoi",
      relevance: parseFloat(m[3]),
      description: m[4].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\"),
    };

    const remaining = cleaned.substring(m.index + m[0].length);
    const locationMatch = remaining.match(/^\s*,\s*"location"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (locationMatch) {
      entry.location = locationMatch[1].replace(/\\"/g, '"');
    }

    matches.push(entry);
  }

  if (matches.length === 0) return null;

  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const summary = summaryMatch
    ? summaryMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\")
    : `Found ${matches.length} matching items.`;

  return { matches, summary };
}

/**
 * Strip markdown artifacts from a raw response for use as a plain-text fallback.
 * If the response looks like JSON, extract string values to produce readable prose.
 */
function stripMarkdownArtifacts(text: string): string {
  const cleaned = text
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```/g, "")
    .trim();

  // If the entire response is a JSON blob, extract string values as readable text
  if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
    // Pull all JSON string values (skip keys) to build readable text
    const values: string[] = [];
    const valuePattern = /:\s*"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = valuePattern.exec(cleaned)) !== null) {
      const val = m[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\\\/g, "\\")
        .trim();
      if (val.length > 5) values.push(val);
    }
    if (values.length > 0) {
      return values.join("\n\n");
    }
    // Fallback: strip all JSON syntax
    return cleaned
      .replace(/"[a-zA-Z]+"\s*:/g, "")
      .replace(/[{}[\]"]/g, "")
      .replace(/,\s*/g, " ")
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
- Explain the purpose and function of the code in clear, simple language
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
    max_tokens: 8192,
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
      summary: stripMarkdownArtifacts(textContent.text),
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
    max_tokens: 4096,
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
    // Response may be truncated — try to extract individual match objects via regex
    const partial = extractPartialSearch(textContent.text);
    if (partial) return partial;

    return {
      matches: [],
      summary: stripMarkdownArtifacts(textContent.text),
    };
  }
}

/**
 * Try to extract partial health recommendation result from truncated/malformed JSON.
 */
function extractPartialHealth(text: string): HealthRecommendationResult | null {
  const cleaned = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();

  const summaryMatch = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!summaryMatch) return null;

  const summary = summaryMatch[1]
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\\\/g, "\\");

  const result: HealthRecommendationResult = { summary, quickWins: [], sections: [] };

  // Try to extract quickWins array
  const quickWinsMatch = cleaned.match(/"quickWins"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (quickWinsMatch) {
    const winStrings = [...quickWinsMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)];
    result.quickWins = winStrings.map((m) =>
      m[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\")
    );
  }

  return result;
}

export async function recommendHealthImprovements(
  healthScores: {
    overall: number;
    tagEfficiency: number;
    documentation: number;
    tagUsage: number;
  },
  unusedTags: Array<{ name: string; dataType: string; scope: string }>,
  routineCoverage: Array<{ routine: string; coverage: number; commented: number; total: number }>,
  usageBreakdown: { read: number; write: number; both: number },
  topTags: Array<{ name: string; count: number }>,
  routines: Array<{ name: string; programName: string; type: string; rungCount?: number }>,
  versionHistory?: {
    totalVersions: number;
    latestVersion: number;
    versionSummaries: Array<{
      versionNumber: number;
      uploadedAt: string;
      comment?: string;
      stats?: {
        totalTags: number;
        unusedTags: number;
        totalRungs: number;
        commentedRungs: number;
        totalReferences: number;
      };
    }>;
  },
  language: AILanguage = "en",
  previousAnalyses?: Array<{
    healthScores: { overall: number; tagEfficiency: number; documentation: number; tagUsage: number };
    summary: string;
    quickWins: string[];
    analyzedAt: string;
  }> | null,
): Promise<HealthRecommendationResult> {
  const client = getClient();

  const limitedUnusedTags = unusedTags.slice(0, 50);
  const sortedCoverage = [...routineCoverage].sort((a, b) => a.coverage - b.coverage);
  const limitedRoutines = routines.slice(0, 30);

  const languageInstruction = getLanguageInstruction(language);

  const previousAnalysesSection = previousAnalyses && previousAnalyses.length > 0
    ? `\nPrevious Health Analyses (${previousAnalyses.length} prior runs, most recent first):
${previousAnalyses.map((a, i) => {
  const scores = a.healthScores;
  return `- Run ${previousAnalyses.length - i} (${a.analyzedAt}): Overall ${scores.overall}, TagEff ${scores.tagEfficiency}, Docs ${scores.documentation}, Usage ${scores.tagUsage}
  Summary: ${a.summary.substring(0, 200)}${a.summary.length > 200 ? "..." : ""}
  Quick wins: ${a.quickWins.slice(0, 3).join("; ")}`;
}).join("\n")}

When making recommendations, compare current scores to these previous runs:
- Call out improvements by name (e.g., "Tag Efficiency improved from 65 to 78 since the last analysis")
- Flag regressions (e.g., "Documentation score dropped from 72 to 60 — comment coverage has declined")
- Note if previous quick wins appear addressed (e.g., "Previously recommended removing unused tag X — this has been done")
- Flag negative trends (e.g., "Unused tags increased from 5 to 7 over the last 3 analyses")
- Acknowledge positive trends to reinforce good behavior
`
    : "";

  const versionHistorySection = versionHistory && versionHistory.totalVersions > 1
    ? `\nFile Version History (${versionHistory.totalVersions} versions, currently v${versionHistory.latestVersion}):
${versionHistory.versionSummaries.map((v) => {
  const statsLine = v.stats
    ? ` | Tags: ${v.stats.totalTags} (${v.stats.unusedTags} unused), Rungs: ${v.stats.totalRungs} (${v.stats.commentedRungs} commented), Refs: ${v.stats.totalReferences}`
    : "";
  return `- v${v.versionNumber} (${v.uploadedAt})${v.comment ? `: ${v.comment}` : ""}${statsLine}`;
}).join("\n")}

When making recommendations, reference trends you observe across versions. For example:
- If unused tags have been increasing, flag that the project is accumulating dead code
- If comment coverage has been declining, highlight the documentation regression
- If tag references are growing without matching documentation, note the growing complexity
- Acknowledge positive trends too (e.g., "Comment coverage improved from 30% to 45% between v2 and v3")
`
    : "";

  const prompt = `Analyze this PLC project's health metrics and provide specific, actionable recommendations to improve the scores.

Current Health Scores:
- Overall: ${healthScores.overall}/100
- Tag Efficiency (40% weight): ${healthScores.tagEfficiency}/100
- Documentation (35% weight): ${healthScores.documentation}/100
- Tag Usage (25% weight): ${healthScores.tagUsage}/100

Unused Tags (${unusedTags.length} total, showing ${limitedUnusedTags.length}):
${limitedUnusedTags.map((t) => `- ${t.name} (${t.dataType}, ${t.scope})`).join("\n") || "None"}

Routine Comment Coverage (sorted worst-first, ${routineCoverage.length} routines):
${sortedCoverage.slice(0, 20).map((r) => `- ${r.routine}: ${r.coverage}% (${r.commented}/${r.total} rungs commented)`).join("\n") || "No routines"}

Tag Usage Breakdown:
- Read: ${usageBreakdown.read}
- Write: ${usageBreakdown.write}
- Read/Write: ${usageBreakdown.both}

Top Referenced Tags:
${topTags.slice(0, 10).map((t) => `- ${t.name}: ${t.count} references`).join("\n") || "None"}

Routines (${routines.length} total, showing ${limitedRoutines.length}):
${limitedRoutines.map((r) => `- ${r.programName}/${r.name} (${r.type}, ${r.rungCount || 0} rungs)`).join("\n")}
${versionHistorySection}${previousAnalysesSection}
Provide your analysis as JSON with this structure:
{
  "summary": "2-3 sentence overall assessment of the project health",
  "quickWins": ["3-5 specific, easy actions the user can take immediately to improve their score"],
  "sections": [
    {
      "metric": "tagEfficiency",
      "currentScore": ${healthScores.tagEfficiency},
      "weight": "40%",
      "recommendations": [
        {
          "priority": "high|medium|low",
          "title": "Short action title",
          "description": "Detailed explanation naming specific tags/routines",
          "impact": "Expected score improvement description",
          "specificItems": ["Tag1", "Tag2"],
          "actionLink": { "label": "Button text", "tool": "unused-tags|issues|explainer|tag-xref|comment-coverage" }
        }
      ]
    },
    {
      "metric": "documentation",
      "currentScore": ${healthScores.documentation},
      "weight": "35%",
      "recommendations": [...]
    },
    {
      "metric": "tagUsage",
      "currentScore": ${healthScores.tagUsage},
      "weight": "25%",
      "recommendations": [...]
    }
  ]
}

Rules:
- Name specific tags and routines in your recommendations (e.g., "Remove unused tag Motor_Speed_SP")
- Order recommendations by impact (highest first)
- For tag efficiency issues, suggest "View Unused Tags" (tool: "unused-tags") or "Run Issue Finder" (tool: "issues")
- For documentation issues, suggest "View Comment Coverage" (tool: "comment-coverage") or "Explain routine logic" (tool: "explainer")
- For tag usage issues, suggest "View Tag Cross-Reference" (tool: "tag-xref")
- Keep quickWins to truly easy, specific actions${versionHistory && versionHistory.totalVersions > 1 ? "\n- Include version trend observations in your summary and relevant section recommendations" : ""}${previousAnalyses && previousAnalyses.length > 0 ? "\n- Include score trend comparisons in your summary and note which previous recommendations were addressed" : ""}
- Limit to 2-4 recommendations per section${languageInstruction}`;

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
    return extractJSON<HealthRecommendationResult>(textContent.text);
  } catch {
    const partial = extractPartialHealth(textContent.text);
    if (partial) return partial;

    return {
      summary: stripMarkdownArtifacts(textContent.text),
      quickWins: [],
      sections: [],
    };
  }
}
