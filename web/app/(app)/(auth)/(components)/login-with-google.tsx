'use client'

import { Routes } from '@/config/routes'
import { toast } from '@/hooks/use-toast'
import { CredentialResponse, GoogleLogin } from '@react-oauth/google'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

export default function LoginWithGoogle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const { locale, t } = useI18n()

  const onGoogleLoginSuccess = async (
    credentialResponse: CredentialResponse
  ) => {
    toast({
      title: t('auth.success'),
      description: t('auth.googleLoginSuccess'),
      variant: 'default',
    })
    await signIn('google-id-token-login', {
      redirect: true,
      callbackUrl: redirect ? decodeURIComponent(redirect) : Routes.dashboard,
      idToken: credentialResponse.credential,
    })
  }

  const onGoogleLoginError = () => {
    toast({
      title: t('auth.error'),
      description: t('auth.somethingWentWrong'),
      variant: 'destructive',
    })
  }
  return (
    <GoogleLogin
      onSuccess={onGoogleLoginSuccess}
      onError={onGoogleLoginError}
      useOneTap={true}
      width={'100%'}
      size='large'
      shape='pill'
      locale={locale}
      theme='outline'
      text='continue_with'
    />
  )
}
