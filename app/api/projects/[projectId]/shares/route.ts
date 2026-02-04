import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// Get all shares for a project
export async function GET(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns the project
    const { data: project } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    if (!project || project.created_by !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: shares, error } = await supabase
      .from("project_shares")
      .select("id, shared_with_email, permission, created_at, accepted_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(shares);
  } catch (error) {
    console.error("Get shares error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Add a new share
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

    // Verify user owns the project
    const { data: project } = await supabase
      .from("projects")
      .select("created_by, name")
      .eq("id", projectId)
      .single();

    if (!project || project.created_by !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { email, permission = "view" } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Don't allow sharing with yourself
    if (normalizedEmail === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot share a project with yourself" },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    // Create the share (accepted_at is null until user accepts)
    const { data: share, error } = await supabase
      .from("project_shares")
      .insert({
        project_id: projectId,
        shared_with_email: normalizedEmail,
        shared_with_user_id: existingUser?.id || null,
        permission,
        invited_by: user.id,
        accepted_at: null, // User must accept the invite
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This project is already shared with this email" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(share);
  } catch (error) {
    console.error("Create share error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Update a share's permission
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user owns the project
    const { data: project } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    if (!project || project.created_by !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { shareId, permission } = await request.json();

    if (!shareId) {
      return NextResponse.json({ error: "Share ID is required" }, { status: 400 });
    }

    if (!permission || !["view", "edit", "owner"].includes(permission)) {
      return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
    }

    const { data: updatedShare, error } = await supabase
      .from("project_shares")
      .update({ permission })
      .eq("id", shareId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedShare);
  } catch (error) {
    console.error("Update share error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Remove a share
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const shareId = searchParams.get("shareId");

    if (!shareId) {
      return NextResponse.json({ error: "Share ID is required" }, { status: 400 });
    }

    // Verify user owns the project
    const { data: project } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    if (!project || project.created_by !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { error } = await supabase
      .from("project_shares")
      .delete()
      .eq("id", shareId)
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete share error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
