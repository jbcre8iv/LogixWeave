import { blockIp } from "./ip-blocklist";

export type SecurityEventType =
  | "auth_failure"
  | "rate_limit_exceeded"
  | "open_redirect_attempt"
  | "invalid_file_upload"
  | "unauthorized_access"
  | "suspicious_input"
  | "brute_force_detected";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

interface SecurityEventParams {
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string;
  userId?: string;
  userEmail?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs a security event. Synchronously blocks the IP for high/critical severity,
 * then asynchronously inserts into the database. Never throws.
 */
export function logSecurityEvent(params: SecurityEventParams): void {
  const { eventType, severity, ip, description } = params;

  // Synchronous IP block for high/critical BEFORE async DB insert
  if (ip && (severity === "high" || severity === "critical")) {
    blockIp(ip, severity, `${eventType}: ${description}`);
  }

  // Fire-and-forget async DB insert
  insertSecurityEvent(params).catch((err) => {
    console.error("[Security Monitor] Failed to insert event:", err);
  });
}

async function insertSecurityEvent(params: SecurityEventParams): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies and keep this module lightweight
    const { createServiceClient } = await import("@/lib/supabase/server");
    const supabase = createServiceClient();

    await supabase.from("security_events").insert({
      event_type: params.eventType,
      severity: params.severity,
      ip_address: params.ip || null,
      user_id: params.userId || null,
      user_email: params.userEmail || null,
      description: params.description,
      metadata: params.metadata || {},
    });
  } catch (err) {
    // Never throw — security logging should not break the calling operation
    console.error("[Security Monitor] DB insert failed:", err);
  }
}
