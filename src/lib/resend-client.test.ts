import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const resendCtor = vi.fn(function (this: { emails?: { send: () => Promise<{ id: string }> } }, apiKey?: string) {
    if (!apiKey) {
      throw new Error('Missing API key')
    }

    this.emails = {
      send: vi.fn(() => Promise.resolve({ id: 'email-1' })),
    }
  })

  return { resendCtor }
})

vi.mock('resend', () => ({
  Resend: hoisted.resendCtor,
}))

describe('getResendClient', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.RESEND_API_KEY
  })

  it('does not construct Resend when RESEND_API_KEY is missing', async () => {
    const { getResendClient } = await import('./resend-client')

    expect(getResendClient()).toBeNull()
    expect(hoisted.resendCtor).not.toHaveBeenCalled()
  })

  it('constructs Resend lazily when RESEND_API_KEY is configured', async () => {
    process.env.RESEND_API_KEY = 're_test'
    const { getResendClient } = await import('./resend-client')

    expect(getResendClient()).toBeTruthy()
    expect(hoisted.resendCtor).toHaveBeenCalledWith('re_test')
  })
})
