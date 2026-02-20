import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import Fuse from 'fuse.js'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Server,
  Layers,
  Zap,
  Key,
  Plus,
  Settings,
  RotateCcw,
  Trash2,
  PauseCircle,
  CirclePlay,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '#/components/ui/command'
import { Badge } from '#/components/ui/badge'
import { $getConnections, $searchKeys } from '#/server/connection-fns'
import { $getQueues, $cleanQueue, $pauseQueue, $resumeQueue, $retryAllFailed } from '#/server/queue-fns'
import type { ConnectionSummary } from '#/server/connection-fns'

// ─── OS Detection ─────────────────────────────────────────────────────────────

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.platform?.toUpperCase().includes('MAC') ?? false
}

export function KeyboardHint() {
  const mac = isMac()
  return (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {mac ? (
        <kbd className="px-1.5 py-0.5 border rounded text-[10px] font-mono bg-muted">⌘</kbd>
      ) : (
        <kbd className="px-1.5 py-0.5 border rounded text-[10px] font-mono bg-muted">Ctrl</kbd>
      )}
      <kbd className="px-1.5 py-0.5 border rounded text-[10px] font-mono bg-muted">K</kbd>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PaletteItem = {
  type: 'connection' | 'queue' | 'command' | 'key'
  id: string
  label: string
  description?: string
  connectionId?: string
  queueName?: string
  action?: () => void | Promise<void>
  icon?: React.ReactNode
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const routerState = useRouterState()

  // Derive active connectionId and queueName from the current URL
  type AnyParams = Record<string, string>
  const connMatches = routerState.matches.filter((m) => 'connectionId' in (m.params ?? {}))
  const activeConnectionId = (connMatches[connMatches.length - 1]?.params as AnyParams | undefined)?.connectionId

  const queueMatches = routerState.matches.filter((m) => 'queueName' in (m.params ?? {}))
  const activeQueueName = (queueMatches[queueMatches.length - 1]?.params as AnyParams | undefined)?.queueName

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Reset search when closed
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const close = useCallback(() => setOpen(false), [])

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: () => $getConnections(),
    staleTime: 30_000,
    enabled: open,
  })

  const { data: activeQueues = [] } = useQuery({
    queryKey: ['queues', activeConnectionId],
    queryFn: () => $getQueues({ data: { connectionId: activeConnectionId ?? '' } }),
    enabled: open && !!activeConnectionId,
    staleTime: 5_000,
  })

  // Key search — only when search input looks like a key pattern
  const shouldSearchKeys = open && !!activeConnectionId && search.length >= 2
  const { data: keyResults = [] } = useQuery({
    queryKey: ['key-search', activeConnectionId, search],
    queryFn: () =>
      $searchKeys({ data: { connectionId: activeConnectionId ?? '', pattern: `*${search}*`, count: 10 } }),
    enabled: shouldSearchKeys,
    staleTime: 3_000,
  })

  const queryClient = useQueryClient()

  // ─── Mutations for commands ────────────────────────────────────────────────

  const cleanMutation = useMutation({
    mutationFn: (args: { connectionId: string; queueName: string; status: 'completed' | 'failed' }) =>
      $cleanQueue({ data: args }),
    onSuccess: (_, v) => {
      toast.success(`Cleaned ${v.status} jobs in ${v.queueName}`)
      queryClient.invalidateQueries({ queryKey: ['queue-jobs', v.connectionId, v.queueName] })
      close()
    },
  })

  const pauseMutation = useMutation({
    mutationFn: (args: { connectionId: string; queueName: string }) =>
      $pauseQueue({ data: args }),
    onSuccess: (_, v) => {
      toast.success(`Queue "${v.queueName}" paused`)
      queryClient.invalidateQueries({ queryKey: ['queues', v.connectionId] })
      close()
    },
  })

  const resumeMutation = useMutation({
    mutationFn: (args: { connectionId: string; queueName: string }) =>
      $resumeQueue({ data: args }),
    onSuccess: (_, v) => {
      toast.success(`Queue "${v.queueName}" resumed`)
      queryClient.invalidateQueries({ queryKey: ['queues', v.connectionId] })
      close()
    },
  })

  const retryAllMutation = useMutation({
    mutationFn: (args: { connectionId: string; queueName: string }) =>
      $retryAllFailed({ data: args }),
    onSuccess: (_, v) => {
      toast.success(`Retrying all failed jobs in ${v.queueName}`)
      queryClient.invalidateQueries({ queryKey: ['queue-jobs', v.connectionId, v.queueName] })
      close()
    },
  })

  // ─── Build palette items ──────────────────────────────────────────────────

  const connectionItems: PaletteItem[] = connections.map((c: ConnectionSummary) => ({
    type: 'connection',
    id: `conn-${c.id}`,
    label: c.name,
    description: `${c.host}:${c.port}`,
    connectionId: c.id,
    icon: <Server className="h-3.5 w-3.5" />,
  }))

  const queueItems: PaletteItem[] = activeQueues.map((q) => ({
    type: 'queue',
    id: `queue-${q.name}`,
    label: q.name,
    description: activeConnectionId
      ? connections.find((c: ConnectionSummary) => c.id === activeConnectionId)?.name
      : undefined,
    connectionId: activeConnectionId,
    queueName: q.name,
    icon: <Layers className="h-3.5 w-3.5" />,
  }))

  // Static commands + contextual ones
  const commandItems: PaletteItem[] = [
    {
      type: 'command',
      id: 'cmd-new-connection',
      label: 'New connection',
      description: 'Add a new Redis connection',
      icon: <Plus className="h-3.5 w-3.5" />,
      action: () => { navigate({ to: '/settings/connections/new' }); close() },
    },
    {
      type: 'command',
      id: 'cmd-manage-connections',
      label: 'Manage connections',
      description: 'View and edit all connections',
      icon: <Settings className="h-3.5 w-3.5" />,
      action: () => { navigate({ to: '/settings/connections' }); close() },
    },
    ...(activeConnectionId && activeQueueName
      ? [
          {
            type: 'command' as const,
            id: 'cmd-retry-all',
            label: `Retry all failed in ${activeQueueName}`,
            description: 'Re-enqueue all failed jobs',
            icon: <RotateCcw className="h-3.5 w-3.5" />,
            action: () =>
              retryAllMutation.mutate({ connectionId: activeConnectionId, queueName: activeQueueName }),
          },
          {
            type: 'command' as const,
            id: 'cmd-clean-completed',
            label: `Clean completed in ${activeQueueName}`,
            description: 'Remove all completed jobs',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            action: () =>
              cleanMutation.mutate({ connectionId: activeConnectionId, queueName: activeQueueName, status: 'completed' }),
          },
          {
            type: 'command' as const,
            id: 'cmd-clean-failed',
            label: `Clean failed in ${activeQueueName}`,
            description: 'Remove all failed jobs',
            icon: <Trash2 className="h-3.5 w-3.5" />,
            action: () =>
              cleanMutation.mutate({ connectionId: activeConnectionId, queueName: activeQueueName, status: 'failed' }),
          },
        ]
      : []),
    // Pause/resume for current queue based on queue state
    ...(activeConnectionId && activeQueueName
      ? activeQueues
          .filter((q) => q.name === activeQueueName)
          .map((q) =>
            q.paused
              ? {
                  type: 'command' as const,
                  id: 'cmd-resume',
                  label: `Resume ${activeQueueName}`,
                  description: 'Resume processing this queue',
                  icon: <CirclePlay className="h-3.5 w-3.5" />,
                  action: () =>
                    resumeMutation.mutate({ connectionId: activeConnectionId, queueName: activeQueueName }),
                }
              : {
                  type: 'command' as const,
                  id: 'cmd-pause',
                  label: `Pause ${activeQueueName}`,
                  description: 'Stop processing this queue',
                  icon: <PauseCircle className="h-3.5 w-3.5" />,
                  action: () =>
                    pauseMutation.mutate({ connectionId: activeConnectionId, queueName: activeQueueName }),
                },
          )
      : []),
  ]

  // ─── Fuzzy search ──────────────────────────────────────────────────────────

  const allSearchableItems = [...connectionItems, ...queueItems, ...commandItems]
  // biome-ignore lint/correctness/useExhaustiveDependencies: allSearchableItems is a derived array that changes with its source data
  const fuse = useMemo(
    () => new Fuse(allSearchableItems, { keys: ['label', 'description'], threshold: 0.4 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connectionItems, queueItems, commandItems],
  )

  const filtered = search
    ? fuse.search(search).map((r) => r.item)
    : allSearchableItems

  const filteredConnections = filtered.filter((i) => i.type === 'connection')
  const filteredQueues = filtered.filter((i) => i.type === 'queue')
  const filteredCommands = filtered.filter((i) => i.type === 'command')

  // ─── Selection handler ─────────────────────────────────────────────────────

  function handleSelect(item: PaletteItem) {
    if (item.action) {
      item.action()
      return
    }
    if (item.type === 'connection' && item.connectionId) {
      navigate({ to: '/connections/$connectionId', params: { connectionId: item.connectionId } })
      close()
    } else if (item.type === 'queue' && item.connectionId && item.queueName) {
      navigate({
        to: '/connections/$connectionId/queues/$queueName',
        params: { connectionId: item.connectionId, queueName: item.queueName },
      })
      close()
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search connections, keys..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredConnections.length > 0 && (
          <CommandGroup heading="Connections">
            {filteredConnections.map((item) => {
              const conn = connections.find((c: ConnectionSummary) => c.id === item.connectionId)
              const isActive = item.connectionId === activeConnectionId
              return (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => handleSelect(item)}
                  className="gap-2"
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span className="flex-1">
                    <span className="font-medium">{item.label}</span>
                    {item.description && (
                      <span className="ml-2 text-xs text-muted-foreground font-mono">
                        {item.description}
                      </span>
                    )}
                  </span>
                  {conn?.sshEnabled && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">SSH</Badge>
                  )}
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {filteredQueues.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Queues">
              {filteredQueues.map((item) => {
                const queue = activeQueues.find((q) => q.name === item.queueName)
                return (
                  <CommandItem
                    key={item.id}
                    value={`queue ${item.label}`}
                    onSelect={() => handleSelect(item)}
                    className="gap-2"
                  >
                    <span className="text-muted-foreground">{item.icon}</span>
                    <span className="flex-1 font-medium">{item.label}</span>
                    {queue && queue.counts.failed > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                        {queue.counts.failed} failed
                      </Badge>
                    )}
                    {queue?.paused && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">paused</Badge>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        {filteredCommands.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Commands">
              {filteredCommands.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`command ${item.label}`}
                  onSelect={() => handleSelect(item)}
                  className="gap-2"
                >
                  <span className="text-muted-foreground">
                    {item.icon ?? <Zap className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex-1">
                    <span className="font-medium">{item.label}</span>
                    {item.description && (
                      <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Redis key search results */}
        {shouldSearchKeys && keyResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Keys">
              {keyResults.map((result) => (
                <CommandItem
                  key={result.key}
                  value={`key ${result.key}`}
                  onSelect={() => {
                    navigator.clipboard.writeText(result.key).catch(() => {})
                    toast.success(`Copied key: ${result.key}`)
                    close()
                  }}
                  className="gap-2"
                >
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 font-mono text-xs truncate">{result.key}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono shrink-0">
                    {result.type}
                  </Badge>
                  {result.ttl > 0 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      TTL {result.ttl}s
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
