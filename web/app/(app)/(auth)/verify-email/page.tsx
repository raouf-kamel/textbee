'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Mail, ArrowRight } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import { Routes } from '@/config/routes'
import { useI18n } from '@/lib/i18n'

// Reusable components
const ErrorAlert = ({ title, message }: { title: string; message: string }) => (
  <Alert
    variant='destructive'
    className='bg-red-50 text-red-700 border-red-200'
  >
    <XCircle className='h-5 w-5 text-red-600' />
    <AlertTitle className='text-lg font-semibold'>{title}</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
)

const SuccessAlert = ({ title, message }: { title: string; message: string }) => (
  <Alert className='bg-green-50 text-green-700 border-green-200'>
    <CheckCircle className='h-5 w-5 text-green-600' />
    <AlertTitle className='text-lg font-semibold'>{title}</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
)

const InfoAlert = ({ title, message }: { title: string; message: string }) => (
  <Alert className='bg-brand-50 text-brand-700 border-brand-200'>
    <Mail className='h-5 w-5 text-brand-600' />
    <AlertTitle className='text-lg font-semibold'>{title}</AlertTitle>
    <AlertDescription>{message}</AlertDescription>
  </Alert>
)

const LoadingSpinner = () => (
  <div className='flex justify-center py-6'>
    <Loader2 className='h-10 w-10 animate-spin text-primary' />
  </div>
)

const DashboardButton = ({ label }: { label: string }) => (
  <Button className='w-full py-5 mt-2 text-white' asChild>
    <Link href={Routes.dashboard}>
      {label}
      <ArrowRight className='ml-2 h-5 w-5' />
    </Link>
  </Button>
)

const LoginButton = ({ label }: { label: string }) => (
  <Button className='w-full py-5 mt-2' asChild>
    <Link href='/login'>
      {label}
      <ArrowRight className='ml-2 h-5 w-5' />
    </Link>
  </Button>
)

