import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/ai/chat/conversations/[conversationId] — fetch messages + metadata
export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;

    // Fetch conversation (RLS ensures ownership)
    const { data: conversation, error: convError } = await supabase
      .from("ai_chat_conversations")
      .select("id, title, project_id, created_at, updated_at")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Messages fetch error:", msgError);
      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation,
      messages: messages || [],
    });
  } catch (error) {
    console.error("Conversation fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/ai/chat/conversations/[conversationId] — rename conversation
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await params;
    const { title } = await request.json();

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    const { data: conversation, error } = await serviceClient
      .from("ai_chat_conversations")
      .update({ title: title.slice(0, 100) })
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .select("id, title, updated_at")
      .single();

    if (error) {
      console.error("Conversation rename error:", error);
      return NextResponse.json(
        { error: "Failed to rename conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("Conversation rename error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
