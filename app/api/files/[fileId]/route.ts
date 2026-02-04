import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

interface RouteContext {
  params: Promise<{ fileId: string }>;
}

// Delete a file
export async function DELETE(request: Request, context: RouteContext) {
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
      .select("id, file_name, storage_path, project_id")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from storage
    if (file.storage_path) {
      await supabase.storage.from("project-files").remove([file.storage_path]);
    }

    // Delete from database (cascades to parsed data)
    const { error: deleteError } = await supabase
      .from("project_files")
      .delete()
      .eq("id", fileId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Log activity
    await logActivity({
      projectId: file.project_id,
      userId: user.id,
      userEmail: user.email,
      action: "file_deleted",
      targetType: "file",
      targetId: fileId,
      targetName: file.file_name,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
