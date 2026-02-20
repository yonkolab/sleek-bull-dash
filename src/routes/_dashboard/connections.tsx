import { createFileRoute, useNavigate, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { $getConnections } from '#/server/connection-fns'

export const Route = createFileRoute('/_dashboard/connections')({
  component: ConnectionsLayout,
})

// This route is the PARENT of all /connections/* routes in TanStack Router.
// It must render <Outlet /> when a child route is matched, so children can render.
// When on exact /connections (no child): shows spinner and redirects to default connection.
function ConnectionsLayout() {
  const navigate = useNavigate()
  const routerState = useRouterState()

  // True only when this is the leaf route (exact /connections, no child matched)
  const isExactMatch =
    routerState.matches[routerState.matches.length - 1]?.routeId === '/_dashboard/connections'

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => $getConnections(),
    enabled: isExactMatch,
  })

  useEffect(() => {
    if (!isExactMatch || !connections) return
    const def = connections.find((c) => c.isDefault) ?? connections[0]
    if (def) {
      navigate({
        to: '/connections/$connectionId',
        params: { connectionId: def.id },
        replace: true,
      })
    } else {
      navigate({ to: '/settings/connections', replace: true })
    }
  }, [isExactMatch, connections, navigate])

  // Child route matched — render it transparently
  if (!isExactMatch) {
    return <Outlet />
  }

  // Exact /connections — spinner while waiting to redirect
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  )
}
