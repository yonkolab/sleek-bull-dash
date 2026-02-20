import { createFileRoute } from '@tanstack/react-router'
import { ConnectionForm } from '#/components/ConnectionForm'

export const Route = createFileRoute('/_dashboard/settings/connections/new')({
  component: NewConnectionPage,
})

function NewConnectionPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-base font-semibold">New Connection</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add a new Redis connection. SSH tunneling is supported.
        </p>
      </div>
      <ConnectionForm />
    </div>
  )
}
