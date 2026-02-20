import { createFileRoute, Outlet, redirect, Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Layers,
  ChevronRight,
  CirclePause,
  CirclePlay,
  LogOut,
  Settings,
  AlertCircle,
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
import { $getQueues, $pauseQueue, $resumeQueue } from '#/server/queue-fns'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_dashboard')({
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session?.data?.user) {
      throw redirect({ to: '/login' })
    }
    return { user: session.data.user }
  },
  component: DashboardLayout,
})

function DashboardLayout() {
  const { user } = Route.useRouteContext()

  const { data: queues = [], refetch } = useQuery({
    queryKey: ['queues'],
    queryFn: () => $getQueues(),
    refetchInterval: 5000,
  })

  async function handlePauseResume(queueName: string, isPaused: boolean) {
    try {
      if (isPaused) {
        await $resumeQueue({ data: { queueName } })
        toast.success(`Queue "${queueName}" resumed`)
      } else {
        await $pauseQueue({ data: { queueName } })
        toast.success(`Queue "${queueName}" paused`)
      }
      refetch()
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
              <span className="font-semibold text-sm">QueueDash</span>
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
            <SidebarGroup>
              <SidebarGroupLabel>Queues</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {queues.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      No queues found. Set <code className="font-mono">BULLMQ_QUEUES</code> or connect to Redis.
                    </p>
                  ) : (
                    queues.map((queue) => (
                      <QueueMenuItem
                        key={queue.name}
                        queue={queue}
                        onPauseResume={() => handlePauseResume(queue.name, queue.paused)}
                      />
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
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
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center h-12 px-4 border-b border-border shrink-0 gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}

type QueueMenuItemProps = {
  queue: {
    name: string
    counts: { active: number; failed: number; waiting: number; completed: number; delayed: number; paused: number }
    paused: boolean
  }
  onPauseResume: () => void
}

function QueueMenuItem({ queue, onPauseResume }: QueueMenuItemProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isActive = pathname === `/queues/${queue.name}`
  const hasFailures = queue.counts.failed > 0

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="group pr-2">
        <Link to="/queues/$queueName" params={{ queueName: queue.name }}>
          <span className={cn('truncate flex-1 text-sm', queue.paused && 'text-muted-foreground')}>
            {queue.name}
          </span>

          {/* Status indicators */}
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

          {/* Pause/resume button (shown on hover) */}
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
