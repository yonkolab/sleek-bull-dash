import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

/**
 * Server-side session check — reads cookies from the incoming request headers.
 * Used in _dashboard beforeLoad to guard protected routes in both SSR and SPA contexts.
 */
export const $getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!session?.user) return null
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  }
})
