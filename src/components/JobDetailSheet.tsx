import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '#/components/ui/sheet'
import { Badge } from '#/components/ui/badge'
import { Separator } from '#/components/ui/separator'
import { Skeleton } from '#/components/ui/skeleton'
import { $getJobDetail } from '#/server/queue-fns'
import { useTheme } from '#/lib/theme'

// Monaco loads itself async — lazy import only for tree-shaking, not for code splitting necessity
const Editor = lazy(() => import('@monaco-editor/react'))

type JobDetail = Awaited<ReturnType<typeof $getJobDetail>>

type Props = {
  open: boolean
  onClose: () => void
  connectionId: string
  queueName: string
  jobId: string | null
}

export function JobDetailSheet({ open, onClose, connectionId, queueName, jobId }: Props) {
  const { theme } = useTheme()
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'light'

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['job-detail', connectionId, queueName, jobId],
    queryFn: () =>
      $getJobDetail({ data: { connectionId, queueName, jobId: jobId! } }),
    enabled: open && jobId !== null,
  })

  // Parse JSON strings from server (data/returnvalue serialized to avoid TanStack type constraints)
  const data: (JobDetail & { parsedData: unknown; parsedReturnvalue: unknown }) | undefined = rawData
    ? {
        ...rawData,
        parsedData: (() => { try { return JSON.parse(rawData.data) } catch { return null } })(),
        parsedReturnvalue: (() => { try { return JSON.parse(rawData.returnvalue) } catch { return null } })(),
      }
    : undefined

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[540px] sm:max-w-[540px] overflow-y-auto flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold">
            {data ? (
              <span>
                {data.name}{' '}
                <span className="text-muted-foreground font-normal">#{data.id}</span>
              </span>
            ) : (
              'Job Detail'
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data ? (
          <div className="flex flex-col gap-4 p-5 overflow-y-auto">
            {/* Metadata */}
            <Section title="Metadata">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <MetaRow label="Status">
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {data.finishedOn ? (data.failedReason ? 'failed' : 'completed') : 'active'}
                  </Badge>
                </MetaRow>
                <MetaRow label="Attempts">
                  {data.attemptsMade} / {data.opts.attempts}
                </MetaRow>
                {data.opts.delay > 0 && (
                  <MetaRow label="Delay">{data.opts.delay}ms</MetaRow>
                )}
                {data.opts.priority > 0 && (
                  <MetaRow label="Priority">{data.opts.priority}</MetaRow>
                )}
                <MetaRow label="Created">
                  {new Date(data.timestamp).toLocaleString()}
                </MetaRow>
                {data.processedOn && (
                  <MetaRow label="Started">
                    {new Date(data.processedOn).toLocaleString()}
                  </MetaRow>
                )}
                {data.finishedOn && (
                  <MetaRow label="Finished">
                    {new Date(data.finishedOn).toLocaleString()}
                  </MetaRow>
                )}
              </div>
            </Section>

            {/* Input data */}
            {data.parsedData !== undefined && data.parsedData !== null && (
              <Section title="Input Data">
                <MonacoJson value={data.parsedData} theme={monacoTheme} />
              </Section>
            )}

            {/* Return value */}
            {data.parsedReturnvalue !== undefined && data.parsedReturnvalue !== null && (
              <Section title="Return Value">
                <MonacoJson value={data.parsedReturnvalue} theme={monacoTheme} />
              </Section>
            )}

            {/* Error */}
            {data.failedReason && (
              <Section title="Error">
                <p className="text-xs text-destructive font-mono break-all bg-destructive/5 p-2 rounded-md">
                  {data.failedReason}
                </p>
                {data.stacktrace.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-2 mb-1 font-medium">Stacktrace</p>
                    <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48 bg-muted/40 p-2 rounded-md font-mono leading-relaxed">
                      {data.stacktrace.join('\n')}
                    </pre>
                  </>
                )}
              </Section>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <Separator className="flex-1" />
      </div>
      {children}
    </div>
  )
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-mono">{children}</span>
    </>
  )
}

function MonacoJson({ value, theme }: { value: unknown; theme: string }) {
  const json = JSON.stringify(value, null, 2)
  return (
    <div className="rounded-md overflow-hidden border border-border">
      <Suspense
        fallback={
          <div className="h-[160px] bg-muted/30 flex items-center justify-center">
            <Skeleton className="h-4 w-24" />
          </div>
        }
      >
        <Editor
          height="160px"
          defaultLanguage="json"
          value={json}
          theme={theme}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            lineNumbers: 'off',
            folding: true,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
          }}
        />
      </Suspense>
    </div>
  )
}
