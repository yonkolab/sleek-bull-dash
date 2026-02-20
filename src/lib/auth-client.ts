import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // baseURL is required in TanStack Start to prevent infinite loops.
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
})
