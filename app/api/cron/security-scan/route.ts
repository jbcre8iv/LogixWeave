import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/security/sanitize";
import { createServiceClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security/monitor";

const BRUTE_FORCE_THRESHOLD = 10;
const RATE_ABUSE_THRESHOLD = 20;
const REDIRECT_PROBE_THRESHOLD = 3;
const RETENTION_DAYS = 90;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const threats: string[] = [];

    // Fetch events from the last hour
    const { data: events } = await supabase
      .from("security_events")
      .select("event_type, ip_address, severity")
      .gte("created_at", oneHourAgo);

    if (events && events.length > 0) {
      // Group by IP and event type
      const ipEventCounts = new Map<string, Map<string, number>>();
      for (const event of events) {
        const ip = event.ip_address || "unknown";
        if (!ipEventCounts.has(ip)) {
          ipEventCounts.set(ip, new Map());
        }
        const counts = ipEventCounts.get(ip)!;
        counts.set(event.event_type, (counts.get(event.event_type) || 0) + 1);
      }

      // Detect brute force: 10+ auth_failure from single IP
      for (const [ip, counts] of ipEventCounts) {
        const authFailures = counts.get("auth_failure") || 0;
        if (authFailures >= BRUTE_FORCE_THRESHOLD) {
          threats.push(`Brute force: ${authFailures} auth failures from ${ip}`);
          logSecurityEvent({
            eventType: "brute_force_detected",
            severity: "critical",
            ip,
            description: `${authFailures} auth failures in the last hour`,
          });
        }

        // Rate abuse: 20+ rate_limit_exceeded from single IP
        const rateLimits = counts.get("rate_limit_exceeded") || 0;
        if (rateLimits >= RATE_ABUSE_THRESHOLD) {
          threats.push(`Rate abuse: ${rateLimits} rate limit hits from ${ip}`);
          logSecurityEvent({
            eventType: "brute_force_detected",
            severity: "high",
            ip,
            description: `${rateLimits} rate limit hits in the last hour`,
          });
        }

        // Redirect probing: 3+ open_redirect_attempt from single IP
        const redirectAttempts = counts.get("open_redirect_attempt") || 0;
        if (redirectAttempts >= REDIRECT_PROBE_THRESHOLD) {
          threats.push(`Redirect probe: ${redirectAttempts} attempts from ${ip}`);
          logSecurityEvent({
            eventType: "suspicious_input",
            severity: "high",
            ip,
            description: `${redirectAttempts} open redirect attempts in the last hour`,
          });
        }
      }
    }

    // Send email alert if threats detected
    if (threats.length > 0) {
      await sendAlertEmail(threats);
    }

    // Data retention: delete events older than 90 days
    const retentionCutoff = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    await supabase
      .from("security_events")
      .delete()
      .lt("created_at", retentionCutoff);

    return NextResponse.json({
      scanned: events?.length || 0,
      threats: threats.length,
      details: threats,
    });
  } catch (error) {
    console.error("Security scan error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function sendAlertEmail(threats: string[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.SECURITY_ALERT_EMAIL;

  if (!apiKey || !alertEmail) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LogixWeave Security <security@logixweave.com>",
        to: alertEmail,
        subject: `[LogixWeave] Security Alert: ${threats.length} threat(s) detected`,
        text: [
          "Security threats detected in the last hour:",
          "",
          ...threats.map((t) => `  - ${t}`),
          "",
          `Timestamp: ${new Date().toISOString()}`,
          "Review the security dashboard for details.",
        ].join("\n"),
      }),
    });
  } catch (err) {
    console.error("Failed to send security alert email:", err);
  }
}
