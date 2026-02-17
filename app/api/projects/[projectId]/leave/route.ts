import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    // Find the user's share record
    const { data: share } = await serviceClient
      .from("project_shares")
      .select("id, shared_with_email")
      .eq("project_id", projectId)
      .eq("shared_with_user_id", user.id)
      .single();

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    // Delete the share record
    const { error } = await serviceClient
      .from("project_shares")
      .delete()
      .eq("id", share.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity — the trigger will notify the project owner via created_by
    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "member_left",
      targetType: "share",
      targetId: share.id,
      targetName: share.shared_with_email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
