import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Upload,
  Share2,
  UserPlus,
  Trash2,
  Settings,
  FileText,
  FolderPlus,
  ArrowRight,
} from "lucide-react";

interface ActivityItem {
  id: string;
  project_id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  target_name: string | null;
  created_at: string;
  projects: {
    name: string;
  } | null;
  displayName?: string;
}

// Get icon for activity type
function getActivityIcon(action: string) {
  switch (action) {
    case "file_uploaded":
      return <Upload className="h-4 w-4 text-blue-500" />;
    case "file_parsed":
      return <FileText className="h-4 w-4 text-green-500" />;
    case "project_shared":
      return <Share2 className="h-4 w-4 text-purple-500" />;
    case "share_accepted":
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case "file_deleted":
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case "project_updated":
      return <Settings className="h-4 w-4 text-orange-500" />;
    case "project_created":
      return <FolderPlus className="h-4 w-4 text-blue-500" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

// Format activity description
function formatActivityDescription(activity: ActivityItem): string {
  const userName = activity.displayName || activity.user_email?.split("@")[0] || "Someone";

  switch (activity.action) {
    case "file_uploaded":
      return `${userName} uploaded ${activity.target_name || "a file"}`;
    case "file_parsed":
      return `${userName} parsed ${activity.target_name || "a file"}`;
    case "project_shared":
      return `${userName} shared with ${activity.target_name || "someone"}`;
    case "share_accepted":
      return `${userName} joined the project`;
    case "file_deleted":
      return `${userName} deleted ${activity.target_name || "a file"}`;
    case "project_updated":
      return `${userName} updated settings`;
    case "project_created":
      return `${userName} created the project`;
    default:
      return `${userName} ${activity.action.replace(/_/g, " ")}`;
  }
}

// Format relative time
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

const PAGE_SIZE = 25;

export async function RecentActivity({ page = 1 }: { page?: number }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Get all project IDs the user has access to (owned + shared)
  const { data: ownedProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("created_by", user.id);

  const { data: sharedProjects } = await supabase
    .from("project_shares")
    .select("project_id")
    .or(`shared_with_user_id.eq.${user.id},shared_with_email.eq.${user.email}`)
    .not("accepted_at", "is", null);

  const projectIds = [
    ...(ownedProjects?.map(p => p.id) || []),
    ...(sharedProjects?.map(s => s.project_id) || []),
  ];

  if (projectIds.length === 0) {
    return null;
  }

  // Get recent activity across all accessible projects
  const offset = (page - 1) * PAGE_SIZE;
  const { data: rawActivities, count: totalCount } = await supabase
    .from("project_activity_log")
    .select(`
      id,
      project_id,
      user_id,
      user_email,
      action,
      target_name,
      created_at,
      projects:project_id(name)
    `, { count: "exact" })
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (!rawActivities || (rawActivities.length === 0 && page === 1)) {
    return null;
  }

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  // Look up display names for unique user IDs
  const userIds = [...new Set(rawActivities.map(a => a.user_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name")
      .in("id", userIds);

    if (profiles) {
      for (const p of profiles) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name;
        if (name) profileMap.set(p.id, name);
      }
    }
  }

  // Attach display names to activities
  const activities = rawActivities.map(a => ({
    ...a,
    displayName: a.user_id ? profileMap.get(a.user_id) : undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Recent Activity</CardTitle>
        </div>
        <CardDescription>Latest updates across all your projects</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(activities || []).map((activity) => {
            const typedActivity = activity as unknown as ActivityItem;
            const projectName = typedActivity.projects?.name || "Unknown Project";

            return (
              <div key={typedActivity.id} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {getActivityIcon(typedActivity.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    {formatActivityDescription(typedActivity)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Link
                      href={`/dashboard/projects/${typedActivity.project_id}`}
                      className="text-xs text-primary hover:underline truncate"
                    >
                      {projectName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(typedActivity.created_at)}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link href={`/dashboard/projects/${typedActivity.project_id}`}>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard?page=${page - 1}`}>Previous</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>Previous</Button>
              )}
              {page < totalPages ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard?page=${page + 1}`}>Next</Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>Next</Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
