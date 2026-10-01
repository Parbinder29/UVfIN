'use client'

import { useState, useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { attachLedgerFile, saveLedgerEntry } from '@/actions/ledger'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PAYMENT_METHODS } from '@/lib/constants'
import { todayInTz } from '@/lib/dates'
import type { LedgerRow } from '@/lib/ledger'
import { earningSchema, expenseSchema } from '@/lib/validators'
import { checkAttachment, uploadAttachment } from './upload'

const NONE = '__none__'

export interface LedgerFormConfig {
  key: 'expenses' | 'earnings'
  singular: string
  dateCol: string
  kindCol: string
  kindLabel: string
  kinds: readonly string[]
  partyCol: string
  partyLabel: string
  partyRequired: boolean
}

type Values = Record<string, string>

export function LedgerFormDialog({
  cfg,
  row,
  open,
  onOpenChange,
}: {
  cfg: LedgerFormConfig
  row?: LedgerRow
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const resolver = (cfg.key === 'expenses' ? zodResolver(expenseSchema) : zodResolver(earningSchema)) as unknown as Resolver<Values>

  const defaults: Values = {
    [cfg.dateCol]: row?.date ?? todayInTz(),
    amount: row ? String(row.amount) : '',
    [cfg.kindCol]: row?.kind ?? '',
    [cfg.partyCol]: row?.party ?? '',
    description: row?.description ?? '',
    payment_method: row?.payment_method ?? '',
    reference_no: row?.reference_no ?? '',
  }

  const form = useForm<Values>({
    resolver,
    defaultValues: defaults,
  })

  const close = (next: boolean) => {
    if (!next) {
      form.reset(defaults)
      setFile(null)
      setFileError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = (values: Values) => {
    startTransition(async () => {
      const result = await saveLedgerEntry(cfg.key, row?.id ?? null, values)
      if (!result.ok) {
        Object.entries(result.fieldErrors ?? {}).forEach(([name, msgs]) => {
          if (msgs?.[0]) form.setError(name, { message: msgs[0] })
        })
        toast.error(result.error)
        return
      }
      if (file && result.data) {
        try {
          const path = await uploadAttachment(cfg.key, result.data, file)
          const linked = await attachLedgerFile(cfg.key, result.data, path)
          if (!linked.ok) throw new Error(linked.error)
        } catch (e) {
          toast.warning(`${cfg.singular} saved, but the attachment failed: ${(e as Error).message}`)
          close(false)
          return
        }
      }
      toast.success(row ? `${cfg.singular} updated` : `${cfg.singular} added`)
      close(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${cfg.singular.toLowerCase()}` : `Add ${cfg.singular.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Fields marked * are required. Every change is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <FormField
              control={form.control}
              name={cfg.dateCol}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={cfg.kindCol}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{cfg.kindLabel} *</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Choose ${cfg.kindLabel.toLowerCase()}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cfg.kinds.map((k) => (
                        <SelectItem key={k} value={k}>
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={cfg.partyCol}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {cfg.partyLabel}
                    {cfg.partyRequired && ' *'}
                  </FormLabel>
                  <FormControl>
                    <Input maxLength={200} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment method</FormLabel>
                  <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? '' : v)}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>Not specified</SelectItem>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reference_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference no.</FormLabel>
                  <FormControl>
                    <Input maxLength={100} placeholder="Invoice / UTR / cheque no." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={1000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="attachment">
                <Paperclip className="size-4" aria-hidden />
                {row?.attachment_path ? 'Replace attachment' : 'Attachment'}
              </Label>
              <Input
                id="attachment"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  const problem = f ? checkAttachment(f) : null
                  setFileError(problem)
                  setFile(problem ? null : f)
                }}
                aria-describedby="attachment-help"
              />
              <FormDescription id="attachment-help">PDF, JPG or PNG, up to 5 MB. Optional.</FormDescription>
              {fileError && (
                <p role="alert" className="text-sm text-destructive">
                  {fileError}
                </p>
              )}
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {row ? 'Save changes' : `Add ${cfg.singular.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
