import { NextRequest, NextResponse } from "next/server";
import { getProjectAccess } from "@/lib/project-access";
import Anthropic from "@anthropic-ai/sdk";

// Ensure this route is always dynamic (no caching)
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const access = await getProjectAccess();
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = access;

    // Get user's last visit to this project
    const { data: session, error: sessionError } = await supabase
      .from("project_user_sessions")
      .select("last_seen_at")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError) {
      console.error("Error fetching session:", sessionError);
    }

    const lastSeenAt = session?.last_seen_at;

    // If no previous session, this is their first visit - no summary needed
    if (!lastSeenAt) {
      // Create session record for next time
      const { error: insertError } = await supabase
        .from("project_user_sessions")
        .insert({
          project_id: projectId,
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("Error creating session:", insertError);
      }

      return NextResponse.json({ summary: null, activities: [] }, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Fetch activities since last visit (excluding current user's actions)
    const { data: rawActivities } = await supabase
      .from("project_activity_log")
      .select("*")
      .eq("project_id", projectId)
      .gt("created_at", lastSeenAt)
      .neq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    // If no activities, update timestamp and return empty
    // (Don't update timestamp when activities exist - let user dismiss to update)
    if (!rawActivities || rawActivities.length === 0) {
      await supabase
        .from("project_user_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("user_id", user.id);
      return NextResponse.json({ summary: null, activities: [] }, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    // Look up display names for unique user IDs
    const userIds = [...new Set(rawActivities.map(a => a.user_id).filter(Boolean))] as string[];
    const profileMap = new Map<string, { first_name: string | null; last_name: string | null; full_name: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, full_name")
        .in("id", userIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, { first_name: p.first_name, last_name: p.last_name, full_name: p.full_name });
        }
      }
    }

    // Attach profile data to activities
    const activities = rawActivities.map(a => ({
      ...a,
      profiles: a.user_id ? profileMap.get(a.user_id) || null : null,
    }));

    // Generate AI summary
    const summary = await generateActivitySummary(activities);

    return NextResponse.json({
      summary,
      activities,
      since: lastSeenAt,
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
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
  profiles: { first_name: string | null; last_name: string | null; full_name: string | null } | null;
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
      const user = getActivityUserName(a);
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
  profiles?: { first_name: string | null; last_name: string | null; full_name: string | null } | null;
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

function getActivityUserName(activity: {
  user_email: string | null;
  profiles?: { first_name: string | null; last_name: string | null; full_name: string | null } | null;
}): string {
  const profile = activity.profiles;
  if (profile) {
    const firstLast = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
    if (firstLast) return firstLast;
    if (profile.full_name) return profile.full_name;
  }
  return activity.user_email || "Someone";
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

// POST handler to explicitly dismiss/acknowledge the activity banner
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const access = await getProjectAccess();
    if (!access) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { supabase, user } = access;

    const now = new Date().toISOString();

    // Try to update existing session first
    const { data: updateData, error: updateError } = await supabase
      .from("project_user_sessions")
      .update({ last_seen_at: now })
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .select();

    if (updateError) {
      console.error("Error updating session:", updateError);
      return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
    }

    // If no rows updated, insert new session
    if (!updateData || updateData.length === 0) {
      const { error: insertError } = await supabase
        .from("project_user_sessions")
        .insert({
          project_id: projectId,
          user_id: user.id,
          last_seen_at: now,
        });

      if (insertError) {
        console.error("Error inserting session:", insertError);
        return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in activity dismiss API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
