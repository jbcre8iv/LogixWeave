import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
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
    const familyType = searchParams.get("familyType");

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

    // Build query for UDTs with members
    let query = supabase
      .from("parsed_udts")
      .select("id, name, description, family_type, parsed_udt_members(name, data_type, dimension, description)")
      .in("file_id", fileIds);

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    if (familyType && familyType !== "all") {
      query = query.eq("family_type", familyType);
    }

    query = query.order("name");

    const { data: udts, error } = await query;

    if (error) throw error;

    // Generate CSV
    const headers = ["UDT Name", "Family", "Description", "Member Name", "Member Type", "Dimension", "Member Description"];
    const rows: string[][] = [];

    for (const udt of udts || []) {
      const members = udt.parsed_udt_members || [];
      if (members.length === 0) {
        rows.push([
          escapeCSV(udt.name),
          escapeCSV(udt.family_type),
          escapeCSV(udt.description),
          "",
          "",
          "",
          "",
        ]);
      } else {
        for (const member of members) {
          rows.push([
            escapeCSV(udt.name),
            escapeCSV(udt.family_type),
            escapeCSV(udt.description),
            escapeCSV(member.name),
            escapeCSV(member.data_type),
            escapeCSV(member.dimension),
            escapeCSV(member.description),
          ]);
        }
      }
    }

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const date = new Date().toISOString().split("T")[0];
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, "_")}_UDTs_${date}.csv`;

    await logActivity({
      projectId,
      userId: user.id,
      userEmail: user.email,
      action: "tag_exported",
      targetType: "export",
      targetName: "UDTs",
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("UDT export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
