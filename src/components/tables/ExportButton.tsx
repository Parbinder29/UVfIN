'use client'

import { useTransition } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { downloadCSV } from '@/lib/csv'
import type { ActionResult } from '@/types'

/** Exports every row matching the current filters, generated on the server. */
export function ExportButton({
  filename,
  action,
}: {
  filename: string
  action: (params: Record<string, string>) => Promise<ActionResult<string>>
}) {
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const params = Object.fromEntries(searchParams.entries())
          delete params.page
          const result = await action(params)
          if (!result.ok || !result.data) {
            toast.error(result.ok ? 'Nothing to export.' : result.error)
            return
          }
          const today = new Date().toISOString().slice(0, 10)
          downloadCSV(result.data, `uvfin-${filename}-${today}.csv`)
          toast.success('CSV downloaded')
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Download />}
      Export CSV
    </Button>
  )
}
