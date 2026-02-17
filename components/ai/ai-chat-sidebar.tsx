"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "./ai-chat-provider";
import type { ChatMessage } from "./ai-chat-provider";

const MAX_MESSAGES = 20;

const SUGGESTIONS = [
  "What programs and routines does this project have?",
  "Summarize the tag structure",
  "Are there any potential issues?",
];

export function AIChatSidebar() {
  const {
    isOpen,
    messages,
    projectId,
    close,
    setMessages,
    consumePendingQuery,
  } = useAIChat();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSentPending = useRef(false);

  const totalMessages = messages.length;
  const atLimit = totalMessages >= MAX_MESSAGES;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: content.trim(),
      };

      setMessages((prev) => {
        const updated = [...prev, userMessage];
        doSend(updated);
        return updated;
      });
      setInput("");
      setError(null);
      setIsLoading(true);

      async function doSend(updatedMessages: ChatMessage[]) {
        try {
          const response = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              messages: updatedMessages,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to get response");
          }

          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply },
          ]);
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
          setIsLoading(false);
        }
      }
    },
    [isLoading, projectId, setMessages]
  );

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Auto-send pending query when sidebar opens
  useEffect(() => {
    if (isOpen && !hasSentPending.current) {
      const query = consumePendingQuery();
      if (query) {
        hasSentPending.current = true;
        sendMessage(query);
      }
    }
    if (!isOpen) {
      hasSentPending.current = false;
    }
  }, [isOpen, consumePendingQuery, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      className={cn(
        "fixed top-16 right-0 bottom-0 w-[400px] z-40 border-l bg-background flex flex-col transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <h2 className="font-semibold text-sm">Project Chat</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Chat area */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4">
          {messages.length === 0 && !isLoading && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ask anything about your project:
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="text-xs px-3 py-2 rounded-lg border bg-muted hover:bg-muted/80 transition-colors text-left"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words overflow-hidden",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-3 shrink-0">
        {error && (
          <p className="text-xs text-destructive mb-2">{error}</p>
        )}

        {atLimit ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Message limit reached ({MAX_MESSAGES} messages). Start a new
            conversation to continue.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your project..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-10 w-10 bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Inline search bar for the AI page hero section */
export function AIChatSearchBar() {
  const { open } = useAIChat();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    open(query.trim());
    setQuery("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-4 max-w-xl">
      <div className="relative flex-1">
        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your project..."
          className="pl-9 bg-background/60"
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={!query.trim()}
        className="shrink-0 h-10 w-10 bg-amber-500 hover:bg-amber-600 text-white"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}
