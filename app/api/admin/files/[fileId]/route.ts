import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const supabase = await createClient();

    // Verify current user is platform admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    if (!adminProfile?.is_platform_admin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { fileId } = await params;

    // Use service client to bypass RLS
    const serviceSupabase = await createServiceClient();

    // Get file details
    const { data: file, error: fileError } = await serviceSupabase
      .from("project_files")
      .select("id, file_name, storage_path")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Download from storage
    const { data: fileData, error: downloadError } = await serviceSupabase.storage
      .from("project-files")
      .download(file.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
    }

    // Return the file with appropriate headers
    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${file.file_name}"`);
    headers.set("Content-Type", "application/octet-stream");

    return new NextResponse(fileData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Admin download file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
