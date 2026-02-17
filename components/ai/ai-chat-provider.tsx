"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface AIChatContextValue {
  isOpen: boolean;
  messages: ChatMessage[];
  pendingQuery: string | null;
  projectId: string;
  currentConversationId: string | null;
  conversations: Conversation[];
  conversationsLoaded: boolean;
  showConversationList: boolean;
  setShowConversationList: (show: boolean) => void;
  open: (query?: string) => void;
  close: () => void;
  toggle: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  consumePendingQuery: () => string | null;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => Promise<string | null>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
}

const AIChatContext = createContext<AIChatContextValue | null>(null);

export function useAIChat() {
  const ctx = useContext(AIChatContext);
  if (!ctx) {
    throw new Error("useAIChat must be used within an AIChatProvider");
  }
  return ctx;
}

export function AIChatProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const pendingQueryRef = useRef<string | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/chat/conversations?projectId=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations || []);
      setConversationsLoaded(true);
    } catch {
      // silently fail
    }
  }, [projectId]);

  const selectConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/chat/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCurrentConversationId(id);
      setMessages(
        (data.messages || []).map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
      setShowConversationList(false);
    } catch {
      // silently fail
    }
  }, []);

  const startNewConversation = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/ai/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const conv = data.conversation;
      setCurrentConversationId(conv.id);
      setMessages([]);
      setShowConversationList(false);
      setConversations((prev) => [conv, ...prev]);
      return conv.id;
    } catch {
      return null;
    }
  }, [projectId]);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ai/chat/conversations?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch {
      // silently fail
    }
  }, [currentConversationId]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/ai/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, title: data.conversation.title } : c
        )
      );
    } catch {
      // silently fail
    }
  }, []);

  const open = useCallback((query?: string) => {
    if (query) {
      pendingQueryRef.current = query;
      setPendingQuery(query);
      // Pending query from another page always starts a new conversation
      setCurrentConversationId(null);
      setMessages([]);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setShowConversationList(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const consumePendingQuery = useCallback(() => {
    const q = pendingQueryRef.current;
    pendingQueryRef.current = null;
    setPendingQuery(null);
    return q;
  }, []);

  return (
    <AIChatContext.Provider
      value={{
        isOpen,
        messages,
        pendingQuery,
        projectId,
        currentConversationId,
        conversations,
        conversationsLoaded,
        showConversationList,
        setShowConversationList,
        open,
        close,
        toggle,
        setMessages,
        consumePendingQuery,
        loadConversations,
        selectConversation,
        startNewConversation,
        deleteConversation,
        renameConversation,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
}

export type { ChatMessage, Conversation };
