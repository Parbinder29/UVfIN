'use client'

import { useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveInvestment } from '@/actions/investments'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PAYMENT_METHODS } from '@/lib/constants'
import { isoToZonedLocal, zonedLocalToISO } from '@/lib/dates'
import { TIMEZONE } from '@/lib/env'
import { investmentFormSchema } from '@/lib/validators'
import type { Investment } from '@/types'

const NONE = '__none__'
type Values = Record<string, string>


export function InvestmentFormDialog({
  investors,
  investment,
  defaultInvestorId,
  open,
  onOpenChange,
}: {
  investors: { id: string; full_name: string; is_active: boolean }[]
  investment?: Investment
  defaultInvestorId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const defaults: Values = {
    investor_id: investment?.investor_id ?? defaultInvestorId ?? '',
    amount: investment ? String(investment.amount) : '',
    invested_at: isoToZonedLocal(investment?.invested_at ?? new Date().toISOString()),
    payment_method: investment?.payment_method ?? '',
    reference_no: investment?.reference_no ?? '',
    notes: investment?.notes ?? '',
  }
  const form = useForm<Values>({
    resolver: zodResolver(investmentFormSchema) as unknown as Resolver<Values>,
    defaultValues: defaults,
  })
  // Inactive investors can't receive new contributions, but an existing one keeps its investor.
  const choices = investors.filter((i) => i.is_active || i.id === investment?.investor_id)

  const close = (next: boolean) => {
    if (!next) form.reset(defaults)
    onOpenChange(next)
  }

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      // The form works in company time (e.g. IST); the server stores UTC.
      const result = await saveInvestment(investment?.id ?? null, { ...values, invested_at: zonedLocalToISO(values.invested_at) })
      if (!result.ok) {
        Object.entries(result.fieldErrors ?? {}).forEach(([n, m]) => m?.[0] && form.setError(n, { message: m[0] }))
        toast.error(result.error)
        return
      }
      toast.success(investment ? 'Investment updated' : 'Investment added')
      close(false)
    })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{investment ? 'Edit investment' : 'Add investment'}</DialogTitle>
          <DialogDescription>Record one contribution from an investor. Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <FormField
              control={form.control}
              name="investor_id"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Investor *</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={choices.length ? 'Choose an investor' : 'Add an investor first'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {choices.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.full_name}
                          {!i.is_active && ' (inactive)'}
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invested_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date and time *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormDescription>Time zone: {TIMEZONE}</FormDescription>
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
                    <Input maxLength={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={1000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || choices.length === 0}>
                {pending && <Loader2 className="animate-spin" />}
                {investment ? 'Save changes' : 'Add investment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
