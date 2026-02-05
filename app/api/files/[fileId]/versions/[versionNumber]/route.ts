import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ fileId: string; versionNumber: string }>;
}

// Download a specific version
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { fileId, versionNumber } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get file details
    const { data: file, error: fileError } = await supabase
      .from("project_files")
      .select("id, file_name")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get the specific version
    const { data: version, error: versionError } = await supabase
      .from("file_versions")
      .select("storage_path, version_number")
      .eq("file_id", fileId)
      .eq("version_number", parseInt(versionNumber))
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Download from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(version.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }

    // Get file extension and name without extension
    const nameParts = file.file_name.split(".");
    const extension = nameParts.pop();
    const baseName = nameParts.join(".");
    const versionedFileName = `${baseName}_v${version.version_number}.${extension}`;

    // Return the file with appropriate headers
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${versionedFileName}"`);
    headers.set("Content-Type", "application/octet-stream");

    return new NextResponse(fileData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download version error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
