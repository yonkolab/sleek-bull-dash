import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, Loader2, Wifi } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { $getConnections, $deleteConnection, $testConnection, type ConnectionSummary } from '#/server/connection-fns'

export const Route = createFileRoute('/_dashboard/settings/connections')({
  component: ConnectionsSettingsPage,
})

function ConnectionsSettingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => $getConnections(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => $deleteConnection({ data: { id } }),
    onSuccess: () => {
      toast.success('Connection deleted')
      queryClient.invalidateQueries({ queryKey: ['connections'] })
    },
    onError: () => toast.error('Failed to delete connection'),
  })

  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  async function handleTest(id: string) {
    setTestingId(id)
    try {
      const result = await $testConnection({ data: { id } })
      setTestResults((prev) => ({
        ...prev,
        [id]: result.success
          ? { success: true, message: `${result.queuesFound} queues` }
          : { success: false, message: result.error ?? 'Failed' },
      }))
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err instanceof Error ? err.message : 'Error' },
      }))
    } finally {
      setTestingId(null)
    }
  }

  function handleDelete(conn: ConnectionSummary) {
    if (conn.isDefault) {
      toast.error('Cannot delete the default connection')
      return
    }
    if (!window.confirm(`Delete connection "${conn.name}"?`)) return
    deleteMutation.mutate(conn.id)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Connections</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your Redis connections. All users share these connections.
          </p>
        </div>
        <Button size="sm" className="h-8" asChild>
          <Link to="/settings/connections/new">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New connection
          </Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead>Name</TableHead>
            <TableHead>Host</TableHead>
            <TableHead>SSH</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                Loading...
              </TableCell>
            </TableRow>
          ) : connections.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                No connections yet.{' '}
                <Link to="/settings/connections/new" className="underline">
                  Create one
                </Link>
              </TableCell>
            </TableRow>
          ) : (
            connections.map((conn) => {
              const testResult = testResults[conn.id]
              return (
                <TableRow key={conn.id} className="text-xs">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {conn.name}
                      {conn.isDefault && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">default</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {conn.host}:{conn.port}
                    {conn.db > 0 && ` db${conn.db}`}
                  </TableCell>
                  <TableCell>
                    {conn.sshEnabled ? (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {conn.sshHost ?? 'SSH'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {testResult ? (
                      <span
                        className={
                          testResult.success
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-destructive'
                        }
                      >
                        {testResult.message}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={testingId === conn.id}
                        onClick={() => handleTest(conn.id)}
                        title="Test connection"
                      >
                        {testingId === conn.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Wifi className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          navigate({
                            to: '/settings/connections/$connectionId/edit',
                            params: { connectionId: conn.id },
                          })
                        }
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => handleDelete(conn)}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
