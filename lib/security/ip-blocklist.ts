interface BlockEntry {
  expiresAt: number;
  reason: string;
}

const blocklist = new Map<string, BlockEntry>();

const DURATIONS: Record<string, number> = {
  high: 30 * 60 * 1000,     // 30 minutes
  critical: 60 * 60 * 1000, // 60 minutes
};

/**
 * Block an IP address for a duration based on severity.
 */
export function blockIp(
  ip: string,
  severity: "high" | "critical",
  reason: string
): void {
  const duration = DURATIONS[severity] || DURATIONS.high;
  blocklist.set(ip, {
    expiresAt: Date.now() + duration,
    reason,
  });
}

/**
 * Check if an IP is currently blocked. Lazily removes expired entries.
 */
export function isIpBlocked(ip: string): boolean {
  const entry = blocklist.get(ip);
  if (!entry) return false;

  if (Date.now() >= entry.expiresAt) {
    blocklist.delete(ip);
    return false;
  }

  return true;
}

/**
 * Manually unblock an IP (for admin dashboard).
 */
export function unblockIp(ip: string): boolean {
  return blocklist.delete(ip);
}

/**
 * List all currently blocked IPs (for admin dashboard).
 */
export function getBlockedIps(): Array<{
  ip: string;
  expiresAt: number;
  reason: string;
}> {
  const now = Date.now();
  const results: Array<{ ip: string; expiresAt: number; reason: string }> = [];

  for (const [ip, entry] of blocklist) {
    if (now >= entry.expiresAt) {
      blocklist.delete(ip);
    } else {
      results.push({ ip, expiresAt: entry.expiresAt, reason: entry.reason });
    }
  }

  return results;
}

// Periodic cleanup every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of blocklist) {
      if (now >= entry.expiresAt) {
        blocklist.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}
