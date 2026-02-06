import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET - Fetch detailed user information
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
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
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { userId } = await params;

    // Use service client to bypass RLS
    const serviceSupabase = await createServiceClient();

    // Fetch user profile
    const { data: profile, error: profileError } = await serviceSupabase
      .from("profiles")
      .select("id, email, full_name, created_at, is_platform_admin, is_disabled")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch user's organizations with their role
    const { data: memberships } = await serviceSupabase
      .from("organization_members")
      .select("role, organizations(id, name)")
      .eq("user_id", userId);

    const organizations = (memberships || []).map((m) => {
      const org = m.organizations as unknown as { id: string; name: string };
      return {
        id: org.id,
        name: org.name,
        role: m.role,
      };
    });

    // Get org IDs user belongs to
    const orgIds = organizations.map(o => o.id);

    // Fetch projects from user's organizations
    const { data: projects } = orgIds.length > 0
      ? await serviceSupabase
          .from("projects")
          .select("id, name, organization_id, created_at, organizations(name)")
          .in("organization_id", orgIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    // Fetch all file counts for projects
    const projectIds = (projects || []).map(p => p.id);
    const { data: fileCounts } = projectIds.length > 0
      ? await serviceSupabase
          .from("project_files")
          .select("project_id")
          .in("project_id", projectIds)
      : { data: [] };

    // Count files per project
    const fileCountMap: Record<string, number> = {};
    (fileCounts || []).forEach(f => {
      fileCountMap[f.project_id] = (fileCountMap[f.project_id] || 0) + 1;
    });

    const projectsWithCounts = (projects || []).map(p => {
      const org = p.organizations as unknown as { name: string } | null;
      return {
        id: p.id,
        name: p.name,
        organization_name: org?.name || "Unknown",
        created_at: p.created_at,
        file_count: fileCountMap[p.id] || 0,
      };
    });

    // Fetch user's files
    const { data: files } = projectIds.length > 0
      ? await serviceSupabase
          .from("project_files")
          .select("id, file_name, file_size, created_at, project_id, projects(name)")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };

    const filesWithProjects = (files || []).map(f => {
      const project = f.projects as unknown as { name: string } | null;
      return {
        id: f.id,
        file_name: f.file_name,
        file_size: f.file_size || 0,
        project_name: project?.name || "Unknown",
        created_at: f.created_at,
      };
    });

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      created_at: profile.created_at,
      is_platform_admin: profile.is_platform_admin || false,
      is_disabled: profile.is_disabled || false,
      organizations,
      projects: projectsWithCounts,
      files: filesWithProjects,
    });
  } catch (error) {
    console.error("Fetch user details error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
