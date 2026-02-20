import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  discoverQueues,
  getQueueCounts,
  getQueueJobs,
  retryJob,
  removeJob,
  cleanQueue,
  pauseQueue,
  resumeQueue,
  isPaused,
  type QueueStatus,
} from '#/lib/queue'

export const $getQueues = createServerFn({ method: 'GET' }).handler(async () => {
  const names = await discoverQueues()
  const queuesWithCounts = await Promise.all(
    names.map(async (name) => {
      const counts = await getQueueCounts(name)
      const paused = await isPaused(name)
      return { name, counts, paused }
    }),
  )
  return queuesWithCounts
})

const QueueJobsInput = z.object({
  queueName: z.string(),
  status: z.enum(['completed', 'failed', 'active', 'waiting', 'delayed', 'paused']),
  start: z.number().default(0),
  end: z.number().default(49),
})

export const $getQueueJobs = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => QueueJobsInput.parse(data))
  .handler(async ({ data }) => {
    const jobs = await getQueueJobs(data.queueName, data.status as QueueStatus, data.start, data.end)
    const counts = await getQueueCounts(data.queueName)
    return { jobs, counts }
  })

const JobActionInput = z.object({
  queueName: z.string(),
  jobId: z.string(),
})

export const $retryJob = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => JobActionInput.parse(data))
  .handler(async ({ data }) => {
    await retryJob(data.queueName, data.jobId)
    return { success: true }
  })

export const $removeJob = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => JobActionInput.parse(data))
  .handler(async ({ data }) => {
    await removeJob(data.queueName, data.jobId)
    return { success: true }
  })

const CleanQueueInput = z.object({
  queueName: z.string(),
  status: z.enum(['completed', 'failed']),
})

export const $cleanQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => CleanQueueInput.parse(data))
  .handler(async ({ data }) => {
    await cleanQueue(data.queueName, data.status)
    return { success: true }
  })

export const $pauseQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ queueName: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await pauseQueue(data.queueName)
    return { success: true }
  })

export const $resumeQueue = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ queueName: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await resumeQueue(data.queueName)
    return { success: true }
  })
