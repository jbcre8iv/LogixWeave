interface TurnstileResult {
  success: boolean;
  error?: string;
}

/**
 * Verifies a Cloudflare Turnstile token server-side.
 * - Fails open if TURNSTILE_SECRET_KEY is not configured (dev/testing).
 * - Rejects if configured but no token is provided.
 */
export async function verifyTurnstileToken(
  token: string | null,
  ip?: string
): Promise<TurnstileResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Not configured — fail open for dev/testing
  if (!secretKey) {
    return { success: true };
  }

  // Configured but no token provided — reject
  if (!token) {
    return { success: false, error: "Turnstile token is required" };
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };
    if (ip) {
      body.remoteip = ip;
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
      }
    );

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    return {
      success: false,
      error: `Turnstile verification failed: ${(data["error-codes"] || []).join(", ")}`,
    };
  } catch (err) {
    console.error("Turnstile verification error:", err);
    // Network error — fail open to avoid blocking legitimate users
    return { success: true };
  }
}
