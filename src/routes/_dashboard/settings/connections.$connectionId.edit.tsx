import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '#/components/ui/skeleton'
import { ConnectionForm } from '#/components/ConnectionForm'
import { $getConnections } from '#/server/connection-fns'

export const Route = createFileRoute(
  '/_dashboard/settings/connections/$connectionId/edit',
)({
  component: EditConnectionPage,
})

function EditConnectionPage() {
  const { connectionId } = Route.useParams()

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => $getConnections(),
  })

  const connection = connections?.find((c) => c.id === connectionId)

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full max-w-lg" />
        <Skeleton className="h-10 w-full max-w-lg" />
      </div>
    )
  }

  if (!connection) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Connection not found.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-base font-semibold">Edit Connection</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Update settings for <span className="font-medium">{connection.name}</span>.
          The SSH private key is stored encrypted — upload a new file to replace it.
        </p>
      </div>
      <ConnectionForm existing={connection} />
    </div>
  )
}
