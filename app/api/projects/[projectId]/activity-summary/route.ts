import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's last visit to this project
    const { data: session } = await supabase
      .from("project_user_sessions")
      .select("last_seen_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single();

    const lastSeenAt = session?.last_seen_at;

    // If no previous session, this is their first visit - no summary needed
    if (!lastSeenAt) {
      // Create session record for next time
      await supabase
        .from("project_user_sessions")
        .upsert({
          project_id: projectId,
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
        });

      return NextResponse.json({ summary: null, activities: [] });
    }

    // Fetch activities since last visit (excluding current user's actions)
    const { data: activities } = await supabase
      .from("project_activity_log")
      .select("*")
      .eq("project_id", projectId)
      .gt("created_at", lastSeenAt)
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Update session timestamp
    await supabase
      .from("project_user_sessions")
      .upsert({
        project_id: projectId,
        user_id: user.id,
        last_seen_at: new Date().toISOString(),
      });

    // If no activities, return empty
    if (!activities || activities.length === 0) {
      return NextResponse.json({ summary: null, activities: [] });
    }

    // Generate AI summary
    const summary = await generateActivitySummary(activities);

    return NextResponse.json({
      summary,
      activities,
      since: lastSeenAt,
    });
  } catch (error) {
    console.error("Error in activity summary API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function generateActivitySummary(activities: Array<{
  user_email: string | null;
  action: string;
  target_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}>): Promise<string> {
  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback to simple summary without AI
    return generateSimpleSummary(activities);
  }

  try {
    const client = new Anthropic();

    // Format activities for the prompt
    const activityList = activities.map(a => {
      const user = a.user_email || "Someone";
      const action = formatAction(a.action);
      const target = a.target_name ? ` "${a.target_name}"` : "";
      return `- ${user} ${action}${target}`;
    }).join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `You are summarizing project activity for a PLC programming tool. Write a brief, friendly 1-2 sentence summary of what happened. Be concise and helpful. Don't use emojis.

Recent activity:
${activityList}

Write a natural summary like "While you were away, [changes]. [Optional second sentence about important changes]."`,
        },
      ],
    });

    const textBlock = message.content.find(block => block.type === "text");
    return textBlock?.type === "text" ? textBlock.text : generateSimpleSummary(activities);
  } catch (error) {
    console.error("AI summary generation failed:", error);
    return generateSimpleSummary(activities);
  }
}

function generateSimpleSummary(activities: Array<{
  user_email: string | null;
  action: string;
  target_name: string | null;
}>): string {
  const uniqueUsers = new Set(activities.map(a => a.user_email).filter(Boolean));
  const userCount = uniqueUsers.size;
  const activityCount = activities.length;

  const fileUploads = activities.filter(a => a.action === "file_uploaded").length;
  const fileParses = activities.filter(a => a.action === "file_parsed").length;
  const shares = activities.filter(a => a.action === "project_shared" || a.action === "share_accepted").length;

  const parts: string[] = [];

  if (fileUploads > 0) {
    parts.push(`${fileUploads} file${fileUploads > 1 ? "s were" : " was"} uploaded`);
  }
  if (fileParses > 0) {
    parts.push(`${fileParses} file${fileParses > 1 ? "s were" : " was"} parsed`);
  }
  if (shares > 0) {
    parts.push(`${shares} sharing update${shares > 1 ? "s" : ""}`);
  }

  if (parts.length === 0) {
    return `While you were away, ${activityCount} change${activityCount > 1 ? "s were" : " was"} made by ${userCount} team member${userCount > 1 ? "s" : ""}.`;
  }

  const userText = userCount > 0 ? ` by ${userCount} team member${userCount > 1 ? "s" : ""}` : "";
  return `While you were away, ${parts.join(", ")}${userText}.`;
}

function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    file_uploaded: "uploaded",
    file_deleted: "deleted",
    file_parsed: "parsed",
    file_parse_failed: "failed to parse",
    project_shared: "shared the project with",
    share_accepted: "joined the project",
    share_revoked: "had access revoked",
    project_updated: "updated project settings",
  };
  return actionMap[action] || action.replace(/_/g, " ");
}
