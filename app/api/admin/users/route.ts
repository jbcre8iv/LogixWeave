import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/monitor";
import { logAdminAction } from "@/lib/audit";
import { getClientIp } from "@/lib/security/get-client-ip";

// DELETE - Delete a user and all their data
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // Verify current user is platform admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!adminProfile?.is_platform_admin) {
      logSecurityEvent({
        eventType: "unauthorized_access",
        severity: "high",
        ip: getClientIp(request),
        userId: user.id,
        userEmail: user.email,
        description: "Non-admin attempted DELETE on admin users endpoint",
      });
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Prevent self-deletion
    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Use service client for admin operations
    const serviceSupabase = await createServiceClient();

    // Get user's organization memberships to find their org
    const { data: memberships } = await serviceSupabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId);

    // If user is the sole owner of an org, delete that org too
    for (const membership of memberships || []) {
      if (membership.role === "owner") {
        // Check if there are other owners
        const { data: otherOwners } = await serviceSupabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", membership.organization_id)
          .eq("role", "owner")
          .neq("user_id", userId);

        if (!otherOwners || otherOwners.length === 0) {
          // Delete the organization (cascades to projects, files, etc.)
          await serviceSupabase
            .from("organizations")
            .delete()
            .eq("id", membership.organization_id);
        }
      }
    }

    // Delete organization memberships
    await serviceSupabase
      .from("organization_members")
      .delete()
      .eq("user_id", userId);

    // Delete the profile
    await serviceSupabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    // Delete the auth user
    const { error: authError } = await serviceSupabase.auth.admin.deleteUser(userId, false);

    if (authError) {
      console.error("Error deleting auth user:", authError);
      return NextResponse.json({ error: "Failed to delete user authentication" }, { status: 500 });
    }

    logAdminAction({
      adminId: user.id,
      adminEmail: user.email || "",
      action: "user_deleted",
      targetId: userId,
      metadata: {
        orgsCleaned: (memberships || []).filter(m => m.role === "owner").length,
      },
    });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH - Disable/enable a user
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    // Verify current user is platform admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!adminProfile?.is_platform_admin) {
      logSecurityEvent({
        eventType: "unauthorized_access",
        severity: "high",
        ip: getClientIp(request),
        userId: user.id,
        userEmail: user.email,
        description: "Non-admin attempted PATCH on admin users endpoint",
      });
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { userId, disabled } = await request.json();

    if (!userId || typeof disabled !== "boolean") {
      return NextResponse.json({ error: "userId and disabled status are required" }, { status: 400 });
    }

    // Prevent self-disable
    if (userId === user.id) {
      return NextResponse.json({ error: "Cannot disable your own account" }, { status: 400 });
    }

    // Use service client for admin operations
    const serviceSupabase = await createServiceClient();

    // Update user's banned status in auth
    const { error: authError } = await serviceSupabase.auth.admin.updateUserById(
      userId,
      { ban_duration: disabled ? "876600h" : "none" } // ~100 years or remove ban
    );

    if (authError) {
      console.error("Error updating user status:", authError);
      return NextResponse.json({ error: "Failed to update user status" }, { status: 500 });
    }

    // Also update a disabled flag in profile for reference
    await serviceSupabase
      .from("profiles")
      .update({ is_disabled: disabled })
      .eq("id", userId);

    logAdminAction({
      adminId: user.id,
      adminEmail: user.email || "",
      action: disabled ? "user_disabled" : "user_enabled",
      targetId: userId,
    });

    return NextResponse.json({
      success: true,
      message: disabled ? "User disabled successfully" : "User enabled successfully"
    });
  } catch (error) {
    console.error("Update user status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
