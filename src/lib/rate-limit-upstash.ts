import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'
  return forwarded.split(',')[0].trim()
}

export const RATE_LIMITS = {
  CONTACT: { requests: 5, window: '1 h' },
  QUOTES: { requests: 10, window: '1 h' },
  ADMIN: { requests: 60, window: '1 m' },
} as const

type RateLimitKey = keyof typeof RATE_LIMITS

function createLimiter(key: RateLimitKey): Ratelimit {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
  const { requests, window } = RATE_LIMITS[key]
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `sapal:ratelimit:${key.toLowerCase()}`,
  })
}

export async function limitByIP(
  ip: string,
  key: RateLimitKey
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    const limiter = createLimiter(key)
    const result = await limiter.limit(ip)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch {
    // Fail-open: if Redis is unavailable, allow the request rather than blocking users
    return { success: true, remaining: -1, reset: 0 }
  }
}
