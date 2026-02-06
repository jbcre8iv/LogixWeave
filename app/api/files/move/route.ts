import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Move file(s) to a folder or to root
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileIds, folderId } = await request.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json(
        { error: "fileIds array is required" },
        { status: 400 }
      );
    }

    // folderId can be null (move to root) or a valid folder ID
    const { error } = await supabase
      .from("project_files")
      .update({
        folder_id: folderId || null,
        updated_at: new Date().toISOString()
      })
      .in("id", fileIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      movedCount: fileIds.length,
      folderId: folderId || null
    });
  } catch (error) {
    console.error("Move files error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
