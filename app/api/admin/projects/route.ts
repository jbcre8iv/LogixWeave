import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/monitor";
import { logAdminAction } from "@/lib/audit";
import { getClientIp } from "@/lib/security/get-client-ip";

// DELETE - Delete a project and all its data (cascading)
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
        description: "Non-admin attempted DELETE on admin projects endpoint",
      });
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const serviceSupabase = await createServiceClient();

    // Fetch project name for audit log before deleting
    const { data: project } = await serviceSupabase
      .from("projects")
      .select("name, organization_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Delete the project (cascades to files, parsed data, etc.)
    const { error: deleteError } = await serviceSupabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      console.error("Error deleting project:", deleteError);
      return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }

    logAdminAction({
      adminId: user.id,
      adminEmail: user.email || "",
      action: "project_deleted",
      targetId: projectId,
      metadata: {
        projectName: project.name,
        organizationId: project.organization_id,
      },
    });

    return NextResponse.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
