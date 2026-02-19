import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

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

    const type = searchParams.get("type"); // "references" or null (definitions)

    // Get project files
    const { data: files } = await supabase
      .from("project_files")
      .select("id")
      .eq("project_id", projectId);

    const fileIds = (files || []).map((f: { id: string }) => f.id);

    if (fileIds.length === 0) {
      return new NextResponse("No tags found", { status: 404 });
    }

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv: string;
    let fileSuffix: string;

    if (type === "references") {
      // Export referenced tags from tag_references table
      let refQuery = supabase
        .from("tag_references")
        .select("tag_name, usage_type, routine_name, program_name, rung_number")
        .in("file_id", fileIds);

      if (search) {
        refQuery = refQuery.ilike("tag_name", `%${search}%`);
      }

      refQuery = refQuery.order("tag_name").order("program_name").order("routine_name");

      const { data: refs, error } = await refQuery;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!refs || refs.length === 0) {
        return new NextResponse("No referenced tags found", { status: 404 });
      }

      const headers = ["Tag Name", "Program", "Routine", "Rung", "Usage Type"];
      const rows = refs.map((ref) =>
        [ref.tag_name, ref.program_name, ref.routine_name, String(ref.rung_number), ref.usage_type]
          .map(escapeCSV)
          .join(",")
      );

      csv = [headers.join(","), ...rows].join("\n");
      fileSuffix = "referenced_tags";
    } else {
      // Export tag definitions from parsed_tags table
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

      csv = [headers.join(","), ...rows].join("\n");
      fileSuffix = "tags";
    }

    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_${fileSuffix}_${new Date().toISOString().split("T")[0]}.csv`;

    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "tag_exported",
      targetType: "export",
      targetName: fileSuffix,
    });

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
