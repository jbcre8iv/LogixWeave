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
    const scope = searchParams.get("scope");
    const dataType = searchParams.get("dataType");
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
        unusedTags: [],
        totalCount: 0,
        page,
        pageSize,
      });
    }

    // Get all tags
    const { data: allTags } = await supabase
      .from("parsed_tags")
      .select("id, name, data_type, scope, description")
      .in("file_id", fileIds);

    // Get all referenced tag names
    const { data: references } = await supabase
      .from("tag_references")
      .select("tag_name")
      .in("file_id", fileIds);

    const referencedTagNames = new Set(references?.map((r) => r.tag_name) || []);

    // Find unused tags (not in references)
    let unusedTags = (allTags || []).filter((tag) => {
      // Check if tag name or any base part of the tag is referenced
      const tagParts = tag.name.split(".");
      for (let i = 1; i <= tagParts.length; i++) {
        const partialName = tagParts.slice(0, i).join(".");
        if (referencedTagNames.has(partialName)) {
          return false;
        }
      }
      // Also check array base names
      const baseName = tag.name.split("[")[0];
      if (referencedTagNames.has(baseName)) {
        return false;
      }
      return !referencedTagNames.has(tag.name);
    });

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      unusedTags = unusedTags.filter((tag) =>
        tag.name.toLowerCase().includes(searchLower)
      );
    }

    if (scope && scope !== "all") {
      unusedTags = unusedTags.filter((tag) => tag.scope === scope);
    }

    if (dataType && dataType !== "all") {
      unusedTags = unusedTags.filter((tag) => tag.data_type === dataType);
    }

    // Sort by name
    unusedTags.sort((a, b) => a.name.localeCompare(b.name));

    // Get total count before pagination
    const totalCount = unusedTags.length;

    // Apply pagination
    const from = (page - 1) * pageSize;
    const paginatedTags = unusedTags.slice(from, from + pageSize);

    return NextResponse.json({
      unusedTags: paginatedTags,
      totalCount,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Unused tags API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
