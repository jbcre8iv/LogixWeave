import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractJSON } from "@/lib/ai/claude-client";

interface NamingRegexResult {
  name: string;
  description: string;
  pattern: string;
  severity: "error" | "warning" | "info";
}

const SYSTEM_PROMPT = `You are a regex expert specializing in PLC tag naming conventions for industrial automation.

Given a plain-English description of a naming rule, generate a JavaScript-compatible regex pattern.

CRITICAL: Match-pass semantics — tags that MATCH the pattern are VALID. Tags that do NOT match are violations.

Rules:
- Use ^ and $ anchors when the rule describes the full tag name format
- JavaScript regex only (no lookbehind unless essential)
- Keep patterns simple and readable
- Common PLC prefixes: DI_ DO_ AI_ AO_ (I/O), MTR_ VLV_ PMP_ TNK_ (equipment), area codes like A01_

Respond with ONLY a JSON object:
{ "name": "...", "description": "...", "pattern": "...", "severity": "error|warning|info" }

severity: error = hard requirement, warning = strong convention, info = soft suggestion`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { description } = (await request.json()) as { description: string };

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "A description of the naming rule is required" },
        { status: 400 }
      );
    }

    // Look up org for usage logging
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

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
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: description.trim() }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    const result = extractJSON<NamingRegexResult>(textContent.text);

    // Validate the generated regex
    try {
      new RegExp(result.pattern);
    } catch {
      return NextResponse.json(
        { error: "AI generated an invalid regex pattern. Please try rephrasing your description." },
        { status: 422 }
      );
    }

    // Log usage
    const serviceSupabase = await createServiceClient();
    await serviceSupabase.from("ai_usage_log").insert({
      user_id: user.id,
      organization_id: membership?.organization_id ?? null,
      analysis_type: "naming-regex",
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      cached: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("AI naming-regex error:", error);

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
