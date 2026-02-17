import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// GET /api/ai/chat/conversations?projectId=xxx — list conversations
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

    const { data: conversations, error } = await supabase
      .from("ai_chat_conversations")
      .select("id, title, created_at, updated_at, ai_chat_messages(count)")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Conversations list error:", error);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    // Flatten the count from Supabase's relational format
    const result = (conversations || []).map((c) => ({
      id: c.id,
      title: c.title,
      created_at: c.created_at,
      updated_at: c.updated_at,
      message_count:
        (c.ai_chat_messages as unknown as { count: number }[])?.[0]?.count ?? 0,
    }));

    return NextResponse.json({ conversations: result });
  } catch (error) {
    console.error("Conversations list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/ai/chat/conversations — create conversation
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Verify project access
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const serviceClient = createServiceClient();

    const { data: conversation, error } = await serviceClient
      .from("ai_chat_conversations")
      .insert({
        project_id: projectId,
        user_id: user.id,
      })
      .select("id, title, created_at, updated_at")
      .single();

    if (error) {
      console.error("Conversation create error:", error);
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      conversation: { ...conversation, message_count: 0 },
    });
  } catch (error) {
    console.error("Conversation create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/chat/conversations?id=xxx — delete conversation
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
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from("ai_chat_conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Conversation delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Conversation delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
