import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids, action, value } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No project IDs provided" }, { status: 400 });
    }

    if (action === "favorite") {
      const { error } = await supabase
        .from("projects")
        .update({ is_favorite: value })
        .in("id", ids);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: ids.length });
    }

    if (action === "archive") {
      // Only the project owner can archive/unarchive
      const { error } = await supabase
        .from("projects")
        .update({ is_archived: value })
        .in("id", ids)
        .eq("created_by", user.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, updated: ids.length });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Bulk update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No project IDs provided" }, { status: 400 });
    }

    // Only the project owner can delete
    const { error } = await supabase
      .from("projects")
      .delete()
      .in("id", ids)
      .eq("created_by", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
