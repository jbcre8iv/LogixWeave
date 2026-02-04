"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail, Check, X, Loader2 } from "lucide-react";

interface ProjectInvitePromptProps {
  projectId: string;
  projectName: string;
  shareId: string;
}

export function ProjectInvitePrompt({ projectId, projectName, shareId }: ProjectInvitePromptProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<"accept" | "decline" | null>(null);

  const handleInvite = async (action: "accept" | "decline") => {
    setIsLoading(action);
    try {
      const response = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, action }),
      });

      if (response.ok) {
        if (action === "accept") {
          // Refresh the page to show project content
          router.refresh();
        } else {
          // Redirect to dashboard
          router.push("/dashboard");
        }
      }
    } catch (error) {
      console.error("Failed to handle invite:", error);
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 mt-1">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-bold break-words">{projectName}</h1>
        </div>
      </div>

      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>You've been invited</CardTitle>
          <CardDescription>
            You have a pending invitation to access this project
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Accept the invitation to view this project's files, tags, and routines.
          </p>
          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => handleInvite("decline")}
              disabled={isLoading !== null}
            >
              {isLoading === "decline" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Decline
            </Button>
            <Button
              onClick={() => handleInvite("accept")}
              disabled={isLoading !== null}
            >
              {isLoading === "accept" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Accept Invitation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
