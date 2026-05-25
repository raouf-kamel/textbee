'use client'

import { useState, useEffect, useCallback } from 'react'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Loader, CheckCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export default function CheckoutPage({ params }) {
  const [error, setError] = useState<string | null>(null)
  const { t } = useI18n()

  const planName = params.planName as string

  const { data: session } = useSession()

  const initiateCheckout = useCallback(
    async (retries = 2) => {
      try {
        const response = await httpBrowserClient.post('/billing/checkout', {
          planName,
        })

        if (response.data?.redirectUrl) {
          window.location.href = response.data?.redirectUrl
        } else {
          throw new Error(t('checkout.noRedirect'))
        }
      } catch (error) {
        if (retries > 0) {
          initiateCheckout(retries - 1)
        } else {
          setError(error.response?.data?.message || t('checkout.failedCreate'))
          console.error(error.response?.data?.message)
        }
      }
    },
    [planName, t]
  )

  useEffect(() => {
    initiateCheckout()
  }, [initiateCheckout])

  if (!session?.user) {
    return redirect(`/login?redirect=${window.location.href}`)
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center h-screen'>
        <div className='text-red-500'>{error}</div>
        <button
          onClick={() => {
            setError(null)
            initiateCheckout()
          }}
          className='mt-4 px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600'
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className='flex flex-col items-center justify-center min-h-[80vh] bg-gray-100 p-6 rounded-lg shadow-lg'>
      <Loader className='animate-spin mb-4 text-brand-500' size={48} />
      <h2 className='text-2xl font-bold text-gray-800 mb-2'>
        {t('checkout.hangTight')}
      </h2>
      <p className='text-lg text-gray-600 mb-4'>
        {t('checkout.processing')}
      </p>
      <CheckCircle className='text-green-500 mb-2' size={32} />
      <span className='text-lg font-semibold'>
        {t('checkout.thankYou')}
      </span>
    </div>
  )
}
