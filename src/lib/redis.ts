import IORedis from 'ioredis'

export type ConnectionOptions = {
  host: string
  port: number
  password?: string
  db?: number
  tls?: boolean
}

export type RedisClient = {
  keys: (pattern: string) => Promise<string[]>
  scan: (cursor: string, matchOption: 'MATCH', pattern: string, countOption: 'COUNT', count: number) => Promise<[string, string[]]>
  type: (key: string) => Promise<string>
  ttl: (key: string) => Promise<number>
  quit: () => Promise<void>
}

declare global {
  var __redisClients: Map<string, RedisClient> | undefined
}

function getStore(): Map<string, RedisClient> {
  globalThis.__redisClients ??= new Map()
  return globalThis.__redisClients
}

export function getRedisClient(connectionId: string, opts: ConnectionOptions): RedisClient {
  const store = getStore()
  if (!store.has(connectionId)) {
    const client = new IORedis({
      host: opts.host,
      port: opts.port,
      password: opts.password,
      db: opts.db ?? 0,
      tls: opts.tls ? {} : undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    }) as unknown as RedisClient
    store.set(connectionId, client)
  }
  // biome-ignore lint/style/noNonNullAssertion: guaranteed by .has() check above
  return store.get(connectionId)!
}

/**
 * Returns plain connection options for BullMQ (avoids ioredis version conflicts).
 * BullMQ accepts these and uses its own bundled ioredis internally.
 */
export function getBullMQConnection(opts: ConnectionOptions) {
  return {
    host: opts.host,
    port: opts.port,
    password: opts.password,
    db: opts.db ?? 0,
    tls: opts.tls ? {} : undefined,
    maxRetriesPerRequest: null as null,
  }
}

/**
 * Removes cached clients for a connection (call when editing or deleting a connection).
 */
export function evictConnectionClients(connectionId: string): void {
  const store = getStore()
  const client = store.get(connectionId)
  if (client) {
    client.quit().catch(() => {})
    store.delete(connectionId)
  }
}

/**
 * Parses REDIS_URL into ConnectionOptions (used only for seeding the default connection).
 */
export function getDefaultConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: Number(parsed.pathname.slice(1)) || 0,
    }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}
