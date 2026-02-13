"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExplanationResult {
  summary: string;
  stepByStep: string[];
  tagsPurpose: Record<string, string>;
  potentialIssues?: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ExplainChatProps {
  projectId: string;
  routineName: string;
  analysisContext: ExplanationResult;
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

export type { ChatMessage };

function generateSuggestions(context: ExplanationResult): string[] {
  const suggestions: string[] = [];

  if (context.potentialIssues?.length) {
    suggestions.push("How can I fix the potential issues?");
  }

  const tagNames = Object.keys(context.tagsPurpose);
  if (tagNames.length > 0) {
    suggestions.push(`What does ${tagNames[0]} do in detail?`);
  }

  suggestions.push("Can you simplify this explanation?");

  return suggestions.slice(0, 3);
}

export function ExplainChat({
  projectId,
  routineName,
  analysisContext,
  onMessagesChange,
}: ExplainChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = generateSuggestions(analysisContext);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/explain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          routineName,
          analysisContext,
          messages: updatedMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Ask Follow-up Questions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ScrollArea className="h-[350px]">
          <div className="space-y-3 pr-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Ask questions about this analysis:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-full border bg-muted hover:bg-muted/80 transition-colors text-left"
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
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words overflow-hidden",
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

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-10 w-10"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
