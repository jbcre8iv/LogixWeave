"use client";

import { useState, useRef, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Send,
  Sparkles,
  X,
  MessageSquare,
  Plus,
  Clock,
  Trash2,
  Wrench,
  ArrowRight,
  PanelLeftOpen,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIChat } from "./ai-chat-provider";
import type { ChatMode, ChatMessage, Conversation } from "./ai-chat-provider";

const MAX_MESSAGES = 20;

/** Renders markdown-style links, bold, and inline code as React elements */
function renderMessageContent(text: string) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(
        <Fragment key={lastIndex}>{text.slice(lastIndex, match.index)}</Fragment>
      );
    }

    if (match[1] && match[2]) {
      // Markdown link: [text](url)
      elements.push(
        <Link
          key={match.index}
          href={match[2]}
          className="inline-flex items-center gap-1 underline font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
        >
          {match[1]}
        </Link>
      );
    } else if (match[3]) {
      // Bold: **text**
      elements.push(<strong key={match.index}>{match[3]}</strong>);
    } else if (match[4]) {
      // Inline code: `text`
      elements.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-background/50 text-xs font-mono">
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(<Fragment key={lastIndex}>{text.slice(lastIndex)}</Fragment>);
  }

  return elements.length > 0 ? elements : text;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const SUGGESTIONS: Record<ChatMode, string[]> = {
  chat: [
    "What programs and routines does this project have?",
    "Summarize the tag structure",
    "Are there any potential issues?",
  ],
  troubleshoot: [
    "A motor won't start — help me trace the logic",
    "An output is stuck ON — what could cause this?",
    "I'm getting a major fault — help me diagnose it",
  ],
};

