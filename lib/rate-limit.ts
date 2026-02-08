import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let authLimiterInstance: Ratelimit | null | undefined;
let apiLimiterInstance: Ratelimit | null | undefined;
let aiLimiterInstance: Ratelimit | null | undefined;

function createLimiter(tokens: number, window: "60 s") {
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null;
    }
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(tokens, window),
      analytics: true,
    });
  } catch {
    return null;
  }
}

/** 20 requests per 60 seconds — login, signup, password reset */
export function getAuthLimiter() {
  if (authLimiterInstance === undefined) {
    authLimiterInstance = createLimiter(20, "60 s");
  }
  return authLimiterInstance;
}

/** 60 requests per 60 seconds — general API routes */
export function getApiLimiter() {
  if (apiLimiterInstance === undefined) {
    apiLimiterInstance = createLimiter(60, "60 s");
  }
  return apiLimiterInstance;
}

/** 10 requests per 60 seconds — AI-powered endpoints */
export function getAiLimiter() {
  if (aiLimiterInstance === undefined) {
    aiLimiterInstance = createLimiter(10, "60 s");
  }
  return aiLimiterInstance;
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining?: number }> {
  if (!limiter) {
    return { success: true };
  }
  try {
    const result = await limiter.limit(identifier);
    return { success: result.success, remaining: result.remaining };
  } catch {
    return { success: true };
  }
}
