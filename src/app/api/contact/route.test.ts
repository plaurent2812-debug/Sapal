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

  return {
    insertMock,
    fromMock,
    createServiceRoleClientMock,
    resendSendMock,
    ResendCtor,
    sendTelegramMessageMock,
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

vi.mock('@/lib/rate-limit-upstash', () => ({
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  limitByIP: vi.fn().mockResolvedValue({ success: true, remaining: 4, reset: 9999 }),
}))

// Import apres la declaration des mocks.
import { POST } from './route'
import { limitByIP } from '@/lib/rate-limit-upstash'

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
    vi.mocked(limitByIP).mockResolvedValue({ success: true, remaining: 4, reset: 9999 })
    hoisted.insertMock.mockResolvedValue({ data: null, error: null })
  })

  it('returns 400 on missing required fields', async () => {
    // body vide -> Zod echoue sur name, email, subject, message
    const res = await POST(makeRequest({ name: 'Jean' }))
    expect(res.status).toBe(400)
    // Supabase ne doit pas etre sollicite si la validation echoue
    expect(hoisted.fromMock).not.toHaveBeenCalled()
    // Corps de reponse bien forme : champ error present
    const body = await res.json()
    expect(body).toHaveProperty('error')
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
    // Corps de reponse bien forme : champ error present
    const body = await res.json()
    expect(body).toHaveProperty('error')
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

    // Corps de reponse du happy path : { success: true }
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('coerces empty phone to null in Supabase insert', async () => {
    // phone: '' (chaine vide) -> doit etre coerce en null via `phone || null` (route.ts L52)
    const res = await POST(
      makeRequest({
        name: 'Marie Martin',
        email: 'marie@example.fr',
        phone: '',
        subject: 'Question produit',
        message: 'Avez-vous ce produit en stock ?',
      })
    )

    expect(res.status).toBeLessThan(400)
    expect(hoisted.fromMock).toHaveBeenCalledWith('contacts')
    expect(hoisted.insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Marie Martin',
        email: 'marie@example.fr',
        phone: null,
        subject: 'Question produit',
        message: 'Avez-vous ce produit en stock ?',
      })
    )
  })

  it('returns 429 when rate limit exceeded', async () => {
    vi.mocked(limitByIP).mockResolvedValueOnce({ success: false, remaining: 0, reset: 9999 })
    const request = new Request('http://localhost/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        email: 'test@example.com',
        subject: 'Test',
        message: 'Hello',
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(429)
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})
