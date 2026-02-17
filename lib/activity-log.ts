import { createServiceClient } from "@/lib/supabase/server";

export type ActivityAction =
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "file_uploaded"
  | "file_deleted"
  | "file_parsed"
  | "file_parse_failed"
  | "project_shared"
  | "share_accepted"
  | "share_revoked"
  | "permission_changed"
  | "collaborator_removed"
  | "tag_exported"
  | "documentation_exported"
  | "ai_analysis_run";

export type TargetType = "project" | "file" | "share" | "export" | "analysis";

interface LogActivityParams {
  projectId: string;
  userId?: string;
  userEmail?: string;
  action: ActivityAction;
  targetType?: TargetType;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity({
  projectId,
  userId,
  userEmail,
  action,
  targetType,
  targetId,
  targetName,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    const supabase = createServiceClient();

    // If we have a userId but no email, try to fetch the email
    let email = userEmail;
    if (userId && !email) {
      const { data: userData } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      email = userData?.email || undefined;
    }

    await supabase.from("project_activity_log").insert({
      project_id: projectId,
      user_id: userId,
      user_email: email,
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      metadata: metadata || {},
    });
  } catch (error) {
    // Don't throw - activity logging should never break the main operation
    console.error("Failed to log activity:", error);
  }
}

// Helper to get human-readable action descriptions
export function getActionDescription(action: ActivityAction, targetName?: string): string {
  const descriptions: Record<ActivityAction, string> = {
    project_created: "created the project",
    project_updated: "updated project settings",
    project_deleted: "deleted the project",
    file_uploaded: targetName ? `uploaded file "${targetName}"` : "uploaded a file",
    file_deleted: targetName ? `deleted file "${targetName}"` : "deleted a file",
    file_parsed: targetName ? `parsed file "${targetName}"` : "parsed a file",
    file_parse_failed: targetName ? `failed to parse file "${targetName}"` : "failed to parse a file",
    project_shared: targetName ? `shared project with ${targetName}` : "shared the project",
    share_accepted: "accepted the project share invitation",
    share_revoked: targetName ? `revoked share access for ${targetName}` : "revoked share access",
    permission_changed: targetName ? `changed permissions for ${targetName}` : "changed a collaborator's permissions",
    collaborator_removed: targetName ? `removed collaborator ${targetName}` : "removed a collaborator",
    tag_exported: "exported tags",
    documentation_exported: targetName ? `exported documentation as ${targetName}` : "exported documentation",
    ai_analysis_run: targetName ? `ran AI analysis: ${targetName}` : "ran AI analysis",
  };

  return descriptions[action] || action;
}
