import { createFileRoute, redirect } from '@tanstack/react-router'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session?.data?.user) {
      throw redirect({ to: '/queues' })
    }
    throw redirect({ to: '/login' })
  },
  // This component never renders — beforeLoad always redirects
  component: () => null,
})
