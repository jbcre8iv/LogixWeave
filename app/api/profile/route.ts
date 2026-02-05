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

    const body = await request.json();
    const { full_name, ai_language } = body;

    // Build update object with only provided fields
    const updates: Record<string, string> = {};

    if (full_name !== undefined) {
      if (typeof full_name !== "string" || !full_name.trim()) {
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        );
      }
      updates.full_name = full_name.trim();
    }

    if (ai_language !== undefined) {
      const validLanguages = ["en", "it", "es"];
      if (!validLanguages.includes(ai_language)) {
        return NextResponse.json(
          { error: "Invalid language" },
          { status: 400 }
        );
      }
      updates.ai_language = ai_language;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
