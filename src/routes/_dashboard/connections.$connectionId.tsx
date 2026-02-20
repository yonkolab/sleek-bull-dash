import { createFileRoute, useNavigate, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { $getQueues } from '#/server/queue-fns'

export const Route = createFileRoute('/_dashboard/connections/$connectionId')({
  component: ConnectionLayout,
})

// This route is the PARENT of /connections/$connectionId/queues/$queueName.
// It must render <Outlet /> when a child route is matched.
// When on exact /connections/$connectionId: shows spinner and redirects to first queue.
function ConnectionLayout() {
  const { connectionId } = Route.useParams()
  const navigate = useNavigate()
  const routerState = useRouterState()

  // True only when this is the leaf route (exact /connections/$connectionId, no child matched)
  const isExactMatch =
    routerState.matches[routerState.matches.length - 1]?.routeId ===
    '/_dashboard/connections/$connectionId'

  const { data: queues, isLoading, isError } = useQuery({
    queryKey: ['queues', connectionId],
    queryFn: () => $getQueues({ data: { connectionId } }),
    enabled: isExactMatch,
  })

  useEffect(() => {
    if (!isExactMatch || !queues) return
    if (queues.length > 0) {
      navigate({
        to: '/connections/$connectionId/queues/$queueName',
        params: { connectionId, queueName: queues[0].name },
        replace: true,
      })
    }
  }, [isExactMatch, queues, connectionId, navigate])

  // Child route matched — render it transparently
  if (!isExactMatch) {
    return <Outlet />
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <p className="text-sm font-medium">Could not connect to Redis</p>
        <p className="text-xs text-center max-w-xs">
          Check that your Redis connection is reachable and try again.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <p className="text-sm font-medium">No queues found</p>
      <p className="text-xs text-center max-w-xs">
        No BullMQ queues were discovered on this connection. Make sure your
        workers are running and have created at least one queue.
      </p>
    </div>
  )
}
