import { createFileRoute } from '@tanstack/react-router'
import { Layers } from 'lucide-react'

export const Route = createFileRoute('/_dashboard/')({
  component: DashboardIndex,
})

function DashboardIndex() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <Layers className="h-10 w-10 opacity-20" />
      <div className="text-center">
        <p className="text-sm font-medium">No queue selected</p>
        <p className="text-xs mt-1">Pick a queue from the sidebar to view its jobs</p>
      </div>
    </div>
  )
}
