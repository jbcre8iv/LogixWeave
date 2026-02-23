import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    // Authenticate: either CRON_SECRET header or admin session
    const cronSecret = request.headers.get("authorization")?.replace("Bearer ", "");

    if (cronSecret && cronSecret === process.env.CRON_SECRET) {
      // Authenticated via cron secret — proceed
    } else {
      // Fall back to session-based admin auth
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const serviceCheck = createServiceClient();
      const { data: profile } = await serviceCheck
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_platform_admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const serviceSupabase = createServiceClient();

    // Find expired projects (deleted > 30 days ago)
    const { data: expiredProjects } = await serviceSupabase
      .from("projects")
      .select("id")
      .not("deleted_at", "is", null)
      .lt("deleted_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!expiredProjects || expiredProjects.length === 0) {
      return NextResponse.json({ purged: 0 });
    }

    // Clean up storage files for each expired project
    for (const project of expiredProjects) {
      const { data: files } = await serviceSupabase
        .from("project_files")
        .select("storage_path")
        .eq("project_id", project.id);

      if (files && files.length > 0) {
        const paths = files.map((f) => f.storage_path).filter(Boolean) as string[];
        if (paths.length > 0) {
          await serviceSupabase.storage.from("project-files").remove(paths);
        }
      }
    }

    // Hard delete all expired projects
    const { data: purgeResult } = await serviceSupabase.rpc("purge_expired_trash");

    return NextResponse.json({ purged: purgeResult || 0 });
  } catch (error) {
    console.error("Purge trash error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
