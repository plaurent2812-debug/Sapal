import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.hoisted(() => vi.fn())
const mockIncr = vi.hoisted(() => vi.fn())
const mockExpire = vi.hoisted(() => vi.fn())
const mockDel = vi.hoisted(() => vi.fn())
const mockSendTelegram = vi.hoisted(() => vi.fn())

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn().mockReturnValue({})
    limit = mockLimit
  },
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(_opts: unknown) {}
    incr = mockIncr
    expire = mockExpire
    del = mockDel
  },
}))

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: mockSendTelegram,
}))

import { getClientIP, RATE_LIMITS, limitByIP, trackAbuse } from './rate-limit-upstash'

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
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 4, reset: 9999 })
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('returns success:false when limit exceeded', async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: 9999 })
    mockIncr.mockResolvedValueOnce(1) // abuse tracking — not at threshold yet
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.success).toBe(false)
  })

  it('calls limit() with the provided IP', async () => {
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 9, reset: 9999 })
    await limitByIP('5.6.7.8', 'QUOTES')
    expect(mockLimit).toHaveBeenCalledWith('5.6.7.8')
  })

  it('exposes reset timestamp from Upstash response', async () => {
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 3, reset: 12345 })
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.reset).toBe(12345)
  })

  it('fails open (success:true) when Redis throws', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Redis connection timeout'))
    const result = await limitByIP('1.2.3.4', 'CONTACT')
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(-1)
  })
})

describe('trackAbuse', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not send Telegram alert when block count is below threshold', async () => {
    mockIncr.mockResolvedValueOnce(3)
    await trackAbuse('1.2.3.4', 'CONTACT')
    expect(mockSendTelegram).not.toHaveBeenCalled()
  })

  it('sends Telegram alert when block count reaches threshold (5)', async () => {
    mockIncr.mockResolvedValueOnce(5)
    mockSendTelegram.mockResolvedValueOnce(undefined)
    mockDel.mockResolvedValueOnce(1)
    await trackAbuse('malicious.ip', 'CONTACT')
    expect(mockSendTelegram).toHaveBeenCalledWith(
      expect.stringContaining('malicious.ip')
    )
    expect(mockSendTelegram).toHaveBeenCalledWith(
      expect.stringContaining('CONTACT')
    )
  })

  it('resets the abuse counter after sending the alert', async () => {
    mockIncr.mockResolvedValueOnce(5)
    mockSendTelegram.mockResolvedValueOnce(undefined)
    mockDel.mockResolvedValueOnce(1)
    await trackAbuse('1.2.3.4', 'QUOTES')
    expect(mockDel).toHaveBeenCalledWith(
      expect.stringContaining('sapal:abuse:quotes:1.2.3.4')
    )
  })

  it('sets 1h TTL on the first block', async () => {
    mockIncr.mockResolvedValueOnce(1)
    mockExpire.mockResolvedValueOnce(1)
    await trackAbuse('1.2.3.4', 'AUTH')
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining('sapal:abuse'),
      3600
    )
  })
})
