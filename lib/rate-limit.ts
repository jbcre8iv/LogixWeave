import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function createLimiter(tokens: number, window: string) {
  const redis = createRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    analytics: true,
  });
}

/** 20 requests per 60 seconds — login, signup, password reset */
export const authLimiter = createLimiter(20, "60 s");

/** 60 requests per 60 seconds — general API routes */
export const apiLimiter = createLimiter(60, "60 s");

/** 10 requests per 60 seconds — AI-powered endpoints */
export const aiLimiter = createLimiter(10, "60 s");

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining?: number }> {
  if (!limiter) {
    // Graceful degradation: no Redis configured (local dev)
    return { success: true };
  }
  const result = await limiter.limit(identifier);
  return { success: result.success, remaining: result.remaining };
}
