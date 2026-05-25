'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import LoginWithGoogle from '../(components)/login-with-google'
import RegisterForm from '../(components)/register-form'
import { Routes } from '@/config/routes'
import { useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { t } = useI18n()

  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-100 dark:bg-muted'>
      <Card className='w-[450px] shadow-lg'>
        <CardHeader className='space-y-1'>
          <CardTitle className='text-2xl font-bold text-center'>
            {t('auth.createAccount')}
          </CardTitle>
          <CardDescription className='text-center'>
            {t('auth.registerDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <div className='relative mt-4'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background dark:bg-muted px-2 text-muted-foreground'>
                {t('common.or')}
              </span>
            </div>
          </div>
          <div className='mt-4 flex justify-center'>
            <LoginWithGoogle />
          </div>
        </CardContent>
        <CardFooter className='text-center'>
          <p className='text-sm text-gray-600'>
            {t('auth.alreadyHaveAccount')}{' '}
            <Link
              href={{
                pathname: Routes.login,
                query: {
                  redirect: redirect ? decodeURIComponent(redirect) : undefined,
                },
              }}
              className='font-medium text-brand-600 hover:underline'
            >
              {t('auth.signInLink')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
