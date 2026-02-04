import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "File and projectId are required" },
        { status: 400 }
      );
    }

    // Validate file extension
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "l5x" && extension !== "l5k") {
      return NextResponse.json(
        { error: "Only .l5x and .l5k files are supported" },
        { status: 400 }
      );
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

    // Upload to storage
    const storagePath = `${projectId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(storagePath, file);

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Create file record
    const { data: fileRecord, error: dbError } = await supabase
      .from("project_files")
      .insert({
        project_id: projectId,
        file_name: file.name,
        file_type: extension as "l5x" | "l5k",
        file_size: file.size,
        storage_path: storagePath,
        uploaded_by: user.id,
        parsing_status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up storage
      await supabase.storage.from("project-files").remove([storagePath]);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ file: fileRecord });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
