import { createClient } from "@/lib/supabase/server";
import { sanitizeReturnUrl } from "@/lib/security/sanitize";
import { logSecurityEvent } from "@/lib/security/monitor";
import { getClientIp } from "@/lib/security/get-client-ip";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = sanitizeReturnUrl(rawNext);

  // Log if the redirect was sanitized (possible open redirect attempt)
  if (rawNext && rawNext !== next) {
    logSecurityEvent({
      eventType: "open_redirect_attempt",
      severity: "high",
      ip: getClientIp(request),
      description: `Blocked open redirect attempt: ${rawNext.slice(0, 200)}`,
      metadata: { raw_next: rawNext.slice(0, 500) },
    });
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
