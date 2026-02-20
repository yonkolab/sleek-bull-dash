import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    SERVER_URL: z.string().url().optional(),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    BULLMQ_QUEUES: z.string().optional(),
    DATABASE_URL: z.string().default('file:./dev.db'),
    BETTER_AUTH_SECRET: z.string().min(1).optional(),
  },

  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
  },

  runtimeEnv: {
    ...import.meta.env,
    REDIS_URL: process.env.REDIS_URL,
    BULLMQ_QUEUES: process.env.BULLMQ_QUEUES,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  },

  emptyStringAsUndefined: true,
})
