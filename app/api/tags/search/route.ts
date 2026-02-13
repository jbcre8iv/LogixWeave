import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchInput } from "@/lib/security/sanitize";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const search = searchParams.get("search");
    const scope = searchParams.get("scope");
    const dataType = searchParams.get("dataType");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project exists
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get project files
    const { data: files } = await supabase
      .from("project_files")
      .select("id")
      .eq("project_id", projectId);

    const fileIds = (files || []).map((f: { id: string }) => f.id);

    if (fileIds.length === 0) {
      return NextResponse.json({ tags: [], totalCount: 0 });
    }

    // Build query
    let query = supabase
      .from("parsed_tags")
      .select("*", { count: "exact" })
      .in("file_id", fileIds);

    if (search) {
      const sanitized = sanitizeSearchInput(search);
      if (sanitized) {
        query = query.ilike("name", `%${sanitized}%`);
      }
    }

    if (scope) {
      query = query.eq("scope", scope);
    }

    if (dataType) {
      query = query.eq("data_type", dataType);
    }

    // Add pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("name").range(from, to);

    const { data: tags, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      tags,
      totalCount: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Tag search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
