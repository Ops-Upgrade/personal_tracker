import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const WINDOW = "15 m" as const;

const redis = Redis.fromEnv();

/**
 * IP-based limiter: 20 requests per 15-minute sliding window.
 * Applied to both recovery-data and reset-password routes.
 */
export const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, WINDOW),
  analytics: true,
  prefix: "ratelimit:ip",
});

/**
 * Email-based limiter: 5 requests per 15-minute sliding window.
 * Applied per-route (separate prefix) to recovery-data and reset-password.
 * Always use `email.toLowerCase()` as the identifier.
 */
export function emailLimiter(prefix: string) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, WINDOW),
    analytics: true,
    prefix: `ratelimit:email:${prefix}`,
  });
}
