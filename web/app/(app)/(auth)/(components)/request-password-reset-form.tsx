'use client'

import Link from 'next/link'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
// import { Icons } from "@/components/ui/icons"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import { Routes } from '@/config/routes'
import { useTurnstile } from '@/lib/turnstile'
import { useI18n } from '@/lib/i18n'

type RequestPasswordResetFormValues = {
  email: string
  turnstileToken: string
}

export default function RequestPasswordResetForm() {
  const { t } = useI18n()
  const requestPasswordResetSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: t('auth.invalidEmail') }),
        turnstileToken: z
          .string()
          .min(1, { message: t('auth.botVerificationRequired') }),
      }),
    [t]
  )

  const form = useForm<RequestPasswordResetFormValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: {
      email: '',
      turnstileToken: '',
    },
  })

  const {
    containerRef: turnstileRef,
    token: turnstileToken,
    error: turnstileError,
  } = useTurnstile({
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    onToken: (token) =>
      form.setValue('turnstileToken', token, { shouldValidate: true }),
    onError: (message) =>
      form.setError('turnstileToken', { type: 'manual', message }),
    onExpire: (message) =>
      form.setError('turnstileToken', { type: 'manual', message }),
  })

  useEffect(() => {
    if (turnstileToken) {
      form.clearErrors('turnstileToken')
    }
  }, [turnstileToken, form])

  useEffect(() => {
    if (turnstileError) {
      form.setError('turnstileToken', { type: 'manual', message: turnstileError })
    }
  }, [turnstileError, form])

  const onRequestPasswordReset = async (
    data: RequestPasswordResetFormValues
  ) => {
    form.clearErrors()

    if (!data.turnstileToken) {
      form.setError('turnstileToken', {
        type: 'manual',
        message: t('auth.botVerificationRequired'),
      })
      return
    }

    try {
      await httpBrowserClient.post(
        ApiEndpoints.auth.requestPasswordReset(),
        data
      )
    } catch (error) {
      form.setError('email', { message: t('auth.invalidEmail') })
    }
  }

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100 dark:bg-muted'>
      <Card className='w-[400px] shadow-lg'>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-2xl font-bold text-center'>
            {t('auth.resetPassword')}
          </CardTitle>
          <CardDescription className='text-center'>
            {t('auth.requestResetDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!form.formState.isSubmitted ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onRequestPasswordReset)}
                className='space-y-4'
              >
                <FormField
                  control={form.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.email')}</FormLabel>
                      <FormControl>
                        <Input placeholder='m@example.com' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='turnstileToken'
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <div
                          ref={turnstileRef}
                          className='min-h-[65px] w-full flex justify-center'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className='w-full'
                  type='submit'
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <>
                      {/* <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> */}
                      {t('auth.sendingResetLink')}
                    </>
                  ) : (
                    t('auth.sendResetLink')
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <Alert>
              {/* <Icons.checkCircle className="h-4 w-4" /> */}
              <AlertTitle>{t('auth.checkEmail')}</AlertTitle>
              <AlertDescription>
                {t('auth.resetEmailSent', { email: form.getValues().email })}
              </AlertDescription>
              <AlertDescription className='mt-4 text-sm text-muted-foreground italic'>
                {t('auth.resetEmailHelp')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className='text-center'>
          <Link
            href={Routes.login}
            className='text-sm text-brand-600 hover:underline'
          >
            {t('auth.backToLogin')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
