"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, X, Loader2, Eye, Pencil, Crown } from "lucide-react";

interface Invite {
  id: string;
  permission: "view" | "edit" | "owner";
  created_at: string;
  project: {
    id: string;
    name: string;
  } | null;
  inviter: {
    full_name: string | null;
    email: string;
  } | null;
}

export function PendingInvites() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      const response = await fetch("/api/invites");
      if (response.ok) {
        const data = await response.json();
        setInvites(data);
      }
    } catch (error) {
      console.error("Failed to fetch invites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (shareId: string, action: "accept" | "decline") => {
    setProcessingId(shareId);
    try {
      const response = await fetch("/api/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId, action }),
      });

      if (response.ok) {
        setInvites(invites.filter((i) => i.id !== shareId));
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to handle invite:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays < 1) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case "owner":
        return <Crown className="h-3 w-3" />;
      case "edit":
        return <Pencil className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case "owner":
        return "Owner";
      case "edit":
        return "Editor";
      default:
        return "Viewer";
    }
  };

  if (isLoading) {
    return null;
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-600" />
          Pending Invitations
        </CardTitle>
        <CardDescription>
          {invites.length} project{invites.length !== 1 && "s"} awaiting your response
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">
                {invite.project?.name || "Unknown Project"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                From {invite.inviter?.full_name || invite.inviter?.email || "Unknown"}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  {getPermissionIcon(invite.permission)}
                  {getPermissionLabel(invite.permission)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTime(invite.created_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="default"
                className="h-8 px-3"
                onClick={() => handleInvite(invite.id, "accept")}
                disabled={processingId === invite.id}
              >
                {processingId === invite.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                onClick={() => handleInvite(invite.id, "decline")}
                disabled={processingId === invite.id}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
