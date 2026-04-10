import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.hoisted(() => vi.fn())

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn().mockReturnValue({})
    limit = mockLimit
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(_opts: unknown) {}
  },
}))

import { getClientIP, RATE_LIMITS, limitByIP } from './rate-limit-upstash'

describe('getClientIP', () => {
  it('extracts first IP from x-forwarded-for header', () => {
    const request = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    })
    expect(getClientIP(request)).toBe('192.168.1.1')
  })

  it('returns "unknown" when header is absent', () => {
    const request = new Request('http://localhost/')
    expect(getClientIP(request)).toBe('unknown')
  })
})

describe('RATE_LIMITS', () => {
  it('defines CONTACT, QUOTES, ADMIN limits', () => {
    expect(RATE_LIMITS.CONTACT).toBeDefined()
    expect(RATE_LIMITS.QUOTES).toBeDefined()
    expect(RATE_LIMITS.ADMIN).toBeDefined()
  })

  it('CONTACT has fewer requests than QUOTES', () => {
    expect(RATE_LIMITS.CONTACT.requests).toBeLessThan(RATE_LIMITS.QUOTES.requests)
  })
})

describe('limitByIP', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns success:true when under the limit', async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 4, reset: 9999 })
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('returns success:false when limit exceeded', async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0, reset: 9999 })
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.success).toBe(false)
  })

  it('calls limit() with the provided IP', async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 9, reset: 9999 })
    await limitByIP('5.6.7.8', 'QUOTES')
    expect(mockLimit).toHaveBeenCalledWith('5.6.7.8')
  })

  it('exposes reset timestamp from Upstash response', async () => {
    mockLimit.mockResolvedValue({ success: true, remaining: 3, reset: 12345 })
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.reset).toBe(12345)
  })
})
