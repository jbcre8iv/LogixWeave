/**
 * In-memory sliding-window rate limiter for auth endpoints.
 * Runs ALONGSIDE Upstash Redis rate limiting — this is an additional layer.
 *
 * IP limit: 10 attempts per 15 minutes
 * Email limit: 5 attempts per 15 minutes
 *
 * Key pattern: timestamps are recorded ONLY after both IP and email checks pass.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;

const ipAttempts = new Map<string, number[]>();
const emailAttempts = new Map<string, number[]>();

function pruneAndCount(
  map: Map<string, number[]>,
  key: string,
  now: number
): number {
  const timestamps = map.get(key);
  if (!timestamps) return 0;

  const cutoff = now - WINDOW_MS;
  const valid = timestamps.filter((t) => t > cutoff);

  if (valid.length === 0) {
    map.delete(key);
    return 0;
  }

  map.set(key, valid);
  return valid.length;
}

interface AuthRateLimitResult {
  allowed: boolean;
  reason?: "ip_limit" | "email_limit";
}

/**
 * Check whether an auth attempt should be allowed.
 * Only records the attempt if both checks pass.
 */
export function checkAuthRateLimit(
  ip: string,
  email?: string
): AuthRateLimitResult {
  const now = Date.now();

  // Check IP
  const ipCount = pruneAndCount(ipAttempts, ip, now);
  if (ipCount >= IP_LIMIT) {
    return { allowed: false, reason: "ip_limit" };
  }

  // Check email (if provided)
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const emailCount = pruneAndCount(emailAttempts, normalizedEmail, now);
    if (emailCount >= EMAIL_LIMIT) {
      return { allowed: false, reason: "email_limit" };
    }
  }

  // Both passed — record the attempt
  const ipTs = ipAttempts.get(ip) || [];
  ipTs.push(now);
  ipAttempts.set(ip, ipTs);

  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    const emailTs = emailAttempts.get(normalizedEmail) || [];
    emailTs.push(now);
    emailAttempts.set(normalizedEmail, emailTs);
  }

  return { allowed: true };
}

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    for (const [key, timestamps] of ipAttempts) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        ipAttempts.delete(key);
      } else {
        ipAttempts.set(key, valid);
      }
    }
    for (const [key, timestamps] of emailAttempts) {
      const valid = timestamps.filter((t) => t > cutoff);
      if (valid.length === 0) {
        emailAttempts.delete(key);
      } else {
        emailAttempts.set(key, valid);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}
