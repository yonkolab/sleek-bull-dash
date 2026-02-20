import { createFileRoute, redirect } from '@tanstack/react-router'
import { $getConnections } from '#/server/connection-fns'

// Backward-compatibility redirect: /queues/:name → /connections/:defaultId/queues/:name
export const Route = createFileRoute('/_dashboard/queues/$queueName')({
  beforeLoad: async ({ params }) => {
    const connections = await $getConnections()
    const def = connections.find((c) => c.isDefault) ?? connections[0]
    if (def) {
      throw redirect({
        to: '/connections/$connectionId/queues/$queueName',
        params: { connectionId: def.id, queueName: params.queueName },
      })
    }
    throw redirect({ to: '/' })
  },
  component: () => null,
})
