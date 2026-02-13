import { timingSafeEqual } from "crypto";

/**
 * Validates and sanitizes a return URL to prevent open redirects.
 * Returns the sanitized URL or "/dashboard" if invalid.
 */
export function sanitizeReturnUrl(url: string | null): string {
  const fallback = "/dashboard";

  if (!url) return fallback;

  // Must start with a single slash (relative path)
  if (!url.startsWith("/")) return fallback;

  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith("//")) return fallback;

  // Block embedded protocols (javascript:, data:, etc.)
  if (url.includes("://")) return fallback;

  // Block backslash (some browsers normalize \ to /)
  if (url.includes("\\")) return fallback;

  // Block null bytes
  if (url.includes("\0")) return fallback;

  return url;
}

/**
 * Sanitizes user search input to prevent SQL wildcard injection
 * and XSS through database queries.
 */
export function sanitizeSearchInput(input: string): string {
  // Length cap
  const trimmed = input.slice(0, 200);

  // Strip SQL wildcards and backslash (used for LIKE escaping)
  // Strip common XSS characters
  return trimmed.replace(/[%_\\<>"'`;]/g, "");
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;

  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");

    if (bufA.length !== bufB.length) return false;

    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verifies that a request carries a valid CRON_SECRET Bearer token.
 * Used to protect cron endpoints from unauthorized access.
 */
export function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "");
  return constantTimeCompare(token, cronSecret);
}
