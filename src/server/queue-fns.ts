import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/db'
import { resolveConnectionOptions } from '#/lib/connection-resolver'
import {
  discoverQueues,
  getQueueCounts,
  getQueueJobs,
  getQueue,
  retryJob,
  removeJob,
  cleanQueue,
  pauseQueue,
  resumeQueue,
  isPaused,
  retryAllFailed,
  type QueueStatus,
} from '#/lib/queue'

// ─── Helper ────────────────────────────────────────────────────────────────────

async function getConnectionOpts(connectionId: string) {
  const conn = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } })
  const opts = await resolveConnectionOptions(conn)
  return { conn, opts }
}

// ─── Queue list ────────────────────────────────────────────────────────────────

export const $getQueues = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => z.object({ connectionId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    const names = await discoverQueues(conn.id, opts)
    const queuesWithCounts = await Promise.all(
      names.map(async (name) => {
        const counts = await getQueueCounts(conn.id, opts, name)
        const paused = await isPaused(conn.id, opts, name)
        return { name, counts, paused }
      }),
    )
    return queuesWithCounts
  })

// ─── Job list ─────────────────────────────────────────────────────────────────

const QueueJobsInput = z.object({
  connectionId: z.string(),
  queueName: z.string(),
  status: z.enum(['completed', 'failed', 'active', 'waiting', 'delayed', 'paused']),
  start: z.number().default(0),
  end: z.number().default(49),
})

export const $getQueueJobs = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => QueueJobsInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    const jobs = await getQueueJobs(
      conn.id,
      opts,
      data.queueName,
      data.status as QueueStatus,
      data.start,
      data.end,
    )
    const counts = await getQueueCounts(conn.id, opts, data.queueName)
    return { jobs, counts }
  })

// ─── Job detail (includes data + returnvalue for JSON editor) ─────────────────

export const $getJobDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({ connectionId: z.string(), queueName: z.string(), jobId: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    const queue = getQueue(conn.id, opts, data.queueName)
    const job = await queue.getJob(data.jobId)
    if (!job) throw new Error(`Job ${data.jobId} not found`)
    // Serialize data/returnvalue as JSON strings to avoid TanStack serialization type errors
    return {
      id: String(job.id),
      name: job.name,
      data: JSON.stringify(job.data ?? null),
      returnvalue: JSON.stringify(job.returnvalue ?? null),
      failedReason: job.failedReason ?? null,
      stacktrace: job.stacktrace ?? [],
      opts: {
        attempts: job.opts.attempts ?? 1,
        delay: job.opts.delay ?? 0,
        priority: job.opts.priority ?? 0,
      },
      timestamp: job.timestamp,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      attemptsMade: job.attemptsMade,
    }
  })

// ─── Job actions ──────────────────────────────────────────────────────────────

const JobActionInput = z.object({
  connectionId: z.string(),
  queueName: z.string(),
  jobId: z.string(),
})

export const $retryJob = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => JobActionInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    await retryJob(conn.id, opts, data.queueName, data.jobId)
    return { success: true }
  })

export const $removeJob = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => JobActionInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    await removeJob(conn.id, opts, data.queueName, data.jobId)
    return { success: true }
  })

// ─── Queue actions ────────────────────────────────────────────────────────────

const CleanQueueInput = z.object({
  connectionId: z.string(),
  queueName: z.string(),
  status: z.enum(['completed', 'failed']),
})

export const $cleanQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => CleanQueueInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    await cleanQueue(conn.id, opts, data.queueName, data.status)
    return { success: true }
  })

const QueueNameInput = z.object({ connectionId: z.string(), queueName: z.string() })

export const $pauseQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => QueueNameInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    await pauseQueue(conn.id, opts, data.queueName)
    return { success: true }
  })

export const $resumeQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => QueueNameInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    await resumeQueue(conn.id, opts, data.queueName)
    return { success: true }
  })

export const $retryAllFailed = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => QueueNameInput.parse(data))
  .handler(async ({ data }) => {
    const { conn, opts } = await getConnectionOpts(data.connectionId)
    await retryAllFailed(conn.id, opts, data.queueName)
    return { success: true }
  })
