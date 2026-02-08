"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const variantMessages: Record<string, string[]> = {
  explain: [
    "Analyzing ladder logic…",
    "Tracing tag references…",
    "Mapping rung structure…",
    "Preparing explanation…",
  ],
  issues: [
    "Scanning project structure…",
    "Checking for common issues…",
    "Analyzing tag usage patterns…",
    "Compiling findings…",
  ],
  search: [
    "Searching project data…",
    "Matching tags and routines…",
    "Ranking relevance…",
    "Preparing results…",
  ],
};

interface AILoadingProps {
  variant: "explain" | "issues" | "search";
}

export function AILoading({ variant }: AILoadingProps) {
  const messages = variantMessages[variant];
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-5">
          {/* Sparkle icon with glow */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ai-glow" />
            <Sparkles className="h-8 w-8 text-primary animate-ai-glow relative" />
          </div>

          {/* Cycling status text */}
          <p className="text-sm font-medium text-muted-foreground transition-opacity duration-300">
            {messages[messageIndex]}
          </p>

          {/* Skeleton shimmer bars */}
          <div className="w-full max-w-md space-y-3 mt-2">
            <div className="h-3 rounded-full bg-muted animate-ai-shimmer" style={{ width: "92%" }} />
            <div className="h-3 rounded-full bg-muted animate-ai-shimmer" style={{ width: "78%", animationDelay: "0.15s" }} />
            <div className="h-3 rounded-full bg-muted animate-ai-shimmer" style={{ width: "85%", animationDelay: "0.3s" }} />
            <div className="h-3 rounded-full bg-muted animate-ai-shimmer" style={{ width: "60%", animationDelay: "0.45s" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
