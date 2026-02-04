"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  Upload,
  Trash2,
  FileCheck,
  FileX,
  Share2,
  UserPlus,
  UserMinus,
  Download,
  Sparkles,
  Settings,
  FolderPlus,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityEntry {
  id: string;
  project_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ActivityLogProps {
  projectId: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  project_created: <FolderPlus className="h-4 w-4" />,
  project_updated: <Settings className="h-4 w-4" />,
  file_uploaded: <Upload className="h-4 w-4" />,
  file_deleted: <Trash2 className="h-4 w-4" />,
  file_parsed: <FileCheck className="h-4 w-4" />,
  file_parse_failed: <FileX className="h-4 w-4" />,
  project_shared: <Share2 className="h-4 w-4" />,
  share_accepted: <UserPlus className="h-4 w-4" />,
  share_revoked: <UserMinus className="h-4 w-4" />,
  collaborator_removed: <UserMinus className="h-4 w-4" />,
  tag_exported: <Download className="h-4 w-4" />,
  documentation_exported: <Download className="h-4 w-4" />,
  ai_analysis_run: <Sparkles className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  project_created: "bg-green-500/10 text-green-600",
  project_updated: "bg-blue-500/10 text-blue-600",
  file_uploaded: "bg-green-500/10 text-green-600",
  file_deleted: "bg-red-500/10 text-red-600",
  file_parsed: "bg-blue-500/10 text-blue-600",
  file_parse_failed: "bg-red-500/10 text-red-600",
  project_shared: "bg-purple-500/10 text-purple-600",
  share_accepted: "bg-green-500/10 text-green-600",
  share_revoked: "bg-orange-500/10 text-orange-600",
  collaborator_removed: "bg-red-500/10 text-red-600",
  tag_exported: "bg-blue-500/10 text-blue-600",
  documentation_exported: "bg-blue-500/10 text-blue-600",
  ai_analysis_run: "bg-purple-500/10 text-purple-600",
};

function getActionDescription(action: string, targetName?: string | null): string {
  const descriptions: Record<string, string> = {
    project_created: "created the project",
    project_updated: "updated project settings",
    project_deleted: "deleted the project",
    file_uploaded: targetName ? `uploaded "${targetName}"` : "uploaded a file",
    file_deleted: targetName ? `deleted "${targetName}"` : "deleted a file",
    file_parsed: targetName ? `parsed "${targetName}"` : "parsed a file",
    file_parse_failed: targetName ? `failed to parse "${targetName}"` : "failed to parse a file",
    project_shared: targetName ? `shared with ${targetName}` : "shared the project",
    share_accepted: "accepted the share invitation",
    share_revoked: targetName ? `revoked access for ${targetName}` : "revoked access",
    collaborator_removed: targetName ? `removed ${targetName}` : "removed a collaborator",
    tag_exported: "exported tags",
    documentation_exported: targetName ? `exported as ${targetName}` : "exported documentation",
    ai_analysis_run: targetName ? `ran ${targetName}` : "ran AI analysis",
  };

  return descriptions[action] || action.replace(/_/g, " ");
}

export function ActivityLog({ projectId }: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchActivities = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const currentOffset = loadMore ? offset + limit : 0;
      const response = await fetch(
        `/api/projects/${projectId}/activity?limit=${limit}&offset=${currentOffset}`
      );

      if (response.ok) {
        const data = await response.json();
        if (loadMore) {
          setActivities((prev) => [...prev, ...data.activities]);
        } else {
          setActivities(data.activities);
        }
        setTotal(data.total);
        setOffset(currentOffset);
      }
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [projectId]);

  const hasMore = activities.length < total;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Activity Log
          {total > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {total} {total === 1 ? "entry" : "entries"}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity recorded yet
          </p>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        actionColors[activity.action] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {actionIcons[activity.action] || <History className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="leading-tight">
                        <span className="font-medium">
                          {activity.user_email || "System"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {getActionDescription(activity.action, activity.target_name)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activity.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {hasMore && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchActivities(true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Load More
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
