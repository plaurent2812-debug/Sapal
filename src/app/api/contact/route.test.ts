import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks doivent etre declares AVANT l'import de la route.
// vi.mock est hoisted par Vitest, donc vi.hoisted() est utilise
// pour partager les spies entre le factory et les tests.
const hoisted = vi.hoisted(() => {
  const insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const fromMock = vi.fn(() => ({ insert: insertMock }))
  const createServiceRoleClientMock = vi.fn(() => ({ from: fromMock }))

  const resendSendMock = vi.fn(() => Promise.resolve({ id: 'email-1' }))
  // `new Resend(...)` doit fonctionner -> on utilise une fonction-constructeur.
  function ResendCtor(this: unknown) {
    // @ts-expect-error - affectation sur this dans un constructeur simule
    this.emails = { send: resendSendMock }
  }

  const sendTelegramMessageMock = vi.fn(() => Promise.resolve(true))

  const checkRateLimitMock = vi.fn(() => true)

  return {
    insertMock,
    fromMock,
    createServiceRoleClientMock,
    resendSendMock,
    ResendCtor,
    sendTelegramMessageMock,
    checkRateLimitMock,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: hoisted.createServiceRoleClientMock,
}))

vi.mock('resend', () => ({
  Resend: hoisted.ResendCtor,
}))

vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: hoisted.sendTelegramMessageMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: hoisted.checkRateLimitMock,
}))

// Import apres la declaration des mocks.
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: rate limiter autorise.
    hoisted.checkRateLimitMock.mockReturnValue(true)
    hoisted.insertMock.mockResolvedValue({ data: null, error: null })
  })

  it('returns 400 on missing required fields', async () => {
    // body vide -> Zod echoue sur name, email, subject, message
    const res = await POST(makeRequest({ name: 'Jean' }))
    expect(res.status).toBe(400)
    // Supabase ne doit pas etre sollicite si la validation echoue
    expect(hoisted.fromMock).not.toHaveBeenCalled()
  })

  it('returns 400 on invalid email', async () => {
    const res = await POST(
      makeRequest({
        name: 'Jean',
        email: 'not-an-email',
        phone: '0123456789',
        subject: 'Demande devis',
        message: 'Bonjour',
      })
    )
    expect(res.status).toBe(400)
    expect(hoisted.fromMock).not.toHaveBeenCalled()
  })

  it('inserts a contact in Supabase on valid submission', async () => {
    const res = await POST(
      makeRequest({
        name: 'Jean Dupont',
        email: 'jean@example.fr',
        phone: '0123456789',
        subject: 'Demande devis',
        message: 'Je souhaite un devis pour du mobilier urbain',
      })
    )

    expect(res.status).toBeLessThan(400)

    // La route utilise createServiceRoleClient (pas createClient)
    expect(hoisted.createServiceRoleClientMock).toHaveBeenCalled()
    expect(hoisted.fromMock).toHaveBeenCalledWith('contacts')
    expect(hoisted.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jean Dupont',
        email: 'jean@example.fr',
        phone: '0123456789',
        subject: 'Demande devis',
        message: 'Je souhaite un devis pour du mobilier urbain',
      })
    )
  })
})
