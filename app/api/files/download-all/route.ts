import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project ID from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 });
    }

    // Get project details for the zip filename
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all files for the project
    const { data: files, error: filesError } = await supabase
      .from("project_files")
      .select("id, file_name, storage_path")
      .eq("project_id", projectId);

    if (filesError) {
      return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files to download" }, { status: 404 });
    }

    // Create a new zip file
    const zip = new JSZip();

    // Download each file and add to zip
    for (const file of files) {
      if (!file.storage_path) continue;

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("project-files")
        .download(file.storage_path);

      if (downloadError || !fileData) {
        console.error(`Failed to download file ${file.file_name}:`, downloadError);
        continue;
      }

      // Add file to zip
      const arrayBuffer = await fileData.arrayBuffer();
      zip.file(file.file_name, arrayBuffer);
    }

    // Generate the zip file
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Sanitize project name for filename
    const safeProjectName = project.name.replace(/[^a-zA-Z0-9-_]/g, "_");

    // Return the zip file with appropriate headers
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${safeProjectName}_files.zip"`);
    headers.set("Content-Type", "application/zip");

    return new NextResponse(zipBlob, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Download all files error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
