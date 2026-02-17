"use client";

import { MessageSquare } from "lucide-react";
import { useAIChat } from "./ai-chat-provider";

export function AIChatButton() {
  const { isOpen, toggle } = useAIChat();

  if (isOpen) return null;

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
      aria-label="Open project chat"
    >
      <MessageSquare className="h-5 w-5" />
    </button>
  );
}
