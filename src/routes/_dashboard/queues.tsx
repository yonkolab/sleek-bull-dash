import { createFileRoute, redirect } from '@tanstack/react-router'

// /queues without a specific queue → go to dashboard index
export const Route = createFileRoute('/_dashboard/queues')({
  beforeLoad: () => {
    throw redirect({ to: '/_dashboard/' })
  },
  component: () => null,
})