export default function VerifyEmailPage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userId = searchParams.get('userId')
  const verificationCode = searchParams.get('verificationCode')
  const verificationEmailSent = searchParams.get('verificationEmailSent')
  
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Check user authentication and email verification status
  const { 
    data: whoAmIData, 
    isPending: isCheckingAuth,
    isError: isAuthError 
  } = useQuery({
    queryKey: ['whoAmI'],
    queryFn: () => httpBrowserClient.get(ApiEndpoints.auth.whoAmI()),
    retry: 1,
  })

  const user = whoAmIData?.data?.data
  const isEmailVerified = !!user?.emailVerifiedAt
  const isLoggedIn = !isAuthError && !!user

  // Verify email mutation
  const { 
    mutate: verifyEmail, 
    isPending: isVerifying 
  } = useMutation({
    mutationFn: () => httpBrowserClient.post('/auth/verify-email', {
      userId,
      verificationCode,
    }),
    onSuccess: () => {
      setSuccessMessage(t('verifyEmail.verifiedSuccess'))
      setErrorMessage('')
    },
    onError: (error: any) => {
      setErrorMessage(error.message || t('verifyEmail.verifyFailed'))
    },
  })

  // Send verification email mutation
  const { 
    mutate: sendVerificationEmail, 
    isPending: isSending 
  } = useMutation({
    mutationFn: () => httpBrowserClient.post(
      ApiEndpoints.auth.sendEmailVerificationEmail(),
      {}
    ),
    onSuccess: () => {
      if (!verificationEmailSent) {
        router.push('/verify-email?verificationEmailSent=true')
      } else {
        setSuccessMessage(t('verifyEmail.emailSent'))
        setErrorMessage('')
      }
    },
    onError: (error: any) => {
      setErrorMessage(error.message || t('verifyEmail.sendFailed'))
    },
  })

  // Handle verification when code is provided
  useEffect(() => {
    if (userId && verificationCode && !isVerifying && !successMessage && !errorMessage) {
      if (isEmailVerified) {
        setSuccessMessage(t('verifyEmail.alreadyVerified'))
      } else if (!isCheckingAuth) {
        verifyEmail()
      }
    }
  }, [userId, verificationCode, isCheckingAuth, isEmailVerified, isVerifying, successMessage, errorMessage, verifyEmail, t])

  // Render content based on current state
  const renderContent = () => {
    // Show loading state
    if (isCheckingAuth) {
      return (
        <>
          <CardHeader>
            <CardTitle className='text-2xl font-bold'>
              {t('verifyEmail.title')}
            </CardTitle>
            <CardDescription>{t('verifyEmail.checking')}</CardDescription>
          </CardHeader>
          <CardContent>
            <LoadingSpinner />
          </CardContent>
        </>
      )
    }

    // Handle verification process
    if (userId && verificationCode) {
      return (
        <>
          <CardHeader>
            <CardTitle className='text-2xl font-bold'>
              {t('verifyEmail.title')}
            </CardTitle>
            <CardDescription>
              {isVerifying ? t('verifyEmail.verifying') : t('verifyEmail.status')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {isVerifying ? (
              <LoadingSpinner />
            ) : successMessage ? (
              <SuccessAlert title={t('auth.success')} message={successMessage} />
            ) : errorMessage ? (
              <ErrorAlert title={t('common.error')} message={errorMessage} />
            ) : null}
          </CardContent>
          <CardFooter>
            {successMessage && <DashboardButton label={t('verifyEmail.goDashboard')} />}
          </CardFooter>
        </>
      )
    }

    // Handle "check your email" state
    if (verificationEmailSent) {
      return (
        <>
          <CardHeader>
            <CardTitle className='text-2xl font-bold'>
              {t('verifyEmail.checkEmail')}
            </CardTitle>
            <CardDescription>
              {t('verifyEmail.checkEmailDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {successMessage && (
              <InfoAlert title={t('verifyEmail.emailSentTitle')} message={successMessage} />
            )}
            {errorMessage && (
              <ErrorAlert title={t('common.error')} message={errorMessage} />
            )}
            {isEmailVerified && (
              <SuccessAlert 
                title={t('verifyEmail.alreadyVerifiedTitle')}
                message={t('verifyEmail.alreadyVerified')}
              />
            )}
          </CardContent>
          <CardFooter className='flex flex-col gap-3'>
            {isEmailVerified ? (
              <DashboardButton label={t('verifyEmail.goDashboard')} />
            ) : (
              <div className='flex items-center gap-2 justify-center w-full'>
                <span className='text-sm text-gray-600'>
                  {t('verifyEmail.didntReceive')}
                </span>
                <Button
                  variant='link'
                  onClick={() => sendVerificationEmail()}
                  disabled={isSending}
                  className='text-sm p-0 h-auto font-semibold'
                >
                  {isSending ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      {t('verifyEmail.sending')}
                    </>
                  ) : (
                    t('verifyEmail.resend')
                  )}
                </Button>
              </div>
            )}
          </CardFooter>
        </>
      )
    }

    // Handle "send verification email" state
    return (
      <>
        <CardHeader>
          <CardTitle className='text-2xl font-bold'>
            {t('verifyEmail.title')}
          </CardTitle>
          <CardDescription>
            {isLoggedIn 
              ? isEmailVerified
                ? t('verifyEmail.alreadyVerifiedDescription')
                : t('verifyEmail.verifyToAccess')
              : t('verifyEmail.loginRequired')
            }
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {successMessage && (
            <InfoAlert title={t('verifyEmail.emailSentTitle')} message={successMessage} />
          )}
          {errorMessage && (
            <ErrorAlert title={t('common.error')} message={errorMessage} />
          )}
          {isEmailVerified && (
            <SuccessAlert 
              title={t('verifyEmail.alreadyVerifiedTitle')}
              message={t('verifyEmail.alreadyVerified')}
            />
          )}
          {!isLoggedIn && (
            <Alert
              variant='destructive'
              className='bg-red-50 text-red-700 border-red-200'
            >
              <XCircle className='h-5 w-5 text-red-600' />
              <AlertTitle className='text-lg font-semibold'>
                {t('verifyEmail.notLoggedIn')}
              </AlertTitle>
              <AlertDescription>
                {t('verifyEmail.loginRequired')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          {isLoggedIn ? (
            isEmailVerified ? (
              <DashboardButton label={t('verifyEmail.goDashboard')} />
            ) : (
              <Button
                className='w-full py-5'
                onClick={() => sendVerificationEmail()}
                disabled={isSending}
              >
                {isSending ? (
                  <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                ) : (
                  <Mail className='mr-2 h-5 w-5' />
                )}
                {t('verifyEmail.sendVerificationEmail')}
              </Button>
            )
          ) : (
            <LoginButton label={t('verifyEmail.goLogin')} />
          )}
        </CardFooter>
      </>
    )
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4'>
      <Card className='w-full max-w-md shadow-lg border-gray-200 dark:border-gray-800'>
        {renderContent()}
      </Card>
    </div>
  )
}
