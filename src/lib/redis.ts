// Use BullMQ's bundled ioredis for direct Redis operations
// to avoid version conflicts between our ioredis and BullMQ's.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const IORedis = require('bullmq/node_modules/ioredis')

type RedisClient = {
  keys: (pattern: string) => Promise<string[]>
  quit: () => Promise<void>
}

declare global {
  // biome-ignore lint/style/noVar: global augmentation required
  var __redisClient: RedisClient | undefined
}

export function getRedisClient(): RedisClient {
  if (!globalThis.__redisClient) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
    // biome-ignore lint/suspicious/noExplicitAny: dynamic require
    globalThis.__redisClient = new (IORedis as any)(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    }) as RedisClient
  }
  return globalThis.__redisClient
}

/**
 * Returns plain connection options for BullMQ (avoids ioredis version conflicts).
 * BullMQ accepts these and uses its own bundled ioredis internally.
 */
export function getBullMQConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: Number(parsed.pathname.slice(1)) || 0,
      maxRetriesPerRequest: null as null,
    }
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null as null }
  }
}
