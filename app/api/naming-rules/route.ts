import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    // Get naming rules for the organization
    const { data: rules, error } = await supabase
      .from("naming_rules")
      .select("*")
      .eq("organization_id", membership.organization_id)
      .order("name");

    if (error) throw error;

    return NextResponse.json({ rules: rules || [] });
  } catch (error) {
    console.error("Get naming rules error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and role
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, pattern, applies_to, severity, is_active } = body;

    if (!name || !pattern || !applies_to) {
      return NextResponse.json(
        { error: "name, pattern, and applies_to are required" },
        { status: 400 }
      );
    }

    // Validate the pattern is a valid regex
    try {
      new RegExp(pattern);
    } catch {
      return NextResponse.json(
        { error: "Invalid regex pattern" },
        { status: 400 }
      );
    }

    const { data: rule, error } = await supabase
      .from("naming_rules")
      .insert({
        organization_id: membership.organization_id,
        name,
        description,
        pattern,
        applies_to,
        severity: severity || "warning",
        is_active: is_active !== false,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Create naming rule error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, pattern, applies_to, severity, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // Validate the pattern if provided
    if (pattern) {
      try {
        new RegExp(pattern);
      } catch {
        return NextResponse.json(
          { error: "Invalid regex pattern" },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (pattern !== undefined) updateData.pattern = pattern;
    if (applies_to !== undefined) updateData.applies_to = applies_to;
    if (severity !== undefined) updateData.severity = severity;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: rule, error } = await supabase
      .from("naming_rules")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Update naming rule error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("naming_rules")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete naming rule error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
