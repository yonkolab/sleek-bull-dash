import { Queue, type Job, type JobType } from 'bullmq'
import { getRedisClient, getBullMQConnection, type ConnectionOptions } from '#/lib/redis'

// Two-level cache: connectionId → queueName → Queue instance
declare global {
  var __queueCaches: Map<string, Map<string, Queue>> | undefined
}

function getQueueStore(connectionId: string): Map<string, Queue> {
  globalThis.__queueCaches ??= new Map()
  if (!globalThis.__queueCaches.has(connectionId)) {
    globalThis.__queueCaches.set(connectionId, new Map())
  }
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by .has() check above
  return globalThis.__queueCaches.get(connectionId)!
}

export function getQueue(connectionId: string, opts: ConnectionOptions, name: string): Queue {
  const store = getQueueStore(connectionId)
  if (!store.has(name)) {
    store.set(
      name,
      new Queue(name, {
        connection: getBullMQConnection(opts),
      }),
    )
  }
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by .has() check above
  return store.get(name)!
}

export type QueueStatus = 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' | 'paused'

export type JobSummary = {
  id: string
  name: string
  status: QueueStatus
  timestamp: number
  processedOn?: number
  finishedOn?: number
  failedReason?: string
  attemptsMade: number
  maxAttempts: number
  stacktrace?: string[]
}

export type QueueCounts = {
  active: number
  completed: number
  failed: number
  delayed: number
  waiting: number
  paused: number
}

function jobToSummary(job: Job, status: QueueStatus): JobSummary {
  return {
    id: String(job.id),
    name: job.name,
    status,
    timestamp: job.timestamp,
    processedOn: job.processedOn ?? undefined,
    finishedOn: job.finishedOn ?? undefined,
    failedReason: job.failedReason ?? undefined,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 1,
    stacktrace: job.stacktrace?.length ? job.stacktrace : undefined,
  }
}

export async function discoverQueues(connectionId: string, opts: ConnectionOptions): Promise<string[]> {
  const configured = process.env.BULLMQ_QUEUES
  if (configured?.trim()) {
    return configured
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean)
  }

  const redis = getRedisClient(connectionId, opts)
  const keys = await redis.keys('*:meta')
  const names = new Set<string>()

  for (const key of keys) {
    const match = key.match(/(?:\{bull:|bull:)([^}:]+)(?:\})?:meta$/)
    if (match?.[1]) names.add(match[1])
  }

  return [...names].sort()
}

export async function getQueueCounts(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
): Promise<QueueCounts> {
  const queue = getQueue(connectionId, opts, queueName)
  return queue.getJobCounts(
    'active',
    'completed',
    'failed',
    'delayed',
    'waiting',
    'paused',
  ) as Promise<QueueCounts>
}

export async function getQueueJobs(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
  status: QueueStatus,
  start = 0,
  end = 49,
): Promise<JobSummary[]> {
  const queue = getQueue(connectionId, opts, queueName)
  const jobTypes: JobType[] = [status as JobType]
  const jobs = await queue.getJobs(jobTypes, start, end, true)
  return jobs.map((job) => jobToSummary(job, status))
}

export async function retryJob(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
  jobId: string,
): Promise<void> {
  const queue = getQueue(connectionId, opts, queueName)
  const job = await queue.getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found in queue ${queueName}`)
  await job.retry()
}

export async function removeJob(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
  jobId: string,
): Promise<void> {
  const queue = getQueue(connectionId, opts, queueName)
  const job = await queue.getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found in queue ${queueName}`)
  await job.remove()
}

export async function cleanQueue(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
  status: 'completed' | 'failed',
): Promise<void> {
  const queue = getQueue(connectionId, opts, queueName)
  await queue.clean(0, 1000, status)
}

export async function pauseQueue(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
): Promise<void> {
  await getQueue(connectionId, opts, queueName).pause()
}

export async function resumeQueue(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
): Promise<void> {
  await getQueue(connectionId, opts, queueName).resume()
}

export async function isPaused(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
): Promise<boolean> {
  return getQueue(connectionId, opts, queueName).isPaused()
}

export async function retryAllFailed(
  connectionId: string,
  opts: ConnectionOptions,
  queueName: string,
): Promise<void> {
  const queue = getQueue(connectionId, opts, queueName)
  await queue.retryJobs({ count: 1000, state: 'failed' })
}
