import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { sendTelegramMessage } from '@/lib/telegram'

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
  AUTH: { requests: 5, window: '1 h' },
} as const

type RateLimitKey = keyof typeof RATE_LIMITS

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return _redis
}

const _limiterCache = new Map<RateLimitKey, Ratelimit>()

function getLimiter(key: RateLimitKey): Ratelimit {
  if (!_limiterCache.has(key)) {
    const { requests, window: windowSize } = RATE_LIMITS[key]
    _limiterCache.set(
      key,
      new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(requests, windowSize),
        prefix: `sapal:ratelimit:${key.toLowerCase()}`,
      })
    )
  }
  return _limiterCache.get(key)!
}

const ABUSE_THRESHOLD = 5

export async function trackAbuse(ip: string, key: RateLimitKey): Promise<void> {
  const redis = getRedis()
  const abuseKey = `sapal:abuse:${key.toLowerCase()}:${ip}`
  const count = await redis.incr(abuseKey)
  if (count === 1) {
    await redis.expire(abuseKey, 3600)
  }
  if (count >= ABUSE_THRESHOLD) {
    await sendTelegramMessage(
      `🚨 *Alerte abus SAPAL*\n\nIP: \`${ip}\`\nRoute: ${key}\nBlocages: ${count} en 1h\n⚠️ Vérifiez les logs Vercel`
    )
    await redis.del(abuseKey)
  }
}

export async function limitByIP(
  ip: string,
  key: RateLimitKey
): Promise<{ success: boolean; remaining: number; reset: number }> {
  try {
    const limiter = getLimiter(key)
    const result = await limiter.limit(ip)
    if (!result.success) {
      trackAbuse(ip, key).catch(err =>
        console.error('[rate-limit] abuse tracking error:', err)
      )
    }
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
