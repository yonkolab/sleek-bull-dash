import { useState, useRef, useId } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, Upload, X } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { Separator } from '#/components/ui/separator'
import { Badge } from '#/components/ui/badge'
import { $createConnection, $updateConnection, $testConnection, type ConnectionSummary } from '#/server/connection-fns'

type FormState = {
  name: string
  host: string
  port: string
  password: string
  db: string
  tls: boolean
  sshEnabled: boolean
  sshHost: string
  sshPort: string
  sshUsername: string
  sshPassword: string
  sshPrivateKey: string
  sshKeyType: 'pem' | 'ppk' | ''
  sshKeyFilename: string
}

type Props = {
  existing?: ConnectionSummary
}

export function ConnectionForm({ existing }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uid = useId()

  const [form, setForm] = useState<FormState>({
    name: existing?.name ?? '',
    host: existing?.host ?? 'localhost',
    port: String(existing?.port ?? 6379),
    password: '',
    db: String(existing?.db ?? 0),
    tls: existing?.tls ?? false,
    sshEnabled: existing?.sshEnabled ?? false,
    sshHost: existing?.sshHost ?? '',
    sshPort: String(existing?.sshPort ?? 22),
    sshUsername: existing?.sshUsername ?? '',
    sshPassword: '',
    sshPrivateKey: '',
    sshKeyType: (existing?.sshKeyType as 'pem' | 'ppk') ?? '',
    sshKeyFilename: existing?.hasKey ? '(key stored — upload to replace)' : '',
  })

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  function update(key: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  function handleKeyFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const keyType = file.name.toLowerCase().endsWith('.ppk') ? 'ppk' : 'pem'
      setForm((prev) => ({
        ...prev,
        sshPrivateKey: reader.result as string,
        sshKeyType: keyType,
        sshKeyFilename: file.name,
      }))
    }
    reader.readAsText(file)
  }

  function clearKey() {
    setForm((prev) => ({
      ...prev,
      sshPrivateKey: '',
      sshKeyType: '',
      sshKeyFilename: '',
    }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const createMutation = useMutation({
    mutationFn: () =>
      $createConnection({
        data: {
          name: form.name,
          host: form.host,
          port: Number(form.port) || 6379,
          password: form.password || undefined,
          db: Number(form.db) || 0,
          tls: form.tls,
          sshEnabled: form.sshEnabled,
          sshHost: form.sshEnabled ? form.sshHost : undefined,
          sshPort: form.sshEnabled ? Number(form.sshPort) || 22 : undefined,
          sshUsername: form.sshEnabled ? form.sshUsername : undefined,
          sshPassword: form.sshEnabled && form.sshPassword ? form.sshPassword : undefined,
          sshPrivateKey: form.sshEnabled && form.sshPrivateKey ? form.sshPrivateKey : undefined,
          sshKeyType: form.sshEnabled && form.sshKeyType ? form.sshKeyType : undefined,
        },
      }),
    onSuccess: () => {
      toast.success('Connection created')
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      navigate({ to: '/settings/connections' })
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      $updateConnection({
        data: {
          id: existing?.id ?? '',
          data: {
            name: form.name,
            host: form.host,
            port: Number(form.port) || 6379,
            password: form.password || undefined,
            db: Number(form.db) || 0,
            tls: form.tls,
            sshEnabled: form.sshEnabled,
            sshHost: form.sshEnabled ? form.sshHost : undefined,
            sshPort: form.sshEnabled ? Number(form.sshPort) || 22 : undefined,
            sshUsername: form.sshEnabled ? form.sshUsername : undefined,
            sshPassword: form.sshEnabled && form.sshPassword ? form.sshPassword : undefined,
            sshPrivateKey: form.sshEnabled && form.sshPrivateKey ? form.sshPrivateKey : undefined,
            sshKeyType: form.sshEnabled && form.sshKeyType ? form.sshKeyType : undefined,
          },
        },
      }),
    onSuccess: () => {
      toast.success('Connection updated')
      queryClient.invalidateQueries({ queryKey: ['connections'] })
      navigate({ to: '/settings/connections' })
    },
    onError: (err: Error) => toast.error(`Failed: ${err.message}`),
  })

  const testMutation = useMutation({
    mutationFn: () => $testConnection({ data: { id: existing?.id ?? '' } }),
    onSuccess: (result) => {
      if (result.success) {
        setTestResult({ success: true, message: `Connected! Found ${result.queuesFound} queues.` })
      } else {
        setTestResult({ success: false, message: result.error ?? 'Connection failed' })
      }
    },
    onError: (err: Error) => {
      setTestResult({ success: false, message: err.message })
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (existing) {
      updateMutation.mutate()
    } else {
      createMutation.mutate()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* Basic section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Redis Connection</h2>

        <Field label="Name" htmlFor={`${uid}-name`}>
          <Input
            id={`${uid}-name`}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Production"
            required
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Host" htmlFor={`${uid}-host`}>
              <Input
                id={`${uid}-host`}
                value={form.host}
                onChange={(e) => update('host', e.target.value)}
                placeholder="localhost"
                required
              />
            </Field>
          </div>
          <Field label="Port" htmlFor={`${uid}-port`}>
            <Input
              id={`${uid}-port`}
              type="number"
              value={form.port}
              onChange={(e) => update('port', e.target.value)}
              min={1}
              max={65535}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Password" htmlFor={`${uid}-password`}>
              <Input
                id={`${uid}-password`}
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder={existing ? '(unchanged)' : 'Optional'}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label="DB Index" htmlFor={`${uid}-db`}>
            <Input
              id={`${uid}-db`}
              type="number"
              value={form.db}
              onChange={(e) => update('db', e.target.value)}
              min={0}
              max={15}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id={`${uid}-tls`}
            checked={form.tls}
            onCheckedChange={(v) => update('tls', v)}
          />
          <Label htmlFor={`${uid}-tls`} className="text-sm cursor-pointer">
            Use TLS (SSL)
          </Label>
        </div>
      </div>

      <Separator />

      {/* SSH section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id={`${uid}-ssh`}
            checked={form.sshEnabled}
            onCheckedChange={(v) => update('sshEnabled', v)}
          />
          <Label htmlFor={`${uid}-ssh`} className="text-sm font-semibold cursor-pointer">
            SSH Tunnel
          </Label>
        </div>

        {form.sshEnabled && (
          <div className="space-y-4 pl-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="SSH Host" htmlFor={`${uid}-sshHost`}>
                  <Input
                    id={`${uid}-sshHost`}
                    value={form.sshHost}
                    onChange={(e) => update('sshHost', e.target.value)}
                    placeholder="bastion.example.com"
                  />
                </Field>
              </div>
              <Field label="SSH Port" htmlFor={`${uid}-sshPort`}>
                <Input
                  id={`${uid}-sshPort`}
                  type="number"
                  value={form.sshPort}
                  onChange={(e) => update('sshPort', e.target.value)}
                  min={1}
                  max={65535}
                />
              </Field>
            </div>

            <Field label="SSH Username" htmlFor={`${uid}-sshUsername`}>
              <Input
                id={`${uid}-sshUsername`}
                value={form.sshUsername}
                onChange={(e) => update('sshUsername', e.target.value)}
                placeholder="ubuntu"
              />
            </Field>

            <Field label="SSH Password" htmlFor={`${uid}-sshPassword`}>
              <Input
                id={`${uid}-sshPassword`}
                type="password"
                value={form.sshPassword}
                onChange={(e) => update('sshPassword', e.target.value)}
                placeholder="Optional (use key or password)"
                autoComplete="off"
              />
            </Field>

            {/* Private key upload */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">SSH Private Key (.pem / .ppk)</Label>
              {form.sshKeyFilename ? (
                <div className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30">
                  <span className="text-xs font-mono flex-1 truncate">{form.sshKeyFilename}</span>
                  {form.sshKeyType && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase shrink-0">
                      {form.sshKeyType}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={clearKey}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  Upload key file
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pem,.ppk"
                className="hidden"
                onChange={handleKeyFileChange}
              />
              <p className="text-[11px] text-muted-foreground">
                Key is encrypted server-side with AES-256-GCM and never stored in plaintext.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`text-xs p-2.5 rounded-md border ${
            testResult.success
              ? 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {existing ? 'Save changes' : 'Create connection'}
        </Button>
        {existing && (
          <Button
            type="button"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            {testMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test connection
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate({ to: '/settings/connections' })}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}
