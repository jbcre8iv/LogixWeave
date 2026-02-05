import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

// Get version history for a file
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { fileId } = await context.params;
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
      .select("id, file_name, current_version, version_count, project_id")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get all versions
    const { data: versions, error: versionsError } = await supabase
      .from("file_versions")
      .select("*")
      .eq("file_id", fileId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      return NextResponse.json({ error: versionsError.message }, { status: 500 });
    }

    return NextResponse.json({
      file: {
        id: file.id,
        file_name: file.file_name,
        current_version: file.current_version,
        version_count: file.version_count,
        project_id: file.project_id,
      },
      versions: versions || [],
    });
  } catch (error) {
    console.error("Get versions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Restore a specific version
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { fileId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { versionNumber } = await request.json();

    if (!versionNumber) {
      return NextResponse.json({ error: "Version number is required" }, { status: 400 });
    }

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from("file_versions")
      .select("*")
      .eq("file_id", fileId)
      .eq("version_number", versionNumber)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Get current file info
    const { data: file, error: fileError } = await supabase
      .from("project_files")
      .select("id, version_count, project_id, file_name")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Create a new version that's a copy of the restored version
    const newVersionNumber = (file.version_count || 1) + 1;

    // Copy the file in storage to a new path
    const newStoragePath = `${file.project_id}/${Date.now()}-v${newVersionNumber}-${file.file_name}`;

    // Download the old version
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("project-files")
      .download(version.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
    }

    // Upload as new version
    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(newStoragePath, fileData);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Create new version record
    const { error: insertError } = await supabase
      .from("file_versions")
      .insert({
        file_id: fileId,
        version_number: newVersionNumber,
        storage_path: newStoragePath,
        file_size: version.file_size,
        uploaded_by: user.id,
        uploaded_by_email: user.email,
        comment: `Restored from version ${versionNumber}`,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update the main file record
    const { data: updatedFile, error: updateError } = await supabase
      .from("project_files")
      .update({
        storage_path: newStoragePath,
        file_size: version.file_size,
        current_version: newVersionNumber,
        version_count: newVersionNumber,
        parsing_status: "pending",
        parsing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      file: updatedFile,
      restoredFrom: versionNumber,
      newVersion: newVersionNumber,
    });
  } catch (error) {
    console.error("Restore version error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
