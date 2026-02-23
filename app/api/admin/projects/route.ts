import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/monitor";
import { logAdminAction } from "@/lib/audit";
import { getClientIp } from "@/lib/security/get-client-ip";

// Helper: verify the caller is a platform admin, returns { user, serviceSupabase } or a Response
async function verifyAdmin(request: Request) {
  const supabase = await createClient();
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
      description: `Non-admin attempted ${request.method} on admin projects endpoint`,
    });
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
  }

  const serviceSupabase = createServiceClient();
  return { user, serviceSupabase };
}

// PATCH - Admin restore a trashed project
export async function PATCH(request: Request) {
  try {
    const result = await verifyAdmin(request);
    if (result instanceof NextResponse) return result;
    const { user, serviceSupabase } = result;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { action } = await request.json();

    if (action === "restore") {
      const { data: project } = await serviceSupabase
        .from("projects")
        .select("name, deleted_at")
        .eq("id", projectId)
        .single();

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (!project.deleted_at) {
        return NextResponse.json({ error: "Project is not in trash" }, { status: 400 });
      }

      const { error } = await serviceSupabase
        .from("projects")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", projectId);

      if (error) {
        return NextResponse.json({ error: "Failed to restore project" }, { status: 500 });
      }

      logAdminAction({
        adminId: user.id,
        adminEmail: user.email || "",
        action: "project_restored",
        targetId: projectId,
        metadata: { projectName: project.name },
      });

      return NextResponse.json({ success: true, message: "Project restored successfully" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Admin PATCH project error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Permanently delete a project and all its data
export async function DELETE(request: Request) {
  try {
    const result = await verifyAdmin(request);
    if (result instanceof NextResponse) return result;
    const { user, serviceSupabase } = result;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Fetch project name for audit log before deleting
    const { data: project } = await serviceSupabase
      .from("projects")
      .select("name, organization_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Clean up storage files
    const { data: files } = await serviceSupabase
      .from("project_files")
      .select("storage_path")
      .eq("project_id", projectId);

    if (files && files.length > 0) {
      const paths = files.map((f) => f.storage_path).filter(Boolean) as string[];
      if (paths.length > 0) {
        await serviceSupabase.storage.from("project-files").remove(paths);
      }
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
