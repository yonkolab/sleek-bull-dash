import { getTunnelLocalPort, type SshTunnelConfig } from '#/lib/ssh-tunnel'

export type ConnectionOptions = {
  host: string
  port: number
  password?: string
  db?: number
  tls?: boolean
}

type ConnectionRow = {
  id: string
  host: string
  port: number
  password: string | null
  db: number
  tls: boolean
  sshEnabled: boolean
  sshHost: string | null
  sshPort: number | null
  sshUsername: string | null
  sshPassword: string | null
  sshPrivateKey: string | null
  sshKeyType: string | null
}

/**
 * Resolves a DB Connection row into live ConnectionOptions.
 * If SSH is enabled, starts or reuses a tunnel and returns the local port.
 */
export async function resolveConnectionOptions(conn: ConnectionRow): Promise<ConnectionOptions> {
  if (!conn.sshEnabled) {
    return {
      host: conn.host,
      port: conn.port,
      password: conn.password ?? undefined,
      db: conn.db,
      tls: conn.tls,
    }
  }

  if (!conn.sshHost || !conn.sshUsername) {
    throw new Error(`Connection "${conn.id}": sshHost and sshUsername are required when SSH is enabled`)
  }

  const config: SshTunnelConfig = {
    sshHost: conn.sshHost,
    sshPort: conn.sshPort ?? 22,
    sshUsername: conn.sshUsername,
    sshPassword: conn.sshPassword ?? undefined,
    sshPrivateKeyEncrypted: conn.sshPrivateKey ?? undefined,
    sshKeyType: (conn.sshKeyType as 'pem' | 'ppk') ?? undefined,
    targetHost: conn.host,
    targetPort: conn.port,
  }

  const localPort = await getTunnelLocalPort(conn.id, config)

  return {
    host: '127.0.0.1',
    port: localPort,
    password: conn.password ?? undefined,
    db: conn.db,
    tls: false, // tunnel is unencrypted locally
  }
}
