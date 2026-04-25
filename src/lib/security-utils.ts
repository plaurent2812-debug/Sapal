type BcValidationResult =
  | { ok: true; extension: 'pdf' | 'jpg' | 'png'; contentType: string }
  | { ok: false; error: string }

const MAX_BC_FILE_SIZE = 10 * 1024 * 1024

const BC_FILE_TYPES = {
  'application/pdf': {
    extension: 'pdf',
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46,
  },
  'image/jpeg': {
    extension: 'jpg',
    matches: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47,
  },
} as const

export function escapePostgrestLikePattern(value: string): string {
  return value.replace(/[\\%_,.()]/g, (char) => `\\${char}`)
}

export function escapeTelegramMarkdown(value: string): string {
  return value.replace(/[_*[\]()~`>#+\-=|{}.!]/g, (char) => `\\${char}`)
}

export async function validateBcFile(file: File): Promise<BcValidationResult> {
  if (file.size > MAX_BC_FILE_SIZE) {
    return { ok: false, error: 'Fichier trop volumineux' }
  }

  const typeConfig = BC_FILE_TYPES[file.type as keyof typeof BC_FILE_TYPES]
  if (!typeConfig) {
    return { ok: false, error: 'Type de fichier invalide' }
  }

  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (!typeConfig.matches(bytes)) {
    return { ok: false, error: 'Type de fichier invalide' }
  }

  return {
    ok: true,
    extension: typeConfig.extension,
    contentType: file.type,
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} doit etre configure pour generer les documents Chorus Pro`)
  }
  return value
}

export function getSapalSupplierDetails() {
  return {
    name: process.env.SAPAL_LEGAL_NAME?.trim() || 'SAPAL Signalisation',
    siret: requireEnv('SAPAL_SIRET'),
    tvaIntracom: requireEnv('SAPAL_TVA_INTRACOM'),
    address: process.env.SAPAL_ADDRESS?.trim() || '260 Av. Michel Jourdan',
    postalCode: process.env.SAPAL_POSTAL_CODE?.trim() || '06150',
    city: process.env.SAPAL_CITY?.trim() || 'Cannes',
    phone: process.env.SAPAL_PHONE?.trim() || '06 22 90 28 54',
    email: process.env.SAPAL_EMAIL?.trim() || 'societe@sapal.fr',
  }
}
