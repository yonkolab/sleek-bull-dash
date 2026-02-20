import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  RefreshCw,
  Trash2,
  RotateCcw,
  ChevronDown,
  MoreHorizontal,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlarmClock,
  PauseCircle,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import { Skeleton } from '#/components/ui/skeleton'
import {
  $getQueueJobs,
  $retryJob,
  $removeJob,
  $cleanQueue,
} from '#/server/queue-fns'
import type { QueueStatus, JobSummary, QueueCounts } from '#/lib/queue'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_dashboard/queues/$queueName')({
  component: QueuePage,
})

const PAGE_SIZE = 50

const STATUS_TABS: { value: QueueStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { value: 'failed', label: 'Failed', icon: <XCircle className="h-3.5 w-3.5" /> },
  { value: 'active', label: 'Active', icon: <Loader2 className="h-3.5 w-3.5" /> },
  { value: 'waiting', label: 'Waiting', icon: <Clock className="h-3.5 w-3.5" /> },
  { value: 'delayed', label: 'Delayed', icon: <AlarmClock className="h-3.5 w-3.5" /> },
  { value: 'paused', label: 'Paused', icon: <PauseCircle className="h-3.5 w-3.5" /> },
]

function QueuePage() {
  const { queueName } = Route.useParams()
  const [status, setStatus] = useState<QueueStatus>('completed')
  const [page, setPage] = useState(0)
  const queryClient = useQueryClient()

  const queryKey = ['queue-jobs', queueName, status, page]

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      $getQueueJobs({
        data: {
          queueName,
          status,
          start: page * PAGE_SIZE,
          end: page * PAGE_SIZE + PAGE_SIZE - 1,
        },
      }),
    refetchInterval: 3000,
    placeholderData: (prev) => prev,
  })

  const jobs: JobSummary[] = data?.jobs ?? []
  const counts: QueueCounts = data?.counts ?? {
    active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0, paused: 0,
  }

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => $retryJob({ data: { queueName, jobId } }),
    onSuccess: () => {
      toast.success('Job queued for retry')
      queryClient.invalidateQueries({ queryKey: ['queue-jobs', queueName] })
    },
    onError: () => toast.error('Failed to retry job'),
  })

  const removeMutation = useMutation({
    mutationFn: (jobId: string) => $removeJob({ data: { queueName, jobId } }),
    onSuccess: () => {
      toast.success('Job removed')
      queryClient.invalidateQueries({ queryKey: ['queue-jobs', queueName] })
    },
    onError: () => toast.error('Failed to remove job'),
  })

  const cleanMutation = useMutation({
    mutationFn: () => $cleanQueue({ data: { queueName, status: status as 'completed' | 'failed' } }),
    onSuccess: () => {
      toast.success(`All ${status} jobs cleaned`)
      queryClient.invalidateQueries({ queryKey: ['queue-jobs', queueName] })
    },
    onError: () => toast.error('Failed to clean jobs'),
  })

  function handleTabChange(value: string) {
    setStatus(value as QueueStatus)
    setPage(0)
  }

  const canClean = status === 'completed' || status === 'failed'
  const currentCount = counts[status] ?? 0
  const totalPages = Math.ceil(currentCount / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold capitalize">{queueName}</h1>
          {isFetching && (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          {canClean && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => cleanMutation.mutate()}
              disabled={cleanMutation.isPending || currentCount === 0}
              className="h-8"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clean all
            </Button>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <div className="px-6 pt-4 pb-2">
        <Tabs value={status} onValueChange={handleTabChange}>
          <TabsList className="h-8">
            {STATUS_TABS.map((tab) => {
              const count = counts[tab.value] ?? 0
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="text-xs gap-1.5 px-3"
                >
                  <span className={cn(
                    'text-muted-foreground',
                    tab.value === 'active' && count > 0 && 'text-blue-500',
                    tab.value === 'failed' && count > 0 && 'text-destructive',
                  )}>
                    {tab.icon}
                  </span>
                  {tab.label}
                  {count > 0 && (
                    <Badge
                      variant={tab.value === 'failed' ? 'destructive' : 'secondary'}
                      className="h-4 px-1.5 text-[10px] font-mono ml-0.5"
                    >
                      {count > 999 ? '999+' : count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Jobs table */}
      <div className="flex-1 overflow-auto px-6">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead className="w-[40%]">
                <Button variant="ghost" size="sm" className="h-6 -ml-2 text-xs font-medium">
                  Name <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-[45%]">Lifecycle</TableHead>
              <TableHead className="text-right">Options</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-12">
                  No {status} jobs in this queue
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job: JobSummary) => (
                <JobRow
                  key={job.id}
                  job={job}
                  status={status}
                  onRetry={() => retryMutation.mutate(job.id)}
                  onRemove={() => removeMutation.mutate(job.id)}
                  retrying={retryMutation.isPending && retryMutation.variables === job.id}
                  removing={removeMutation.isPending && removeMutation.variables === job.id}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border text-xs text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, currentCount)} of {currentCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

type JobRowProps = {
  job: JobSummary
  status: QueueStatus
  onRetry: () => void
  onRemove: () => void
  retrying: boolean
  removing: boolean
}

function JobRow({ job, status, onRetry, onRemove, retrying, removing }: JobRowProps) {
  return (
    <TableRow className="text-xs group">
      {/* Name */}
      <TableCell className="py-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">
            {job.name}
            <span className="text-muted-foreground font-normal ml-1.5">#{job.id}</span>
          </span>
          {job.failedReason && (
            <span className="text-destructive text-[11px] truncate max-w-xs" title={job.failedReason}>
              {job.failedReason}
            </span>
          )}
        </div>
      </TableCell>

      {/* Lifecycle timeline */}
      <TableCell className="py-2.5">
        <LifecycleTimeline job={job} status={status} />
      </TableCell>

      {/* Actions */}
      <TableCell className="py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {status === 'failed' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={onRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry job</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {status === 'failed' && (
                <DropdownMenuItem onClick={onRetry}>
                  <RotateCcw className="h-3.5 w-3.5 mr-2" />
                  Retry
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <ChevronDown className="h-3.5 w-3.5 mr-2" />
                View details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onRemove}
                disabled={removing}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}

function LifecycleTimeline({ job, status }: { job: JobSummary; status: QueueStatus }) {
  const now = Date.now()

  const events: { label: string; ts?: number; duration?: number; color?: string }[] = []

  // Created
  events.push({ label: 'created', ts: job.timestamp })

  // Wait duration (created → processed)
  if (job.processedOn && job.timestamp) {
    const waitMs = job.processedOn - job.timestamp
    events.push({ label: 'wait', duration: waitMs, color: 'text-muted-foreground' })
    events.push({ label: 'started', ts: job.processedOn })
  }

  // Process duration (processed → finished or now)
  if (job.processedOn) {
    const endTs = job.finishedOn ?? (status === 'active' ? now : undefined)
    if (endTs) {
      const processMs = endTs - job.processedOn
      events.push({ label: 'run', duration: processMs, color: status === 'failed' ? 'text-destructive' : 'text-blue-500' })
    }
    if (job.finishedOn) {
      events.push({ label: status === 'failed' ? 'failed' : 'done', ts: job.finishedOn })
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {events.map((event, i) => {
        if (event.duration !== undefined) {
          return (
            <span key={i} className={cn('font-mono text-[10px]', event.color ?? 'text-muted-foreground')}>
              {formatDuration(event.duration)}
            </span>
          )
        }
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-default">
                <LifecycleDot status={event.label} />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {formatTime(event.ts!)}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {event.label}: {new Date(event.ts!).toLocaleString()}
            </TooltipContent>
          </Tooltip>
        )
      })}

      {/* Attempts */}
      {job.attemptsMade > 1 && (
        <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono">
          {job.attemptsMade}× attempts
        </Badge>
      )}
    </div>
  )
}

function LifecycleDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    created: 'bg-muted-foreground',
    started: 'bg-blue-500',
    done: 'bg-green-500',
    failed: 'bg-destructive',
    default: 'bg-muted-foreground',
  }
  const color = colorMap[status] ?? colorMap.default
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full', color)} />
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`
}
