import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// Helper: check if user can manage shares (creator OR accepted owner-share)
async function canManageShares(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string
): Promise<{ authorized: boolean; isCreator: boolean }> {
  const { data: project } = await supabase
    .from("projects")
    .select("created_by")
    .eq("id", projectId)
    .single();

  if (!project) return { authorized: false, isCreator: false };
  if (project.created_by === userId) return { authorized: true, isCreator: true };

  // Check for accepted owner share permission
  const { data: share } = await supabase
    .from("project_shares")
    .select("permission")
    .eq("project_id", projectId)
    .eq("shared_with_user_id", userId)
    .eq("permission", "owner")
    .not("accepted_at", "is", null)
    .single();

  return { authorized: !!share, isCreator: false };
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

    const { authorized } = await canManageShares(supabase, projectId, user.id);
    if (!authorized) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: shares, error } = await supabase
      .from("project_shares")
      .select("id, shared_with_email, shared_with_user_id, permission, created_at, accepted_at")
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

    const { authorized, isCreator } = await canManageShares(supabase, projectId, user.id);
    if (!authorized) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { email, permission = "view" } = await request.json();

    // Only the project creator can grant owner permission
    if (!isCreator && permission === "owner") {
      return NextResponse.json(
        { error: "Only the project creator can grant owner permission" },
        { status: 403 }
      );
    }

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

    // Log activity
    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "project_shared",
      targetType: "share",
      targetId: share.id,
      targetName: normalizedEmail,
      metadata: { permission },
    });

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

    const { authorized, isCreator } = await canManageShares(supabase, projectId, user.id);
    if (!authorized) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { shareId, permission } = await request.json();

    if (!shareId) {
      return NextResponse.json({ error: "Share ID is required" }, { status: 400 });
    }

    if (!permission || !["view", "edit", "owner"].includes(permission)) {
      return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
    }

    // Only the project creator can grant or modify owner permission
    if (!isCreator && permission === "owner") {
      return NextResponse.json(
        { error: "Only the project creator can grant owner permission" },
        { status: 403 }
      );
    }

    // Non-creators cannot change an existing owner-share's permission
    if (!isCreator) {
      const { data: existingShare } = await supabase
        .from("project_shares")
        .select("permission")
        .eq("id", shareId)
        .eq("project_id", projectId)
        .single();

      if (existingShare?.permission === "owner") {
        return NextResponse.json(
          { error: "Only the project creator can change an owner's permission" },
          { status: 403 }
        );
      }
    }

    const { data: updatedShare, error } = await supabase
      .from("project_shares")
      .update({ permission })
      .eq("id", shareId)
      .eq("project_id", projectId)
      .select("*, shared_with_email")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity for permission change
    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "permission_changed",
      targetType: "share",
      targetId: shareId,
      targetName: updatedShare.shared_with_email,
      metadata: { permission, shareId },
    });

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

    const { authorized, isCreator } = await canManageShares(supabase, projectId, user.id);
    if (!authorized) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Non-creators cannot remove someone with owner permission
    if (!isCreator) {
      const { data: targetShare } = await supabase
        .from("project_shares")
        .select("permission")
        .eq("id", shareId)
        .eq("project_id", projectId)
        .single();

      if (targetShare?.permission === "owner") {
        return NextResponse.json(
          { error: "Only the project creator can remove an owner" },
          { status: 403 }
        );
      }
    }

    // Get share details before deleting for logging and direct notification
    const { data: shareToDelete } = await supabase
      .from("project_shares")
      .select("shared_with_email, shared_with_user_id")
      .eq("id", shareId)
      .single();

    const { error } = await supabase
      .from("project_shares")
      .delete()
      .eq("id", shareId)
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "share_revoked",
      targetType: "share",
      targetId: shareId,
      targetName: shareToDelete?.shared_with_email,
    });

    // Send direct notification to the revoked user (they're no longer in
    // project_shares so the trigger can't reach them)
    if (shareToDelete?.shared_with_user_id) {
      try {
        const serviceClient = createServiceClient();
        const { data: proj } = await serviceClient
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .single();

        await serviceClient.from("notifications").insert({
          user_id: shareToDelete.shared_with_user_id,
          type: "project_activity",
          title: "Access revoked",
          message: `Your access to "${proj?.name || "a project"}" has been revoked`,
          link: "/dashboard",
          metadata: { project_id: projectId, action: "share_revoked" },
        });
      } catch (notifError) {
        console.error("Failed to notify revoked user:", notifError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete share error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Transfer project ownership
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only the project creator can transfer ownership
    const { data: project } = await supabase
      .from("projects")
      .select("created_by, name")
      .eq("id", projectId)
      .single();

    if (!project || project.created_by !== user.id) {
      return NextResponse.json(
        { error: "Only the project creator can transfer ownership" },
        { status: 403 }
      );
    }

    const { newOwnerUserId } = await request.json();

    if (!newOwnerUserId || typeof newOwnerUserId !== "string") {
      return NextResponse.json({ error: "New owner user ID is required" }, { status: 400 });
    }

    // Cannot transfer to yourself
    if (newOwnerUserId === user.id) {
      return NextResponse.json(
        { error: "You are already the project owner" },
        { status: 400 }
      );
    }

    // Verify new owner exists in profiles
    const serviceClient = createServiceClient();
    const { data: newOwnerProfile } = await serviceClient
      .from("profiles")
      .select("id, email")
      .eq("id", newOwnerUserId)
      .single();

    if (!newOwnerProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify new owner has an accepted share on this project
    const { data: existingShare } = await supabase
      .from("project_shares")
      .select("id")
      .eq("project_id", projectId)
      .eq("shared_with_user_id", newOwnerUserId)
      .not("accepted_at", "is", null)
      .single();

    if (!existingShare) {
      return NextResponse.json(
        { error: "The new owner must have an accepted share on this project" },
        { status: 400 }
      );
    }

    // Perform the transfer using service client to bypass RLS:
    // 1. Update projects.created_by to newOwnerUserId
    const { error: updateError } = await serviceClient
      .from("projects")
      .update({ created_by: newOwnerUserId })
      .eq("id", projectId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 2. Delete the new owner's existing share (they're now the creator)
    await serviceClient
      .from("project_shares")
      .delete()
      .eq("project_id", projectId)
      .eq("shared_with_user_id", newOwnerUserId);

    // 3. Create an "owner" share for the old creator (so they retain full access)
    await serviceClient
      .from("project_shares")
      .insert({
        project_id: projectId,
        shared_with_email: user.email!,
        shared_with_user_id: user.id,
        permission: "owner",
        invited_by: newOwnerUserId,
        accepted_at: new Date().toISOString(),
      });

    // Log activity
    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "ownership_transferred",
      targetType: "project",
      targetId: projectId,
      targetName: newOwnerProfile.email,
      metadata: {
        old_owner: user.id,
        new_owner: newOwnerUserId,
      },
    });

    // Notify the new owner
    try {
      await serviceClient.from("notifications").insert({
        user_id: newOwnerUserId,
        type: "project_activity",
        title: "Ownership transferred",
        message: `You are now the owner of "${project.name}"`,
        link: `/dashboard/projects/${projectId}/analysis`,
        metadata: { project_id: projectId, action: "ownership_transferred" },
      });
    } catch (notifError) {
      console.error("Failed to notify new owner:", notifError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Transfer ownership error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
