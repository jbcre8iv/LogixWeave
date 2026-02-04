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
    const catalogNumber = searchParams.get("catalogNumber");
    const parentModule = searchParams.get("parentModule");

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
      return new NextResponse("No I/O modules found", { status: 404 });
    }

    // Build query for all matching modules
    let query = supabase
      .from("parsed_io_modules")
      .select("name, catalog_number, parent_module, slot, connection_info, file_id")
      .in("file_id", fileIds);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (catalogNumber) {
      query = query.eq("catalog_number", catalogNumber);
    }

    if (parentModule) {
      query = query.eq("parent_module", parentModule);
    }

    query = query.order("name");

    const { data: modules, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!modules || modules.length === 0) {
      return new NextResponse("No I/O modules found", { status: 404 });
    }

    // Generate CSV
    const headers = [
      "Name",
      "Catalog Number",
      "Parent Module",
      "Slot",
      "File",
      "Connection Info",
    ];

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = modules.map((module) =>
      [
        module.name,
        module.catalog_number,
        module.parent_module,
        module.slot,
        fileMap.get(module.file_id) || "",
        module.connection_info ? JSON.stringify(module.connection_info) : "",
      ]
        .map(escapeCSV)
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");

    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_io_modules_${new Date().toISOString().split("T")[0]}.csv`;

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
