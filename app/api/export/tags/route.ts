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

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Get project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name")
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
      return new NextResponse("No tags found", { status: 404 });
    }

    // Build query for all matching tags
    let query = supabase
      .from("parsed_tags")
      .select("name, data_type, scope, description, usage, radix, alias_for, external_access, dimensions")
      .in("file_id", fileIds);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (scope) {
      query = query.eq("scope", scope);
    }

    if (dataType) {
      query = query.eq("data_type", dataType);
    }

    query = query.order("name");

    const { data: tags, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!tags || tags.length === 0) {
      return new NextResponse("No tags found", { status: 404 });
    }

    // Generate CSV
    const headers = [
      "Name",
      "Data Type",
      "Scope",
      "Description",
      "Usage",
      "Radix",
      "Alias For",
      "External Access",
      "Dimensions",
    ];

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = tags.map((tag) =>
      [
        tag.name,
        tag.data_type,
        tag.scope,
        tag.description,
        tag.usage,
        tag.radix,
        tag.alias_for,
        tag.external_access,
        tag.dimensions,
      ]
        .map(escapeCSV)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");

    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_tags_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
