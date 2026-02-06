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
    const { full_name, first_name, last_name, ai_language } = body;

    // Build update object with only provided fields
    const updates: Record<string, string | null> = {};

    // Handle first_name and last_name
    if (first_name !== undefined || last_name !== undefined) {
      const firstName = first_name?.trim() || "";
      const lastName = last_name?.trim() || "";

      if (!firstName && !lastName) {
        return NextResponse.json(
          { error: "At least first name or last name is required" },
          { status: 400 }
        );
      }

      updates.first_name = firstName || null;
      updates.last_name = lastName || null;
      // Also update full_name for backward compatibility
      updates.full_name = [firstName, lastName].filter(Boolean).join(" ");
    }

    // Handle legacy full_name update (for backward compatibility)
    if (full_name !== undefined && first_name === undefined && last_name === undefined) {
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
