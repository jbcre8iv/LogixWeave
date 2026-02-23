export type AdminAction =
  | "user_disabled"
  | "user_enabled"
  | "user_deleted"
  | "project_deleted"
  | "project_restored"
  | "ip_unblocked";

interface LogAdminActionParams {
  adminId: string;
  adminEmail: string;
  action: AdminAction;
  targetId?: string;
  targetEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an admin action to the audit log.
 * Fire-and-forget pattern — never throws, never blocks the caller.
 */
export function logAdminAction(params: LogAdminActionParams): void {
  insertAuditEntry(params).catch((err) => {
    console.error("[Audit] Failed to log admin action:", err);
  });
}

async function insertAuditEntry(params: LogAdminActionParams): Promise<void> {
  try {
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();

    await supabase.from("admin_audit_log").insert({
      admin_id: params.adminId,
      admin_email: params.adminEmail,
      action: params.action,
      target_id: params.targetId || null,
      target_email: params.targetEmail || null,
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.error("[Audit] DB insert failed:", err);
  }
}
