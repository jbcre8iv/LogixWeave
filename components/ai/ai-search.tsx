"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, Search, CheckCircle, Tags, Cpu, Layers, Package } from "lucide-react";
import { AILoading } from "@/components/ai/ai-loading";

interface SearchMatch {
  name: string;
  type: "tag" | "routine" | "rung" | "udt" | "aoi";
  relevance: number;
  description: string;
  location?: string;
}

interface SearchResult {
  matches: SearchMatch[];
  summary: string;
}

interface AISearchProps {
  projectId: string;
}

export function AISearch({ projectId }: AISearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const search = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, query: query.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResult(data.result);
      setCached(data.cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      search();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "tag":
        return <Tags className="h-4 w-4" />;
      case "routine":
        return <Cpu className="h-4 w-4" />;
      case "udt":
        return <Layers className="h-4 w-4" />;
      case "aoi":
        return <Package className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "tag":
        return "secondary";
      case "routine":
        return "default";
      case "udt":
        return "outline";
      case "aoi":
        return "outline";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find tags related to pump control..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
            disabled={isSearching}
          />
        </div>
        <Button onClick={search} disabled={!query.trim() || isSearching}>
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {cached && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Using cached results
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {result.matches.length} Result{result.matches.length === 1 ? "" : "s"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
            </CardContent>
          </Card>

          {result.matches.length > 0 && (
            <div className="space-y-3">
              {result.matches.map((match, idx) => (
                <Card key={idx}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-1">
                        {getTypeIcon(match.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-medium">{match.name}</span>
                          <Badge variant={getTypeBadgeVariant(match.type) as "default" | "secondary" | "outline"}>
                            {match.type}
                          </Badge>
                          {match.location && (
                            <span className="text-xs text-muted-foreground">
                              in {match.location}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {match.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Relevance</span>
                          <Progress value={match.relevance * 100} className="w-20 h-1.5" />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(match.relevance * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.matches.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No matches found for your query. Try different keywords.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isSearching && <AILoading variant="search" />}

      {!result && !isSearching && (
        <div className="text-center py-8 text-muted-foreground">
          <p>Try searches like:</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>"Find all motor-related tags"</li>
            <li>"Show me pump control routines"</li>
            <li>"Variables for temperature monitoring"</li>
            <li>"Alarm-related logic"</li>
          </ul>
        </div>
      )}
    </div>
  );
}
