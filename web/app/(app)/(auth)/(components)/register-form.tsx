'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { signIn } from 'next-auth/react'
import { Checkbox } from '@/components/ui/checkbox'
import { Routes } from '@/config/routes'
import { useTurnstile } from '@/lib/turnstile'
import { useI18n } from '@/lib/i18n'

type RegisterFormValues = {
  name: string
  email: string
  password: string
  phone?: string
  marketingOptIn?: boolean
  turnstileToken: string
}

export default function RegisterForm() {
  const router = useRouter()
  const { t } = useI18n()
  const registerSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, { message: t('auth.nameTooShort') }),
        email: z.string().email({ message: t('auth.invalidEmail') }),
        password: z.string().min(8, { message: t('auth.passwordTooShort') }),
        phone: z.string().optional(),
        marketingOptIn: z.boolean().optional().default(true),
        turnstileToken: z
          .string()
          .min(1, { message: t('auth.botVerificationRequired') }),
      }),
    [t]
  )

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      phone: '',
      marketingOptIn: true,
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

  const onSubmit = async (data: RegisterFormValues) => {
    form.clearErrors()

    if (!data.turnstileToken) {
      form.setError('turnstileToken', {
        type: 'manual',
        message: t('auth.botVerificationRequired'),
      })
      return
    }

    try {
      const result = await signIn('email-password-register', {
        redirect: false,
        email: data.email,
        password: data.password,
        name: data.name,
        phone: data.phone,
        marketingOptIn: data.marketingOptIn,
        turnstileToken: data.turnstileToken,
      })

      if (result?.error) {
        console.log(result.error)
        form.setError('root', {
          type: 'manual',
          message: t('auth.failedCreateAccount'),
        })
      } else {
        router.push(`${Routes.verifyEmail}?verificationEmailSent=1`)
      }
    } catch (error) {
      console.error('register error:', error)
      form.setError('root', {
        type: 'manual',
        message: t('auth.unexpectedError'),
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('common.fullName')}</FormLabel>
              <FormControl>
                <Input placeholder='John Doe' {...field} className='dark:text-white dark:bg-gray-800' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('common.email')}</FormLabel>
              <FormControl>
                <Input placeholder='m@example.com' {...field} className='dark:text-white dark:bg-gray-800' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('common.password')}</FormLabel>
              <FormControl>
                <Input type='password' {...field} className='dark:text-white dark:bg-gray-800' />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='phone'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('common.phoneOptional')}</FormLabel>
              <FormControl>
                <Input placeholder='+1 (555) 000-0000' {...field} className='dark:text-white dark:bg-gray-800' />
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
        {form.formState.errors.root && (
          <p className='text-sm font-medium text-red-500'>
            {form.formState.errors.root.message}
          </p>
        )}

        <FormField
          control={form.control}
          name='marketingOptIn'
          render={({ field }) => (
            <FormItem>
              <div className='flex items-center space-x-3 space-y-0'>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className='text-sm'>
                  {t('auth.marketingOptIn')}
                </FormLabel>
              </div>
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
              {t('auth.creatingAccount')}
            </>
          ) : (
            t('auth.signUp')
          )}
        </Button>
      </form>
    </Form>
  )
}
