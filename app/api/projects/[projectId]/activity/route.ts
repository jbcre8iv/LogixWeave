import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();

    // Verify user has access to project
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query params for pagination
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch activity log
    const { data: rawActivities, error, count } = await supabase
      .from("project_activity_log")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching activity log:", error);
      return NextResponse.json({ error: "Failed to fetch activity log" }, { status: 500 });
    }

    // Look up display names for unique user IDs
    const userIds = [...new Set((rawActivities || []).map(a => a.user_id).filter(Boolean))] as string[];
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
    const activities = (rawActivities || []).map(a => ({
      ...a,
      profiles: a.user_id ? profileMap.get(a.user_id) || null : null,
    }));

    return NextResponse.json({
      activities,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error in activity log API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
