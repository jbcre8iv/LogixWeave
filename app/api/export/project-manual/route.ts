import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { fetchProjectData } from "@/lib/document-generator/data-fetcher";
import { buildAllSections } from "@/lib/document-generator/section-builders";
import { generateNarratives } from "@/lib/document-generator/ai-narrator";
import type { ManualConfig, ManualDocument, GenerationProgress } from "@/lib/document-generator/types";

export const maxDuration = 60; // Allow up to 60s for AI narration

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await request.json();
    const { projectId, config } = body as { projectId: string; config: ManualConfig };

    if (!projectId || !config) {
      return new Response(JSON.stringify({ error: "projectId and config are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user's language preference
    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_language")
      .eq("id", user.id)
      .single();

    const aiLanguage = profile?.ai_language || "en";

    // Use SSE for progress streaming
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (progress: GenerationProgress) => {
          controller.enqueue(encoder.encode(`event: progress\ndata: ${JSON.stringify(progress)}\n\n`));
        };

        try {
          // Stage 1: Fetch data
          sendProgress({ stage: "fetching", message: "Fetching parsed data...", current: 0, total: 0 });
          const projectData = await fetchProjectData(projectId);

          // Stage 2: Build structural sections
          sendProgress({ stage: "building", message: "Building structural sections...", current: 0, total: 1 });
          const sections = buildAllSections(projectData, config);

          // Stage 3: AI narration (if comprehensive mode)
          if (config.detailLevel === "comprehensive") {
            sendProgress({ stage: "narrating", message: "Starting AI narration...", current: 0, total: 0 });
            await generateNarratives(sections, projectData, projectId, aiLanguage, (progress) => {
              sendProgress(progress);
            });
          }

          // Build the final document
          const document: ManualDocument = {
            metadata: {
              projectName: projectData.projectName,
              projectId,
              generatedAt: new Date().toISOString(),
              config,
            },
            sections,
          };

          // Log activity
          await logActivity({
            projectId,
            userId: user.id,
            userEmail: user.email,
            action: "documentation_exported",
            targetType: "export",
            targetName: `project-manual (${config.format}, ${config.detailLevel})`,
          });

          // Send complete event with document
          controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(document)}\n\n`));
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Generation failed";
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Project manual export error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
