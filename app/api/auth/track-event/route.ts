import { NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/security/monitor";
import { getClientIp } from "@/lib/security/get-client-ip";

const ALLOWED_ACTIONS = ["signup_failed", "login_failed", "password_reset_failed"] as const;
type AuthAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(request: Request) {
  try {
    const { action, email, error } = await request.json();

    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const ip = getClientIp(request);
    // Truncate and sanitize inputs to prevent log injection
    const safeEmail = (email || "unknown").slice(0, 200);
    const safeError = (error || "unknown").slice(0, 500);

    const isRateLimit = safeError.toLowerCase().includes("rate limit");

    logSecurityEvent({
      eventType: isRateLimit ? "rate_limit_exceeded" : "auth_failure",
      severity: isRateLimit ? "medium" : "low",
      ip,
      userEmail: safeEmail,
      description: `${action}: ${safeError}`,
      metadata: { action, email: safeEmail, error: safeError },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
