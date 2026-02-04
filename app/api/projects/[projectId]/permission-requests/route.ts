import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

// Get permission requests for a project (for owners) or user's own request
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

    // Check if user is owner
    const { data: project } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    const isOwner = project?.created_by === user.id;

    if (isOwner) {
      // Get all pending requests for the project
      const { data: requests, error } = await supabase
        .from("permission_requests")
        .select("*")
        .eq("project_id", projectId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Fetch requester profiles separately
      const requestsWithProfiles = await Promise.all(
        (requests || []).map(async (req) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", req.requester_id)
            .single();

          return {
            ...req,
            requester: profile || { full_name: null, email: "Unknown" },
          };
        })
      );

      return NextResponse.json({ requests: requestsWithProfiles, isOwner: true });
    } else {
      // Get user's own request for this project
      const { data: request, error } = await supabase
        .from("permission_requests")
        .select("*")
        .eq("project_id", projectId)
        .eq("requester_id", user.id)
        .eq("status", "pending")
        .single();

      if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ request: request || null, isOwner: false });
    }
  } catch (error) {
    console.error("Get permission requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Create a permission request
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

    const { requestedPermission, message } = await request.json();

    if (!requestedPermission || !["edit", "owner"].includes(requestedPermission)) {
      return NextResponse.json({ error: "Invalid permission requested" }, { status: 400 });
    }

    // Get user's current permission
    const { data: share } = await supabase
      .from("project_shares")
      .select("permission")
      .eq("project_id", projectId)
      .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
      .single();

    if (!share) {
      return NextResponse.json({ error: "You don't have access to this project" }, { status: 403 });
    }

    // Can't request same or lower permission
    const permissionOrder = { view: 1, edit: 2, owner: 3 };
    if (permissionOrder[requestedPermission as keyof typeof permissionOrder] <= permissionOrder[share.permission as keyof typeof permissionOrder]) {
      return NextResponse.json({ error: "You already have this permission level or higher" }, { status: 400 });
    }

    // Create the request
    const { data: newRequest, error } = await supabase
      .from("permission_requests")
      .insert({
        project_id: projectId,
        requester_id: user.id,
        current_permission: share.permission,
        requested_permission: requestedPermission,
        message: message || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "You already have a pending request for this project" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(newRequest);
  } catch (error) {
    console.error("Create permission request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Update a permission request (approve/reject)
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

    // Verify user is owner
    const { data: project } = await supabase
      .from("projects")
      .select("created_by")
      .eq("id", projectId)
      .single();

    if (!project || project.created_by !== user.id) {
      return NextResponse.json({ error: "Only the project owner can review requests" }, { status: 403 });
    }

    const { requestId, status } = await request.json();

    if (!requestId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { data: updatedRequest, error } = await supabase
      .from("permission_requests")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Update permission request error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
