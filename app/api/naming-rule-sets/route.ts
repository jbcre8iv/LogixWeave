import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 404 });
    }

    const { data: ruleSets, error } = await supabase
      .from("naming_rule_sets")
      .select("*, naming_rules(*)")
      .eq("organization_id", membership.organization_id)
      .order("is_default", { ascending: false })
      .order("name");

    if (error) throw error;

    return NextResponse.json({ ruleSets: ruleSets || [] });
  } catch (error) {
    console.error("Get naming rule sets error:", error);
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
    const { name, description, is_default } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // If setting as default, unset the old default first
    if (is_default) {
      await supabase
        .from("naming_rule_sets")
        .update({ is_default: false })
        .eq("organization_id", membership.organization_id)
        .eq("is_default", true);
    }

    const { data: ruleSet, error } = await supabase
      .from("naming_rule_sets")
      .insert({
        organization_id: membership.organization_id,
        name,
        description: description || null,
        is_default: is_default || false,
        created_by: user.id,
      })
      .select("*, naming_rules(*)")
      .single();

    if (error) throw error;

    return NextResponse.json({ ruleSet });
  } catch (error) {
    console.error("Create naming rule set error:", error);
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
    const { id, name, description, is_default } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    // If setting as default, unset old default first
    if (is_default) {
      // Get the org for this rule set
      const { data: ruleSet } = await supabase
        .from("naming_rule_sets")
        .select("organization_id")
        .eq("id", id)
        .single();

      if (ruleSet) {
        await supabase
          .from("naming_rule_sets")
          .update({ is_default: false })
          .eq("organization_id", ruleSet.organization_id)
          .eq("is_default", true);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (is_default !== undefined) updateData.is_default = is_default;

    const { data: ruleSet, error } = await supabase
      .from("naming_rule_sets")
      .update(updateData)
      .eq("id", id)
      .select("*, naming_rules(*)")
      .single();

    if (error) throw error;

    return NextResponse.json({ ruleSet });
  } catch (error) {
    console.error("Update naming rule set error:", error);
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

    // Check if this is the default set — refuse deletion
    const { data: ruleSet } = await supabase
      .from("naming_rule_sets")
      .select("is_default")
      .eq("id", id)
      .single();

    if (!ruleSet) {
      return NextResponse.json({ error: "Rule set not found" }, { status: 404 });
    }

    if (ruleSet.is_default) {
      return NextResponse.json(
        { error: "Cannot delete the default rule set. Set another as default first." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("naming_rule_sets")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete naming rule set error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
