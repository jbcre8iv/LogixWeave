"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Bell, Loader2 } from "lucide-react";

interface ActivitySummaryBannerProps {
  projectId: string;
}

interface SummaryResponse {
  summary: string | null;
  activities: Array<{
    id: string;
    action: string;
    user_email: string | null;
    target_name: string | null;
    created_at: string;
  }>;
  since?: string;
}

export function ActivitySummaryBanner({ projectId }: ActivitySummaryBannerProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [activityCount, setActivityCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/activity-summary`);
        if (response.ok) {
          const data: SummaryResponse = await response.json();
          setSummary(data.summary);
          setActivityCount(data.activities?.length || 0);
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
  if (loading || dismissed || !summary) {
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
            <p className="text-sm font-medium mb-1">
              {activityCount} update{activityCount !== 1 ? "s" : ""} since your last visit
            </p>
            <p className="text-sm text-muted-foreground">
              {summary}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
