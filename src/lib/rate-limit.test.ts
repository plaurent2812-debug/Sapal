import { describe, it, expect, beforeEach } from 'vitest'
import { checkRateLimit } from './rate-limit'

describe('checkRateLimit (in-memory legacy)', () => {
  beforeEach(() => {
    // Reset du Map interne n'est pas expose. On utilise des IPs uniques par test.
  })

  it('allows first request from a new IP', () => {
    const result = checkRateLimit('10.0.0.1', 10, 60000)
    expect(result).toBe(true)
  })

  it('blocks after exceeding max requests within the window', () => {
    const ip = '10.0.0.2'
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip, 5, 60000)
    }
    const blocked = checkRateLimit(ip, 5, 60000)
    expect(blocked).toBe(false)
  })

  it('resets counter after the time window expires', async () => {
    const ip = '10.0.0.3'
    checkRateLimit(ip, 1, 50) // window de 50ms
    expect(checkRateLimit(ip, 1, 50)).toBe(false)
    await new Promise((r) => setTimeout(r, 80))
    expect(checkRateLimit(ip, 1, 50)).toBe(true)
  })
})
