'use client'

import { useTransition } from 'react'
import { Loader2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { getAttachmentUrl } from '@/actions/attachments'
import { Button } from '@/components/ui/button'

/** Opens a private attachment through a 60-second signed link. */
export function AttachmentLink({ path }: { path: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="View attachment"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Open the tab synchronously so pop-up blockers allow it.
          const tab = window.open('about:blank', '_blank')
          const result = await getAttachmentUrl(path)
          if (result.ok && result.data && tab) {
            tab.opener = null
            tab.location.href = result.data
          } else {
            tab?.close()
            toast.error(result.ok ? 'Could not open the attachment.' : result.error)
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Paperclip />}
    </Button>
  )
}
