import { Resend } from 'resend'

let resendClient: InstanceType<typeof Resend> | null = null
let resendApiKey: string | null = null

export function getResendClient(): InstanceType<typeof Resend> | null {
  const apiKey = process.env.RESEND_API_KEY?.trim()

  if (!apiKey) {
    return null
  }

  if (!resendClient || resendApiKey !== apiKey) {
    resendClient = new Resend(apiKey)
    resendApiKey = apiKey
  }

  return resendClient
}
