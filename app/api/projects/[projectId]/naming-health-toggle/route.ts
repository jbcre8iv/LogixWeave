import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

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

    // Verify user can access this project (RLS enforces ownership/sharing)
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const { enabled } = await request.json();

    // Use service client for the update to bypass RLS
    const serviceSupabase = createServiceClient();
    const { error } = await serviceSupabase
      .from("projects")
      .update({ naming_affects_health_score: !!enabled })
      .eq("id", projectId);

    if (error) throw error;

    return NextResponse.json({ enabled: !!enabled });
  } catch (error) {
    console.error("Toggle naming health score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
