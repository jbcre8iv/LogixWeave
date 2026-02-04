import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const usageType = searchParams.get("usageType");
    const program = searchParams.get("program");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "50", 10));

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get file IDs for this project
    const { data: files } = await supabase
      .from("project_files")
      .select("id")
      .eq("project_id", projectId);

    const fileIds = files?.map((f) => f.id) || [];

    if (fileIds.length === 0) {
      return NextResponse.json({
        references: [],
        totalCount: 0,
        page,
        pageSize,
      });
    }

    // Build query
    let query = supabase
      .from("tag_references")
      .select("*", { count: "exact" })
      .in("file_id", fileIds);

    if (search) {
      query = query.ilike("tag_name", `%${search}%`);
    }

    if (usageType && usageType !== "all") {
      query = query.eq("usage_type", usageType);
    }

    if (program && program !== "all") {
      query = query.eq("program_name", program);
    }

    // Add pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("tag_name").order("program_name").order("routine_name").range(from, to);

    const { data: references, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      references: references || [],
      totalCount: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Tag cross-reference API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
