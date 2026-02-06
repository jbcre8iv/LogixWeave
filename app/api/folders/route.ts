import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List folders for a project
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

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const { data: folders, error } = await supabase
      .from("project_folders")
      .select("*")
      .eq("project_id", projectId)
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Get folders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create a new folder
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, name } = await request.json();

    if (!projectId || !name) {
      return NextResponse.json(
        { error: "projectId and name are required" },
        { status: 400 }
      );
    }

    // Validate folder name
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Folder name must be 1-100 characters" },
        { status: 400 }
      );
    }

    // Check for invalid characters
    if (/[<>:"/\\|?*]/.test(trimmedName)) {
      return NextResponse.json(
        { error: "Folder name contains invalid characters" },
        { status: 400 }
      );
    }

    const { data: folder, error } = await supabase
      .from("project_folders")
      .insert({
        project_id: projectId,
        name: trimmedName,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A folder with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Create folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Rename a folder
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId, name } = await request.json();

    if (!folderId || !name) {
      return NextResponse.json(
        { error: "folderId and name are required" },
        { status: 400 }
      );
    }

    // Validate folder name
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      return NextResponse.json(
        { error: "Folder name must be 1-100 characters" },
        { status: 400 }
      );
    }

    if (/[<>:"/\\|?*]/.test(trimmedName)) {
      return NextResponse.json(
        { error: "Folder name contains invalid characters" },
        { status: 400 }
      );
    }

    const { data: folder, error } = await supabase
      .from("project_folders")
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq("id", folderId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A folder with this name already exists" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Rename folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a folder (files move to root)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json(
        { error: "folderId is required" },
        { status: 400 }
      );
    }

    // Files will automatically have folder_id set to NULL due to ON DELETE SET NULL
    const { error } = await supabase
      .from("project_folders")
      .delete()
      .eq("id", folderId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
