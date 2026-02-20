import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'

// Layout wrapper for all /queues/* routes.
// When on exact /queues (no child): redirect to root.
// When a child route is matched (e.g. /queues/$queueName backward-compat shim): render Outlet.
export const Route = createFileRoute('/_dashboard/queues')({
  component: QueuesLayout,
})

function QueuesLayout() {
  const routerState = useRouterState()
  const isExactMatch =
    routerState.matches[routerState.matches.length - 1]?.routeId === '/_dashboard/queues'

  if (!isExactMatch) {
    return <Outlet />
  }

  // Exact /queues with no child — nothing meaningful here, go home
  return null
}
