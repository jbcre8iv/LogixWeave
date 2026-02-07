import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const VALID_TYPES = [
  "Bug Report",
  "Feature Request",
  "Enhancement",
  "Question",
] as const;

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
