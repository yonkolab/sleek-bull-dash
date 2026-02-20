import { prisma } from '#/db'

declare global {
  var __defaultConnectionEnsured: boolean | undefined
}

/**
 * Creates a default Connection from REDIS_URL on first server startup
 * if none exists. Called lazily by server functions that need connections.
 */
export async function ensureDefaultConnection(): Promise<void> {
  if (globalThis.__defaultConnectionEnsured) return

  const existing = await prisma.connection.findFirst({ where: { isDefault: true } })
  if (!existing) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
    try {
      const parsed = new URL(url)
      await prisma.connection.create({
        data: {
          name: 'Default',
          host: parsed.hostname || 'localhost',
          port: Number(parsed.port) || 6379,
          password: parsed.password || null,
          db: Number(parsed.pathname.slice(1)) || 0,
          tls: false,
          isDefault: true,
        },
      })
    } catch {
      // If URL parsing fails, use plain localhost defaults
      await prisma.connection.create({
        data: {
          name: 'Default',
          host: 'localhost',
          port: 6379,
          db: 0,
          tls: false,
          isDefault: true,
        },
      })
    }
  }

  globalThis.__defaultConnectionEnsured = true
}
