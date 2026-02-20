import { createFileRoute, Outlet, redirect, Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Layers,
  ChevronRight,
  CirclePause,
  CirclePlay,
  LogOut,
  ServerCog,
  AlertCircle,
  Server,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import { Separator } from '#/components/ui/separator'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { ThemeToggle } from '#/components/ThemeToggle'
import { authClient } from '#/lib/auth-client'
import { $getSession } from '#/server/auth-fns'
import { $getQueues, $pauseQueue, $resumeQueue } from '#/server/queue-fns'
import { $getConnections } from '#/server/connection-fns'
import { CommandPalette, KeyboardHint } from '#/components/CommandPalette'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: async () => {
    // $getSession é uma server function — lê os cookies da requisição via auth.api.getSession,
    // funcionando tanto em SSR (carregamento inicial) quanto em navegação SPA.
    const user = await $getSession()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    return { user }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()
  const routerState = useRouterState()

  // Derive active connection/queue from the current URL
  type AnyParams = Record<string, string>
  const connMatches = routerState.matches.filter((m) => 'connectionId' in (m.params ?? {}))
  const activeConnectionId = (connMatches[connMatches.length - 1]?.params as AnyParams | undefined)?.connectionId

  const queueMatches = routerState.matches.filter((m) => 'queueName' in (m.params ?? {}))
  const activeQueueName = (queueMatches[queueMatches.length - 1]?.params as AnyParams | undefined)?.queueName

  // Connections list — poll every 30s (connections change rarely)
  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: () => $getConnections(),
    refetchInterval: 30_000,
  })

  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // Queues for the active connection only — poll every 5s
  const { data: queues = [], refetch: refetchQueues } = useQuery({
    queryKey: ['queues', activeConnectionId],
    queryFn: () => $getQueues({ data: { connectionId: activeConnectionId ?? '' } }),
    refetchInterval: 5000,
    enabled: !!activeConnectionId,
  })

  async function handlePauseResume(queueName: string, isPaused: boolean) {
    if (!activeConnectionId) return
    try {
      if (isPaused) {
        await $resumeQueue({ data: { connectionId: activeConnectionId, queueName } })
        toast.success(`Queue "${queueName}" resumed`)
      } else {
        await $pauseQueue({ data: { connectionId: activeConnectionId, queueName } })
        toast.success(`Queue "${queueName}" paused`)
      }
      refetchQueues()
    } catch {
      toast.error('Failed to update queue state')
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    window.location.href = '/login'
  }

  const totalFailed = queues.reduce((sum: number, q) => sum + q.counts.failed, 0)

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">SleekBullDash</span>
              {totalFailed > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-auto">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{totalFailed} failed job(s)</TooltipContent>
                </Tooltip>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent>
            {/* Connections list */}
            <SidebarGroup>
              <SidebarGroupLabel>Connections</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {connections.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      No connections configured.
                    </p>
                  ) : (
                    connections.map((conn) => (
                      <SidebarMenuItem key={conn.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={conn.id === activeConnectionId}
                          className="pr-2"
                        >
                          <Link
                            to="/connections/$connectionId"
                            params={{ connectionId: conn.id }}
                          >
                            <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-sm">{conn.name}</span>
                            {conn.id === activeConnectionId && (
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Queues for active connection */}
            {activeConnectionId && (
              <SidebarGroup>
                <SidebarGroupLabel>Queues</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {queues.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-2">
                        No queues found. Make sure your workers are running.
                      </p>
                    ) : (
                      queues.map((queue) => (
                        <QueueMenuItem
                          key={queue.name}
                          queue={queue}
                          connectionId={activeConnectionId}
                          activeQueueName={activeQueueName}
                          onPauseResume={() => handlePauseResume(queue.name, queue.paused)}
                        />
                      ))
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.name ?? user?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between px-1">
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Manage connections"
                    onClick={() => { window.location.href = '/settings/connections' }}
                  >
                    <ServerCog className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Manage connections</TooltipContent>
              </Tooltip>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center h-12 px-4 border-b border-border shrink-0 gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <EnvironmentBadge environment={activeConnection?.environment} />
            <div className="ml-auto">
              <KeyboardHint />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Global Ctrl+K command palette — mounted outside the main flex container */}
      <CommandPalette />
    </SidebarProvider>
  )
}

function EnvironmentBadge({ environment }: { environment?: string }) {
  if (!environment) return null
  const isProd = environment === 'production'
  return (
    <Badge
      variant={isProd ? 'destructive' : 'outline'}
      className={
        isProd
          ? undefined
          : 'bg-green-600/15 text-green-500 border-green-600/30 dark:text-green-400'
      }
    >
      {environment.toUpperCase()}
    </Badge>
  )
}

type QueueMenuItemProps = {
  queue: {
    name: string
    counts: { active: number; failed: number; waiting: number; completed: number; delayed: number; paused: number }
    paused: boolean
  }
  connectionId: string
  activeQueueName: string | undefined
  onPauseResume: () => void
}

function QueueMenuItem({ queue, connectionId, activeQueueName, onPauseResume }: QueueMenuItemProps) {
  const isActive = queue.name === activeQueueName
  const hasFailures = queue.counts.failed > 0

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="group pr-2">
        <Link
          to="/connections/$connectionId/queues/$queueName"
          params={{ connectionId, queueName: queue.name }}
        >
          <span className={cn('truncate flex-1 text-sm', queue.paused && 'text-muted-foreground')}>
            {queue.name}
          </span>

          <div className="flex items-center gap-1 ml-auto shrink-0">
            {queue.counts.active > 0 && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
            {hasFailures && (
              <Badge variant="destructive" className="h-4 px-1 text-[10px] font-mono">
                {queue.counts.failed > 99 ? '99+' : queue.counts.failed}
              </Badge>
            )}
            {queue.paused && (
              <span className="text-[10px] text-muted-foreground font-medium">paused</span>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onPauseResume()
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-sidebar-accent"
                aria-label={queue.paused ? 'Resume queue' : 'Pause queue'}
              >
                {queue.paused ? (
                  <CirclePlay className="h-3.5 w-3.5" />
                ) : (
                  <CirclePause className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {queue.paused ? 'Resume queue' : 'Pause queue'}
            </TooltipContent>
          </Tooltip>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
