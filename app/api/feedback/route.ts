import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const userEmail = user.email || "unknown";

    await resend.emails.send({
      from: "LogixWeave <noreply@jbcre8iv.com>",
      to: "support@jbcre8iv.com",
      replyTo: userEmail,
      subject: `[${type}] ${subject.trim()}`,
      html: `
        <h2>${type}</h2>
        <p><strong>From:</strong> ${userEmail}</p>
        <p><strong>User ID:</strong> ${user.id}</p>
        <p><strong>Subject:</strong> ${subject.trim()}</p>
        <hr />
        <p>${description.trim().replace(/\n/g, "<br />")}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Failed to send feedback" },
      { status: 500 }
    );
  }
}
