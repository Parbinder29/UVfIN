'use client'

import { useTransition } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveInvestor } from '@/actions/investors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { investorSchema } from '@/lib/validators'
import type { InvestorSummary } from '@/types'

type Values = { full_name: string; email: string; phone: string; notes: string; is_active: boolean }

export function InvestorFormDialog({
  investor,
  open,
  onOpenChange,
}: {
  investor?: Pick<InvestorSummary, 'id' | 'full_name' | 'email' | 'phone' | 'notes' | 'is_active'>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, startTransition] = useTransition()
  const defaults: Values = {
    full_name: investor?.full_name ?? '',
    email: investor?.email ?? '',
    phone: investor?.phone ?? '',
    notes: investor?.notes ?? '',
    is_active: investor?.is_active ?? true,
  }
  const form = useForm<Values>({ resolver: zodResolver(investorSchema) as unknown as Resolver<Values>, defaultValues: defaults })

  const close = (next: boolean) => {
    if (!next) form.reset(defaults)
    onOpenChange(next)
  }

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const result = await saveInvestor(investor?.id ?? null, values)
      if (!result.ok) {
        Object.entries(result.fieldErrors ?? {}).forEach(([n, m]) => m?.[0] && form.setError(n as keyof Values, { message: m[0] }))
        toast.error(result.error)
        return
      }
      toast.success(investor ? 'Investor updated' : 'Investor added')
      close(false)
    })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{investor ? 'Edit investor' : 'Add investor'}</DialogTitle>
          <DialogDescription>Investors (members) who put money into UVIN Group.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name *</FormLabel>
                  <FormControl>
                    <Input maxLength={200} autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" maxLength={200} autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" maxLength={30} autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={1000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  </FormControl>
                  <FormLabel className="!mt-0">Active (can receive new contributions)</FormLabel>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {investor ? 'Save changes' : 'Add investor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
