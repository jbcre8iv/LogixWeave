import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { logSecurityEvent } from "@/lib/security/monitor";
import { getClientIp } from "@/lib/security/get-client-ip";

// Security: Allowed file types and max size
const ALLOWED_EXTENSIONS = ["l5x", "l5k"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;
    const versionComment = formData.get("comment") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "File and projectId are required" },
        { status: 400 }
      );
    }

    // Validate file extension
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: "Only .L5X and .L5K files are supported" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds maximum size of 50MB" },
        { status: 400 }
      );
    }

    // Validate file content based on type
    const headerSlice = file.slice(0, 500);
    const headerBuffer = await headerSlice.arrayBuffer();
    const fileStart = new TextDecoder().decode(headerBuffer);

    if (extension === "l5x") {
      // L5X files should be XML
      if (!fileStart.includes("<?xml") && !fileStart.includes("<RSLogix5000Content")) {
        logSecurityEvent({
          eventType: "invalid_file_upload",
          severity: "medium",
          ip: getClientIp(request),
          userId: user.id,
          userEmail: user.email,
          description: `Invalid L5X file content: ${file.name}`,
          metadata: { fileName: file.name, fileSize: file.size },
        });
        return NextResponse.json(
          { error: "Invalid L5X file format - file must be a valid Studio 5000 export" },
          { status: 400 }
        );
      }
    } else if (extension === "l5k") {
      // L5K files are text-based and should start with IE_VER or CONTROLLER
      const trimmedStart = fileStart.trimStart();
      if (!trimmedStart.startsWith("IE_VER") && !trimmedStart.startsWith("CONTROLLER")) {
        logSecurityEvent({
          eventType: "invalid_file_upload",
          severity: "medium",
          ip: getClientIp(request),
          userId: user.id,
          userEmail: user.email,
          description: `Invalid L5K file content: ${file.name}`,
          metadata: { fileName: file.name, fileSize: file.size },
        });
        return NextResponse.json(
          { error: "Invalid L5K file format - file must be a valid Studio 5000 text export" },
          { status: 400 }
        );
      }
    }

    // Verify user has access to the project
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if a file with the same name already exists in this project
    const { data: existingFile } = await supabase
      .from("project_files")
      .select("id, version_count, current_version")
      .eq("project_id", projectId)
      .eq("file_name", file.name)
      .single();

    // Upload to storage (with version number in path for uniqueness)
    const versionNum = existingFile ? (existingFile.version_count || 1) + 1 : 1;
    const storagePath = `${projectId}/${Date.now()}-v${versionNum}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(storagePath, file);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    let fileRecord;

    if (existingFile) {
      // Create new version for existing file
      const newVersionNumber = (existingFile.version_count || 1) + 1;

      // Insert version record
      const { error: versionError } = await supabase
        .from("file_versions")
        .insert({
          file_id: existingFile.id,
          version_number: newVersionNumber,
          storage_path: storagePath,
          file_size: file.size,
          uploaded_by: user.id,
          uploaded_by_email: user.email,
          comment: versionComment,
        });

      if (versionError) {
        await supabase.storage.from("project-files").remove([storagePath]);
        return NextResponse.json({ error: versionError.message }, { status: 500 });
      }

      // Update the main file record
      const { data: updatedFile, error: updateError } = await supabase
        .from("project_files")
        .update({
          storage_path: storagePath,
          file_size: file.size,
          current_version: newVersionNumber,
          version_count: newVersionNumber,
          parsing_status: "pending",
          parsing_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingFile.id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      fileRecord = updatedFile;

      // Log activity for new version
      await logActivity({
        projectId,
        userId: user.id,
        userEmail: user.email,
        action: "file_uploaded",
        targetType: "file",
        targetId: existingFile.id,
        targetName: file.name,
        metadata: {
          fileSize: file.size,
          fileType: extension,
          version: newVersionNumber,
          isNewVersion: true,
        },
      });
    } else {
      // Create new file record
      const { data: newFile, error: dbError } = await supabase
        .from("project_files")
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_type: extension as "l5x" | "l5k",
          file_size: file.size,
          storage_path: storagePath,
          uploaded_by: user.id,
          parsing_status: "pending",
          current_version: 1,
          version_count: 1,
        })
        .select()
        .single();

      if (dbError) {
        await supabase.storage.from("project-files").remove([storagePath]);
        return NextResponse.json({ error: dbError.message }, { status: 500 });
      }

      // Create initial version record
      await supabase
        .from("file_versions")
        .insert({
          file_id: newFile.id,
          version_number: 1,
          storage_path: storagePath,
          file_size: file.size,
          uploaded_by: user.id,
          uploaded_by_email: user.email,
          comment: versionComment || "Initial upload",
        });

      fileRecord = newFile;

      // Log activity
      await logActivity({
        projectId,
        userId: user.id,
        userEmail: user.email,
        action: "file_uploaded",
        targetType: "file",
        targetId: newFile.id,
        targetName: file.name,
        metadata: { fileSize: file.size, fileType: extension, version: 1 },
      });
    }

    return NextResponse.json({
      file: fileRecord,
      isNewVersion: !!existingFile,
      version: existingFile ? (existingFile.version_count || 1) + 1 : 1,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
