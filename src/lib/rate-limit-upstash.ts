import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()

  return 'unknown'
}

export const RATE_LIMITS = {
  CONTACT: { requests: 5, window: '1 h' },
  QUOTES: { requests: 10, window: '1 h' },
  ADMIN: { requests: 60, window: '1 m' },
} as const

type RateLimitKey = keyof typeof RATE_LIMITS

const _limiterCache = new Map<RateLimitKey, Ratelimit>()

function getLimiter(key: RateLimitKey): Ratelimit {
  if (!_limiterCache.has(key)) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    const { requests, window: windowSize } = RATE_LIMITS[key]
    _limiterCache.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, windowSize),
        prefix: `sapal:ratelimit:${key.toLowerCase()}`,
      })
    )
  }
  return _limiterCache.get(key)!
}

export async function limitByIP(
  ip: string,
  key: RateLimitKey
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    const limiter = getLimiter(key)
    const result = await limiter.limit(ip)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (err) {
    console.error('[rate-limit] Upstash unavailable, failing open:', err)
    return { success: true, remaining: -1, reset: 0 }
  }
}
