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
    const program = searchParams.get("program");
    const type = searchParams.get("type");

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
      .select("id, file_name")
      .eq("project_id", projectId);

    const fileIds = (files || []).map((f: { id: string }) => f.id);
    const fileMap = new Map(
      (files || []).map((f: { id: string; file_name: string }) => [f.id, f.file_name])
    );

    if (fileIds.length === 0) {
      return new NextResponse("No routines found", { status: 404 });
    }

    // Build query for all matching routines
    let query = supabase
      .from("parsed_routines")
      .select("name, program_name, type, description, rung_count, file_id")
      .in("file_id", fileIds);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (program) {
      query = query.eq("program_name", program);
    }

    if (type) {
      query = query.eq("type", type);
    }

    query = query.order("program_name").order("name");

    const { data: routines, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!routines || routines.length === 0) {
      return new NextResponse("No routines found", { status: 404 });
    }

    // Generate CSV
    const headers = [
      "Name",
      "Program",
      "Type",
      "Description",
      "Rung Count",
      "File",
    ];

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = routines.map((routine) =>
      [
        routine.name,
        routine.program_name,
        routine.type,
        routine.description,
        routine.rung_count,
        fileMap.get(routine.file_id) || "",
      ]
        .map(escapeCSV)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");

    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_routines_${new Date().toISOString().split("T")[0]}.csv`;

    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "tag_exported",
      targetType: "export",
      targetName: "routines",
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
