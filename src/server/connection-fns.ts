import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '#/db'
import { encrypt } from '#/lib/crypto'
import { evictConnectionClients, getRedisClient } from '#/lib/redis'
import { closeTunnel } from '#/lib/ssh-tunnel'
import { ensureDefaultConnection } from '#/lib/ensure-default-connection'
import { resolveConnectionOptions } from '#/lib/connection-resolver'
import { discoverQueues } from '#/lib/queue'

// ─── Public type (never includes sshPrivateKey) ───────────────────────────────

export type ConnectionSummary = {
  id: string
  name: string
  host: string
  port: number
  db: number
  tls: boolean
  isDefault: boolean
  sshEnabled: boolean
  sshHost?: string
  sshPort?: number
  sshUsername?: string
  sshKeyType?: string
  hasKey: boolean
  environment?: string
  createdAt: string
}

function toSummary(conn: {
  id: string
  name: string
  host: string
  port: number
  db: number
  tls: boolean
  isDefault: boolean
  sshEnabled: boolean
  sshHost: string | null
  sshPort: number | null
  sshUsername: string | null
  sshKeyType: string | null
  sshPrivateKey: string | null
  environment: string | null
  createdAt: Date
}): ConnectionSummary {
  return {
    id: conn.id,
    name: conn.name,
    host: conn.host,
    port: conn.port,
    db: conn.db,
    tls: conn.tls,
    isDefault: conn.isDefault,
    sshEnabled: conn.sshEnabled,
    sshHost: conn.sshHost ?? undefined,
    sshPort: conn.sshPort ?? undefined,
    sshUsername: conn.sshUsername ?? undefined,
    sshKeyType: conn.sshKeyType ?? undefined,
    hasKey: conn.sshPrivateKey !== null,
    environment: conn.environment ?? undefined,
    createdAt: conn.createdAt.toISOString(),
  }
}

// ─── List ──────────────────────────────────────────────────────────────────────

export const $getConnections = createServerFn({ method: 'GET' }).handler(async () => {
  await ensureDefaultConnection()
  const conns = await prisma.connection.findMany({ orderBy: { createdAt: 'asc' } })
  return conns.map(toSummary)
})

// ─── Create ────────────────────────────────────────────────────────────────────

const ConnectionInput = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).default(0),
  tls: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  sshEnabled: z.boolean().default(false),
  sshHost: z.string().optional(),
  sshPort: z.number().int().optional(),
  sshUsername: z.string().optional(),
  sshPassword: z.string().optional(),
  sshPrivateKey: z.string().optional(), // plaintext from file upload; encrypted server-side
  sshKeyType: z.enum(['pem', 'ppk']).optional(),
  environment: z.string().optional(),
})

export const $createConnection = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => ConnectionInput.parse(data))
  .handler(async ({ data }) => {
    const encryptedKey = data.sshPrivateKey ? encrypt(data.sshPrivateKey) : null
    const conn = await prisma.connection.create({
      data: {
        name: data.name,
        host: data.host,
        port: data.port,
        password: data.password ?? null,
        db: data.db,
        tls: data.tls,
        isDefault: data.isDefault,
        sshEnabled: data.sshEnabled,
        sshHost: data.sshHost ?? null,
        sshPort: data.sshPort ?? null,
        sshUsername: data.sshUsername ?? null,
        sshPassword: data.sshPassword ?? null,
        sshPrivateKey: encryptedKey,
        sshKeyType: data.sshKeyType ?? null,
        environment: data.environment ?? null,
      },
    })
    return toSummary(conn)
  })

// ─── Update ────────────────────────────────────────────────────────────────────

export const $updateConnection = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), data: ConnectionInput.partial() }).parse(data),
  )
  .handler(async ({ data: { id, data: updates } }) => {
    // Encrypt new SSH key only if one was provided
    const encryptedKey =
      updates.sshPrivateKey !== undefined
        ? updates.sshPrivateKey
          ? encrypt(updates.sshPrivateKey)
          : null
        : undefined

    const conn = await prisma.connection.update({
      where: { id },
      data: {
        ...updates,
        sshPrivateKey: encryptedKey,
      },
    })

    // Evict cached clients and tunnels so next use picks up new config
    evictConnectionClients(id)
    closeTunnel(id)

    return toSummary(conn)
  })

// ─── Delete ────────────────────────────────────────────────────────────────────

export const $deleteConnection = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    evictConnectionClients(data.id)
    closeTunnel(data.id)
    await prisma.connection.delete({ where: { id: data.id } })
    return { success: true }
  })

// ─── Test ──────────────────────────────────────────────────────────────────────

export const $testConnection = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const conn = await prisma.connection.findUniqueOrThrow({ where: { id: data.id } })
    try {
      const opts = await resolveConnectionOptions(conn)
      const queues = await discoverQueues(conn.id, opts)
      return { success: true as const, queuesFound: queues.length }
    } catch (err: unknown) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

// ─── Search Redis Keys (for Ctrl+K palette) ────────────────────────────────────

export const $searchKeys = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) =>
    z.object({
      connectionId: z.string(),
      pattern: z.string().default('*'),
      count: z.number().int().min(1).max(100).default(20),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const conn = await prisma.connection.findUniqueOrThrow({ where: { id: data.connectionId } })
    const opts = await resolveConnectionOptions(conn)
    const redis = getRedisClient(conn.id, opts)

    const [, keys] = await redis.scan('0', 'MATCH', data.pattern, 'COUNT', data.count * 5)
    const limited = keys.slice(0, data.count)

    const results = await Promise.all(
      limited.map(async (key) => {
        const [type, ttl] = await Promise.all([redis.type(key), redis.ttl(key)])
        return { key, type, ttl }
      }),
    )

    return results
  })
