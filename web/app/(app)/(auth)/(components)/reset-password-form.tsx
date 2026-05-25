'use client'

import { useMemo } from 'react'
import Link from 'next/link'
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
import { useI18n } from '@/lib/i18n'

type ResetPasswordFormValues = {
  email: string
  otp: string
  newPassword: string
  confirmPassword: string
}

export default function ResetPasswordForm({
  email,
  otp,
}: {
  email: string
  otp: string
}) {
  const { t } = useI18n()
  const resetPasswordSchema = useMemo(
    () =>
      z
        .object({
          email: z.string().email({ message: t('auth.invalidEmail') }),
          otp: z.string().min(4, { message: t('auth.otpRequired') }),
          newPassword: z
            .string()
            .min(8, { message: t('auth.passwordTooShort') }),
          confirmPassword: z
            .string()
            .min(4, { message: t('auth.confirmPasswordRequired') }),
        })
        .superRefine((data, ctx) => {
          if (data.newPassword !== data.confirmPassword) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: t('auth.passwordsMustMatch'),
              path: ['confirmPassword'],
            })
          }
        }),
    [t]
  )

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: email,
      otp: otp,
      newPassword: '',
      confirmPassword: '',
    },
  })

  const onResetPassword = async (data: ResetPasswordFormValues) => {
    try {
      await httpBrowserClient.post(ApiEndpoints.auth.resetPassword(), data)
    } catch (error) {
      console.error(error)
      form.setError('root.serverError', {
        message: t('auth.failedResetPassword'),
      })
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
            {t('auth.newPasswordDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onResetPassword)}
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
                name='otp'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.otp')}</FormLabel>
                    <FormControl>
                      <Input placeholder='1234' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='newPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.newPassword')}</FormLabel>
                    <FormControl>
                      <Input type='password' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input type='password' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.formState.errors.root && (
                <p className='text-sm font-medium text-red-500'>
                  {form.formState.errors.root.message}
                </p>
              )}

              <Button
                className='w-full'
                type='submit'
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    {/* <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> */}
                    {t('auth.resettingPassword')}
                  </>
                ) : (
                  t('auth.resetPassword')
                )}
              </Button>
            </form>
          </Form>
          {form.formState.isSubmitted && form.formState.isSubmitSuccessful && (
            <Alert className='mt-4' variant='default'>
              {/* <Icons.checkCircle className="h-4 w-4" /> */}
              <AlertTitle>{t('auth.passwordResetSuccessTitle')}</AlertTitle>
              <AlertDescription>
                {t('auth.passwordResetSuccessDescription')}
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
