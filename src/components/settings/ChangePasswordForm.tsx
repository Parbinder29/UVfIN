'use client'

import { useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Circle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { changePassword } from '@/actions/account'
import { PasswordInput } from '@/components/forms/PasswordInput'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { changePasswordSchema, PASSWORD_RULES, type ChangePasswordInput } from '@/lib/validators'
import { cn } from '@/lib/utils'

export function ChangePasswordForm({ email }: { email: string }) {
  const [pending, startTransition] = useTransition()
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current: '', next: '', confirm: '' },
  })
  const next = useWatch({ control: form.control, name: 'next' }) ?? ''

  const onSubmit = (values: ChangePasswordInput) =>
    startTransition(async () => {
      const result = await changePassword(values)
      if (result.ok) {
        toast.success('Password changed. Other devices have been signed out.')
        form.reset()
        return
      }
      const fields = result.fieldErrors ?? {}
      for (const [name, messages] of Object.entries(fields)) {
        if (messages?.[0]) form.setError(name as keyof ChangePasswordInput, { message: messages[0] })
      }
      if (!Object.keys(fields).length) toast.error(result.error)
    })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-md space-y-4" noValidate>
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <FormField
          control={form.control}
          name="current"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="next"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" aria-describedby="password-rules" {...field} />
              </FormControl>
              <FormMessage />
              <ul id="password-rules" className="grid gap-1 text-xs sm:grid-cols-2">
                {PASSWORD_RULES.map((rule) => {
                  const met = rule.test(next)
                  return (
                    <li key={rule.label} className={cn('flex items-center gap-1.5', met ? 'text-brand-accent' : 'text-muted-foreground')}>
                      {met ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3" aria-hidden />}
                      {rule.label}
                      <span className="sr-only">{met ? '(done)' : '(missing)'}</span>
                    </li>
                  )
                })}
              </ul>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Form>
  )
}
