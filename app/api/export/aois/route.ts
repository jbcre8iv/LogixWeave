import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeCSV(value: string | null | undefined | boolean): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
    const vendor = searchParams.get("vendor");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // Get project info for filename
    const { data: project } = await supabase
      .from("projects")
      .select("name, project_files(id)")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const fileIds = project.project_files?.map((f: { id: string }) => f.id) || [];

    if (fileIds.length === 0) {
      return NextResponse.json({ error: "No files in project" }, { status: 400 });
    }

    // Build query for AOIs with parameters
    let query = supabase
      .from("parsed_aois")
      .select(`
        id, name, description, revision, vendor, created_by, edited_by,
        parsed_aoi_parameters(name, data_type, usage, required, visible, description)
      `)
      .in("file_id", fileIds);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (vendor && vendor !== "all") {
      query = query.eq("vendor", vendor);
    }

    query = query.order("name");

    const { data: aois, error } = await query;

    if (error) throw error;

    // Generate CSV
    const headers = [
      "AOI Name",
      "Revision",
      "Vendor",
      "Description",
      "Created By",
      "Edited By",
      "Parameter Name",
      "Parameter Type",
      "Parameter Usage",
      "Required",
      "Visible",
      "Parameter Description",
    ];
    const rows: string[][] = [];

    for (const aoi of aois || []) {
      const params = aoi.parsed_aoi_parameters || [];
      if (params.length === 0) {
        rows.push([
          escapeCSV(aoi.name),
          escapeCSV(aoi.revision),
          escapeCSV(aoi.vendor),
          escapeCSV(aoi.description),
          escapeCSV(aoi.created_by),
          escapeCSV(aoi.edited_by),
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
      } else {
        for (const param of params) {
          rows.push([
            escapeCSV(aoi.name),
            escapeCSV(aoi.revision),
            escapeCSV(aoi.vendor),
            escapeCSV(aoi.description),
            escapeCSV(aoi.created_by),
            escapeCSV(aoi.edited_by),
            escapeCSV(param.name),
            escapeCSV(param.data_type),
            escapeCSV(param.usage),
            escapeCSV(param.required),
            escapeCSV(param.visible),
            escapeCSV(param.description),
          ]);
        }
      }
    }

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const date = new Date().toISOString().split("T")[0];
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_AOIs_${date}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("AOI export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
