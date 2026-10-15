'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { signOutEverywhere } from '@/actions/account'
import { ConfirmDelete } from '@/components/forms/ConfirmDelete'
import { Button } from '@/components/ui/button'

export function SignOutEverywhere() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <LogOut />
        Sign out on all devices
      </Button>
      <ConfirmDelete
        open={open}
        onOpenChange={setOpen}
        title="Sign out on all devices?"
        description="You will be signed out here and on every other phone or computer. Use this if you signed in on a shared device or think someone else knows your password."
        confirmLabel="Sign out everywhere"
        successMessage="Signed out"
        // Redirects to /login on success, so this only returns on failure.
        onConfirm={async () => {
          await signOutEverywhere()
          return { ok: true }
        }}
      />
    </>
  )
}
