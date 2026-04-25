import { describe, expect, it, vi } from 'vitest'
import {
  escapePostgrestLikePattern,
  escapeTelegramMarkdown,
  getSapalSupplierDetails,
  validateBcFile,
} from './security-utils'

function makeFile(bytes: number[], type: string, name = 'bc.pdf') {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('escapePostgrestLikePattern', () => {
  it('escapes PostgREST OR separators and LIKE wildcards', () => {
    expect(escapePostgrestLikePattern('abc%,id.eq.1_(x)')).toBe('abc\\%\\,id\\.eq\\.1\\_\\(x\\)')
  })
})

describe('escapeTelegramMarkdown', () => {
  it('escapes Telegram MarkdownV2 control characters', () => {
    expect(escapeTelegramMarkdown('ACME_[test](https://x.y)!')).toBe(
      'ACME\\_\\[test\\]\\(https://x\\.y\\)\\!'
    )
  })
})

describe('validateBcFile', () => {
  it('accepts a real PDF signature under the size limit', async () => {
    const file = makeFile([0x25, 0x50, 0x44, 0x46, 0x2d], 'application/pdf')
    await expect(validateBcFile(file)).resolves.toEqual({
      ok: true,
      extension: 'pdf',
      contentType: 'application/pdf',
    })
  })

  it('rejects a spoofed PDF content type', async () => {
    const file = makeFile([0x4d, 0x5a, 0x90, 0x00], 'application/pdf')
    await expect(validateBcFile(file)).resolves.toEqual({
      ok: false,
      error: 'Type de fichier invalide',
    })
  })
})

describe('getSapalSupplierDetails', () => {
  it('fails fast when legal identifiers are not configured', () => {
    vi.stubEnv('SAPAL_SIRET', '')
    vi.stubEnv('SAPAL_TVA_INTRACOM', '')

    expect(() => getSapalSupplierDetails()).toThrow('SAPAL_SIRET')

    vi.unstubAllEnvs()
  })
})
