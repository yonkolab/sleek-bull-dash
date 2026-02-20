import { Client } from 'ssh2'
import * as net from 'node:net'
import { decrypt } from '#/lib/crypto'

type TunnelStatus = 'connecting' | 'ready' | 'error'

type TunnelState = {
  localPort: number
  client: Client
  server: net.Server | null
  status: TunnelStatus
  error?: Error
  readyPromise: Promise<void>
  resolveReady: () => void
  rejectReady: (err: Error) => void
}

export type SshTunnelConfig = {
  sshHost: string
  sshPort: number
  sshUsername: string
  sshPassword?: string
  sshPrivateKeyEncrypted?: string
  sshKeyType?: 'pem' | 'ppk'
  targetHost: string
  targetPort: number
}

declare global {
  var __sshTunnels: Map<string, TunnelState> | undefined
}

function getStore(): Map<string, TunnelState> {
  globalThis.__sshTunnels ??= new Map()
  return globalThis.__sshTunnels
}

function allocatePort(): number {
  return 20000 + Math.floor(Math.random() * 10000)
}

export async function getTunnelLocalPort(
  connectionId: string,
  config: SshTunnelConfig,
): Promise<number> {
  const store = getStore()
  const state = store.get(connectionId)

  if (state?.status === 'ready') return state.localPort
  if (state?.status === 'connecting') {
    await state.readyPromise
    return state.localPort
  }

  // Clean up stale error state
  if (state) {
    state.client.end()
    state.server?.close()
    store.delete(connectionId)
  }

  return createTunnel(connectionId, config, store)
}

async function createTunnel(
  connectionId: string,
  config: SshTunnelConfig,
  store: Map<string, TunnelState>,
): Promise<number> {
  const localPort = allocatePort()

  let resolveReady!: () => void
  let rejectReady!: (err: Error) => void
  const readyPromise = new Promise<void>((res, rej) => {
    resolveReady = res
    rejectReady = rej
  })

  const sshClient = new Client()
  const state: TunnelState = {
    localPort,
    client: sshClient,
    server: null,
    status: 'connecting',
    readyPromise,
    resolveReady,
    rejectReady,
  }
  store.set(connectionId, state)

  let privateKey: string | undefined
  if (config.sshPrivateKeyEncrypted) {
    try {
      privateKey = decrypt(config.sshPrivateKeyEncrypted)
    } catch {
      const err = new Error('Failed to decrypt SSH private key')
      state.status = 'error'
      state.error = err
      rejectReady(err)
      store.delete(connectionId)
      throw err
    }
  }

  sshClient.on('ready', () => {
    const server = net.createServer((localSocket) => {
      sshClient.forwardOut(
        '127.0.0.1',
        localPort,
        config.targetHost,
        config.targetPort,
        (err, stream) => {
          if (err) {
            localSocket.destroy()
            return
          }
          localSocket.pipe(stream).pipe(localSocket)
          stream.on('close', () => localSocket.destroy())
          localSocket.on('close', () => stream.destroy())
        },
      )
    })

    server.listen(localPort, '127.0.0.1', () => {
      state.server = server
      state.status = 'ready'
      resolveReady()
    })

    server.on('error', (err: Error) => {
      state.status = 'error'
      state.error = err
      rejectReady(err)
    })
  })

  sshClient.on('error', (err) => {
    state.status = 'error'
    state.error = err
    rejectReady(err)
    store.delete(connectionId)
  })

  sshClient.on('close', () => {
    if (state.status === 'ready') {
      state.status = 'error'
      state.server?.close()
      store.delete(connectionId)
    }
  })

  sshClient.connect({
    host: config.sshHost,
    port: config.sshPort,
    username: config.sshUsername,
    password: config.sshPassword,
    privateKey: privateKey,
    readyTimeout: 15000,
  })

  await readyPromise
  return localPort
}

export function closeTunnel(connectionId: string): void {
  const store = getStore()
  const state = store.get(connectionId)
  if (state) {
    state.client.end()
    state.server?.close()
    store.delete(connectionId)
  }
}

export function getTunnelStatus(connectionId: string): TunnelStatus | 'none' {
  return getStore().get(connectionId)?.status ?? 'none'
}