export function AIChatSidebar() {
  const {
    isOpen,
    messages,
    projectId,
    currentConversationId,
    conversations,
    conversationsLoaded,
    showConversationList,
    chatMode,
    setShowConversationList,
    setChatMode,
    close,
    setMessages,
    consumePendingQuery,
    loadConversations,
    selectConversation,
    startNewConversation,
    deleteConversation,
  } = useAIChat();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSelectingConversation, setIsSelectingConversation] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasSentPending = useRef(false);
  const conversationIdRef = useRef<string | null>(currentConversationId);

  // Keep ref in sync with state
  useEffect(() => {
    conversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  const totalMessages = messages.length;
  const atLimit = totalMessages >= MAX_MESSAGES;

  // Get current conversation title
  const defaultTitle = chatMode === "troubleshoot" ? "Troubleshooting" : "Project Chat";
  const currentTitle = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)?.title || defaultTitle
    : defaultTitle;

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: content.trim(),
      };

      // If no conversation yet, create one first
      let convId = conversationIdRef.current;
      if (!convId) {
        setIsLoading(true);
        convId = await startNewConversation();
        if (!convId) {
          setError("Failed to create conversation");
          setIsLoading(false);
          return;
        }
      }

      setMessages((prev) => {
        const updated = [...prev, userMessage];
        doSend(updated, convId!);
        return updated;
      });
      setInput("");
      setError(null);
      setIsLoading(true);

      async function doSend(updatedMessages: ChatMessage[], conversationId: string) {
        try {
          const endpoint = chatMode === "troubleshoot" ? "/api/ai/troubleshoot" : "/api/ai/chat";
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              messages: updatedMessages,
              conversationId,
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

          // Update conversation in list (title may have changed on first message)
          loadConversations();
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
          setIsLoading(false);
        }
      }
    },
    [isLoading, projectId, chatMode, setMessages, startNewConversation, loadConversations]
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

  // Load conversations lazily on first history toggle
  const handleToggleHistory = useCallback(() => {
    if (!conversationsLoaded) {
      loadConversations();
    }
    setShowConversationList(!showConversationList);
  }, [conversationsLoaded, loadConversations, setShowConversationList, showConversationList]);

  const handleNewConversation = useCallback(async () => {
    await startNewConversation();
  }, [startNewConversation]);

  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (isLoading || isSelectingConversation) return;
      setIsSelectingConversation(true);
      try {
        await selectConversation(id);
      } finally {
        setIsSelectingConversation(false);
      }
    },
    [isLoading, isSelectingConversation, selectConversation]
  );

  const handleDeleteConversation = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await deleteConversation(id);
    },
    [deleteConversation]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      className={cn(
        "fixed top-16 right-0 bottom-0 z-40 border-l bg-background flex flex-col transition-all duration-300 ease-in-out",
        isExpanded ? "w-[800px]" : "w-[400px]",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        {chatMode === "troubleshoot" ? (
          <Wrench className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
        )}
        <span className="font-semibold text-sm truncate flex-1">
          {currentTitle}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleNewConversation}
          title="New conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0",
            showConversationList && "bg-amber-500/10 text-amber-500"
          )}
          onClick={handleToggleHistory}
          title="Conversation history"
        >
          <Clock className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setIsExpanded((prev) => !prev)}
          title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? <PanelRightOpen className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0">
        <button
          onClick={() => setChatMode("chat")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            chatMode === "chat"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Sparkles className="h-3 w-3" />
          Chat
        </button>
        <button
          onClick={() => setChatMode("troubleshoot")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
            chatMode === "troubleshoot"
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <Wrench className="h-3 w-3" />
          Troubleshoot
        </button>
      </div>

      {/* Conversation list view */}
      {showConversationList ? (
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No conversations yet
                </p>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    disabled={isLoading || isSelectingConversation}
                    className={cn(
                      "group w-full text-left rounded-lg px-3 py-2.5 transition-colors",
                      "hover:bg-muted/80",
                      currentConversationId === conv.id
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "border border-transparent",
                      (isLoading || isSelectingConversation) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {conv.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {conv.message_count} message{conv.message_count !== 1 ? "s" : ""}
                          {" \u00B7 "}
                          {formatTime(conv.updated_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive shrink-0"
                        title="Delete conversation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        <>
          {/* Chat area */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full px-4">
              <div className="space-y-3 py-4">
                {messages.length === 0 && !isLoading && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {chatMode === "troubleshoot"
                        ? "Describe a symptom, fault, or unexpected behavior:"
                        : "Ask anything about your project:"}
                    </p>
                    <div className="flex flex-col gap-2">
                      {SUGGESTIONS[chatMode].map((suggestion) => (
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
                      {msg.role === "assistant"
                        ? renderMessageContent(msg.content)
                        : msg.content}
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
          </div>

          {/* Input area */}
          <div className="border-t p-3 shrink-0">
            {error && (
              <p className="text-xs text-destructive mb-2">{error}</p>
            )}

            {atLimit ? (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-2">
                  Message limit reached ({MAX_MESSAGES} messages).
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewConversation}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Start new conversation
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={chatMode === "troubleshoot" ? "Describe the issue you're experiencing..." : "Ask about your project..."}
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
        </>
      )}
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

/** Small header button that opens the chat sidebar in troubleshoot mode */
export function TroubleshootHeaderButton({ className }: { className?: string }) {
  const { openTroubleshoot } = useAIChat();

  return (
    <button
      onClick={openTroubleshoot}
      title="Troubleshoot"
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors",
        className
      )}
    >
      <Wrench className="h-3.5 w-3.5" />
      Troubleshoot
    </button>
  );
}

/** Tool-card style button for the AI hub "More Tools" grid */
export function TroubleshootToolCard() {
  const { openTroubleshoot } = useAIChat();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openTroubleshoot}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTroubleshoot(); } }}
      className="group h-full border-border/60 hover:shadow-lg hover:shadow-amber-500/5 hover:border-amber-500/30 transition-all cursor-pointer bg-card text-card-foreground flex flex-col rounded-xl border py-6 shadow-sm"
    >
      <div className="py-4 px-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 group-hover:bg-amber-500/15 transition-colors shrink-0 mt-0.5">
            <Wrench className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Troubleshoot</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Diagnose issues with guided step-by-step analysis</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-amber-500 transition-colors shrink-0 mt-1" />
        </div>
      </div>
    </div>
  );
}
