"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Bell, ChevronDown, ChevronUp, Upload, Share2, UserPlus, FileText, Trash2, Settings } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivitySummaryBannerProps {
  projectId: string;
}

interface Activity {
  id: string;
  action: string;
  user_email: string | null;
  target_name: string | null;
  created_at: string;
}

interface SummaryResponse {
  summary: string | null;
  activities: Activity[];
  since?: string;
}

// Get icon for activity type
function getActivityIcon(action: string) {
  switch (action) {
    case "file_uploaded":
    case "file_parsed":
      return Upload;
    case "shared":
      return Share2;
    case "share_accepted":
      return UserPlus;
    case "file_deleted":
      return Trash2;
    case "project_updated":
      return Settings;
    default:
      return FileText;
  }
}

// Format activity description with user name
function formatActivityDescription(activity: Activity): string {
  const userName = activity.user_email?.split("@")[0] || "Someone";

  switch (activity.action) {
    case "file_uploaded":
      return `${userName} uploaded ${activity.target_name || "a file"}`;
    case "file_parsed":
      return `${userName} parsed ${activity.target_name || "a file"}`;
    case "shared":
      return `${userName} shared the project with ${activity.target_name || "a team member"}`;
    case "share_accepted":
      return `${userName} accepted the share invitation`;
    case "file_deleted":
      return `${userName} deleted ${activity.target_name || "a file"}`;
    case "project_updated":
      return `${userName} updated project settings`;
    case "permission_changed":
      return `${userName} changed permissions for ${activity.target_name || "a member"}`;
    default:
      return `${userName} ${activity.action.replace(/_/g, " ")}`;
  }
}

// LocalStorage key for tracking dismissed banners
const DISMISSED_KEY = "activity-banner-dismissed";

// Get dismissed state from localStorage
function getDismissedFromStorage(projectId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return false;
    const dismissed: Record<string, number> = JSON.parse(stored);
    const dismissedAt = dismissed[projectId];
    if (!dismissedAt) return false;
    // Consider dismissed for 24 hours
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < twentyFourHours;
  } catch {
    return false;
  }
}

// Save dismissed state to localStorage
function saveDismissedToStorage(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    const dismissed: Record<string, number> = stored ? JSON.parse(stored) : {};
    dismissed[projectId] = Date.now();
    // Clean up old entries (older than 7 days)
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    for (const key of Object.keys(dismissed)) {
      if (Date.now() - dismissed[key] > sevenDays) {
        delete dismissed[key];
      }
    }
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  } catch {
    // Ignore localStorage errors
  }
}

export function ActivitySummaryBanner({ projectId }: ActivitySummaryBannerProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (getDismissedFromStorage(projectId)) {
      setDismissed(true);
    }
  }, [projectId]);

  // Handle dismiss - update both localStorage and server
  const handleDismiss = async () => {
    setDismissed(true);
    saveDismissedToStorage(projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}/activity-summary`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json();
        console.error("Failed to dismiss activity banner:", data.error);
      }
    } catch (error) {
      console.error("Failed to dismiss activity banner:", error);
    }
  };

  useEffect(() => {
    // Skip fetch if already dismissed via localStorage
    if (getDismissedFromStorage(projectId)) {
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/activity-summary`);
        if (response.ok) {
          const data: SummaryResponse = await response.json();
          setSummary(data.summary);
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error("Failed to fetch activity summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [projectId]);

  // Don't show if loading, dismissed, or no summary
  if (loading || dismissed || !summary || activities.length === 0) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
      <CardContent className="py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
            <Bell className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium">
                {activities.length} update{activities.length !== 1 ? "s" : ""} since your last visit
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    View details
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {summary}
            </p>

            {/* Expanded activity list */}
            {expanded && (
              <div className="mt-4 space-y-2 border-t pt-3">
                {activities.map((activity) => {
                  const Icon = getActivityIcon(activity.action);
                  return (
                    <div key={activity.id} className="flex items-start gap-2 text-sm">
                      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground">
                          {formatActivityDescription(activity)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
