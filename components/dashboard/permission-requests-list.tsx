"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Crown, Pencil, Clock } from "lucide-react";

interface PermissionRequest {
  id: string;
  current_permission: string;
  requested_permission: string;
  message: string | null;
  created_at: string;
  requester: {
    full_name: string | null;
    email: string;
  };
}

interface PermissionRequestsListProps {
  projectId: string;
}

export function PermissionRequestsList({ projectId }: PermissionRequestsListProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<PermissionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [projectId]);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/permission-requests`);
      if (response.ok) {
        const data = await response.json();
        if (data.isOwner) {
          setRequests(data.requests || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (requestId: string, status: "approved" | "rejected") => {
    setProcessingId(requestId);
    try {
      const response = await fetch(`/api/projects/${projectId}/permission-requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status }),
      });

      if (response.ok) {
        setRequests(requests.filter((r) => r.id !== requestId));
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to review request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (dateString: string) => {
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
  };

  if (isLoading) {
    return null;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/50 dark:bg-yellow-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-600" />
          Pending Permission Requests
        </CardTitle>
        <CardDescription>
          {requests.length} request{requests.length !== 1 && "s"} awaiting your review
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">
                {request.requester.full_name || request.requester.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {request.current_permission === "view" ? "Viewer" : request.current_permission === "edit" ? "Editor" : "Owner"}
                </Badge>
                <span className="text-xs text-muted-foreground">→</span>
                <Badge variant="secondary" className="text-xs">
                  {request.requested_permission === "owner" ? (
                    <><Crown className="h-3 w-3 mr-1" />Owner</>
                  ) : (
                    <><Pencil className="h-3 w-3 mr-1" />Editor</>
                  )}
                </Badge>
              </div>
              {request.message && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  "{request.message}"
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(request.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={() => handleReview(request.id, "approved")}
                disabled={processingId === request.id}
              >
                {processingId === request.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                onClick={() => handleReview(request.id, "rejected")}
                disabled={processingId === request.id}
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
