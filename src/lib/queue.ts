import { Queue, type Job, type JobType } from 'bullmq' // Job used in jobToSummary
import { getRedisClient, getBullMQConnection } from '#/lib/redis'

// Cache queue instances — same connection options, new Queue per name
const queueCache = new Map<string, Queue>()

export function getQueue(name: string): Queue {
  if (!queueCache.has(name)) {
    queueCache.set(
      name,
      new Queue(name, {
        connection: getBullMQConnection(),
      }),
    )
  }
  return queueCache.get(name)!
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

// Discover queues by scanning Redis for BullMQ meta keys
export async function discoverQueues(): Promise<string[]> {
  const configured = process.env.BULLMQ_QUEUES
  if (configured?.trim()) {
    return configured
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean)
  }

  const redis = getRedisClient()
  const keys = await redis.keys('*:meta')
  const names = new Set<string>()

  for (const key of keys) {
    const match = key.match(/(?:\{bull:|bull:)([^}:]+)(?:\})?:meta$/)
    if (match?.[1]) names.add(match[1])
  }

  return [...names].sort()
}

export async function getQueueCounts(queueName: string): Promise<QueueCounts> {
  const queue = getQueue(queueName)
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
  queueName: string,
  status: QueueStatus,
  start = 0,
  end = 49,
): Promise<JobSummary[]> {
  const queue = getQueue(queueName)
  const jobTypes: JobType[] = [status as JobType]
  const jobs = await queue.getJobs(jobTypes, start, end, true)
  return jobs.map((job) => jobToSummary(job, status))
}

export async function retryJob(queueName: string, jobId: string): Promise<void> {
  const queue = getQueue(queueName)
  const job = await queue.getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found in queue ${queueName}`)
  await job.retry()
}

export async function removeJob(queueName: string, jobId: string): Promise<void> {
  const queue = getQueue(queueName)
  const job = await queue.getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found in queue ${queueName}`)
  await job.remove()
}

export async function cleanQueue(
  queueName: string,
  status: 'completed' | 'failed',
): Promise<void> {
  const queue = getQueue(queueName)
  await queue.clean(0, 1000, status)
}

export async function pauseQueue(queueName: string): Promise<void> {
  await getQueue(queueName).pause()
}

export async function resumeQueue(queueName: string): Promise<void> {
  await getQueue(queueName).resume()
}

export async function isPaused(queueName: string): Promise<boolean> {
  return getQueue(queueName).isPaused()
}
