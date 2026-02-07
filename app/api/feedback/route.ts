import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const VALID_TYPES = [
  "Bug Report",
  "Feature Request",
  "Enhancement",
  "Question",
] as const;

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_platform_admin) return null;
  return user;
}

export async function GET(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const serviceSupabase = await createServiceClient();

    if (searchParams.get("unread") === "true") {
      const { count, error } = await serviceSupabase
        .from("feedback")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);

      if (error) {
        console.error("Feedback count error:", error);
        return NextResponse.json({ error: "Failed to fetch count" }, { status: 500 });
      }

      return NextResponse.json({ count: count || 0 });
    }

    const { data, error } = await serviceSupabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Feedback fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
    }

    return NextResponse.json({ feedback: data });
  } catch (error) {
    console.error("Feedback GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { feedbackId, action } = await request.json();
    if (!feedbackId) {
      return NextResponse.json({ error: "feedbackId is required" }, { status: 400 });
    }

    const serviceSupabase = await createServiceClient();

    if (action === "mark_unread") {
      const { error } = await serviceSupabase
        .from("feedback")
        .update({ read_at: null })
        .eq("id", feedbackId);

      if (error) {
        console.error("Feedback update error:", error);
        return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    const { error } = await serviceSupabase
      .from("feedback")
      .update({ read_at: new Date().toISOString() })
      .eq("id", feedbackId);

    if (error) {
      console.error("Feedback update error:", error);
      return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const feedbackId = searchParams.get("id");
    if (!feedbackId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const serviceSupabase = await createServiceClient();
    const { error } = await serviceSupabase
      .from("feedback")
      .delete()
      .eq("id", feedbackId);

    if (error) {
      console.error("Feedback delete error:", error);
      return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

    const body = await request.json();
    const { type, subject, description } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "Invalid feedback type" },
        { status: 400 }
      );
    }

    if (!subject?.trim()) {
      return NextResponse.json(
        { error: "Subject is required" },
        { status: 400 }
      );
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const serviceSupabase = await createServiceClient();

    const { error } = await serviceSupabase.from("feedback").insert({
      user_id: user.id,
      user_email: user.email || "unknown",
      type,
      subject: subject.trim(),
      description: description.trim(),
    });

    if (error) {
      console.error("Feedback insert error:", error);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Failed to send feedback" },
      { status: 500 }
    );
  }
}
