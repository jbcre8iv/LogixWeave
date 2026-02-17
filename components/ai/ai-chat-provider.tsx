"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIChatContextValue {
  isOpen: boolean;
  messages: ChatMessage[];
  pendingQuery: string | null;
  projectId: string;
  open: (query?: string) => void;
  close: () => void;
  toggle: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearMessages: () => void;
  consumePendingQuery: () => string | null;
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
  const pendingQueryRef = useRef<string | null>(null);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  const open = useCallback((query?: string) => {
    if (query) {
      pendingQueryRef.current = query;
      setPendingQuery(query);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
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
        open,
        close,
        toggle,
        setMessages,
        clearMessages,
        consumePendingQuery,
      }}
    >
      {children}
    </AIChatContext.Provider>
  );
}

export type { ChatMessage };
