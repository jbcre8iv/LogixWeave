import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Get pending invites for the current user
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pending invites (shares where accepted_at is null)
    const { data: invites, error } = await supabase
      .from("project_shares")
      .select(`
        id,
        permission,
        created_at,
        project:project_id(id, name),
        inviter:invited_by(full_name, email)
      `)
      .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(invites || []);
  } catch (error) {
    console.error("Get invites error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Accept or decline an invite
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { shareId, action } = await request.json();

    if (!shareId || !["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify the invite belongs to this user
    const { data: share } = await supabase
      .from("project_shares")
      .select("id, project_id, shared_with_email, shared_with_user_id")
      .eq("id", shareId)
      .single();

    if (!share) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const isForUser =
      share.shared_with_user_id === user.id ||
      share.shared_with_email === user.email;

    if (!isForUser) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (action === "accept") {
      // Accept the invite
      const { error } = await supabase
        .from("project_shares")
        .update({
          accepted_at: new Date().toISOString(),
          shared_with_user_id: user.id, // Link to user if not already
        })
        .eq("id", shareId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "accepted" });
    } else {
      // Decline - delete the share
      const { error } = await supabase
        .from("project_shares")
        .delete()
        .eq("id", shareId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: "declined" });
    }
  } catch (error) {
    console.error("Update invite error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
