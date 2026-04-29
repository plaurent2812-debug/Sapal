import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks hoistés AVANT import de la route
const hoisted = vi.hoisted(() => {
  const singleMock = vi.fn()
  const selectMock = vi.fn(() => ({ single: singleMock }))
  const eqMock = vi.fn(() => ({ select: selectMock }))
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ update: updateMock }))
  const createServiceRoleClientMock = vi.fn(() => ({ from: fromMock }))

  const getUserMock = vi.fn()
  const authMock = { getUser: getUserMock }
  const createServerSupabaseClientMock = vi.fn(() =>
    Promise.resolve({ auth: authMock })
  )

  const revalidateTagMock = vi.fn()

  return {
    singleMock, selectMock, eqMock, updateMock, fromMock,
    createServiceRoleClientMock, getUserMock, authMock,
    createServerSupabaseClientMock, revalidateTagMock,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: hoisted.createServerSupabaseClientMock,
  createServiceRoleClient: hoisted.createServiceRoleClientMock,
}))

vi.mock('next/cache', () => ({
  revalidateTag: hoisted.revalidateTagMock,
}))

import { PATCH } from './route'

function adminUser() {
  return { data: { user: { user_metadata: { role: 'admin' } } } }
}

function makeRequest(body: unknown, id = 'prod-1') {
  const req = new Request(`http://localhost/api/admin/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { req, params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.getUserMock.mockResolvedValue(adminUser())
  hoisted.singleMock.mockResolvedValue({
    data: { id: 'prod-1', name: 'Produit test', delai: '4 semaines' },
    error: null,
  })
})

describe('PATCH /api/admin/products/[id]', () => {
  it('accepte et sauvegarde le champ delai', async () => {
    const { req, params } = makeRequest({ delai: '4 semaines' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(hoisted.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ delai: '4 semaines' })
    )
  })

  it('trim le délai avant sauvegarde', async () => {
    const { req, params } = makeRequest({ delai: '  3 jours  ' })
    await PATCH(req, { params })
    expect(hoisted.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ delai: '3 jours' })
    )
  })

  it('accepte un delai vide (remise à zéro)', async () => {
    hoisted.singleMock.mockResolvedValue({
      data: { id: 'prod-1', name: 'Produit test', delai: '' },
      error: null,
    })
    const { req, params } = makeRequest({ delai: '' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(200)
    expect(hoisted.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ delai: '' })
    )
  })

  it('retourne 403 si pas admin', async () => {
    hoisted.getUserMock.mockResolvedValue({
      data: { user: { user_metadata: { role: 'client' } } },
    })
    const { req, params } = makeRequest({ delai: '2 semaines' })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(403)
  })

  it("retourne 400 si delai n'est pas une string", async () => {
    const { req, params } = makeRequest({ delai: 42 })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
  })
})
