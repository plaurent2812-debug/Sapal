import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
})

// Mock des variables d'env publiques utilisees par Supabase
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key')
vi.stubEnv('RESEND_API_KEY', 'test-resend-key')
vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@test.sapal.fr')
vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-telegram-token')
vi.stubEnv('TELEGRAM_CHAT_ID', 'test-chat-id')
vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io')
vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-upstash-token')
