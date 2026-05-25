import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiEndpoints } from '@/config/api'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'

const DISCOUNT_CODE_FALLBACK = null
const DISCOUNT_PERCENTAGE_FALLBACK = null

const envDiscountCode = process.env.NEXT_PUBLIC_DISCOUNT_CODE?.trim()
const envDiscountPercentage = process.env.NEXT_PUBLIC_DISCOUNT_PERCENTAGE?.trim()

const discountCode = (envDiscountCode !== undefined && envDiscountCode !== '') 
  ? envDiscountCode 
  : DISCOUNT_CODE_FALLBACK
const discountPercentage = (envDiscountPercentage !== undefined && envDiscountPercentage !== '')
  ? envDiscountPercentage
  : DISCOUNT_PERCENTAGE_FALLBACK
const isDiscountEnabled = discountCode !== null && discountCode !== '' && discountPercentage !== null && discountPercentage !== ''

export default function UpgradeToProAlert() {
  const { t } = useI18n()
  const {
    data: currentSubscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useQuery({
    queryKey: ['currentSubscription'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.billing.currentSubscription())
        .then((res) => res.data),
  })

  const monthlyUsagePercentage = currentSubscription?.usage?.monthlyUsagePercentage || 0
  const monthlyLimit = currentSubscription?.usage?.monthlyLimit || 0
  const processedSmsLastMonth = currentSubscription?.usage?.processedSmsLastMonth || 0

  const alertConfig = useMemo(() => {
    if (monthlyUsagePercentage >= 100 ) {
      return {
        bgColor: 'bg-gradient-to-r from-red-600 to-red-800',
        message: t('alerts.monthlyExceeded'),
        subMessage: t('alerts.usedOfLimit', {
          used: processedSmsLastMonth,
          limit: monthlyLimit,
        }),
        buttonText: t('alerts.upgradeNow'),
        buttonColor: 'bg-white text-red-600 hover:bg-red-50 hover:text-red-700 border-red-600',
        urgency: 'critical'
      }
    } else if (monthlyUsagePercentage >= 80) {
      return {
        bgColor: 'bg-gradient-to-r from-orange-500 to-red-500',
        message: t('alerts.approachingLimit'),
        subMessage: t('alerts.usedPercentage', {
          percentage: monthlyUsagePercentage,
          used: processedSmsLastMonth,
          limit: monthlyLimit,
        }),
        buttonText: t('alerts.upgradeBeforeLimit'),
        buttonColor: 'bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700 border-orange-600',
        urgency: 'warning'
      }
    } else {
      const allCtaMessages = t('alerts.proMessages').split('|')
      const allButtonTexts = t('alerts.proButtons').split('|')
      
      // Filter out discount-related messages if discount is not enabled
      const ctaMessages = isDiscountEnabled
        ? allCtaMessages
        : allCtaMessages.filter(
            (msg) =>
              !msg.toLowerCase().includes('discount') &&
              !msg.toLowerCase().includes('offer') &&
              !msg.toLowerCase().includes('save') &&
              !msg.includes('30%')
          )
      
      const buttonTexts = isDiscountEnabled
        ? allButtonTexts
        : allButtonTexts.filter(
            (text) =>
              !text.toLowerCase().includes('discount') &&
              !text.toLowerCase().includes('save')
          )
      
      const randomIndex = Math.floor(Math.random() * ctaMessages.length)
      
      const subMessage = isDiscountEnabled
        ? t('alerts.discount', {
            code: discountCode,
            percentage: discountPercentage,
          })
        : t('alerts.proDefault')
      
      return {
        bgColor: 'bg-gradient-to-r from-purple-500 to-pink-500',
        message: ctaMessages[randomIndex],
        subMessage,
        buttonText: buttonTexts[randomIndex],
        buttonColor: 'bg-red-500 text-white hover:bg-red-600 border-red-500',
        urgency: 'normal'
      }
    }
  }, [monthlyUsagePercentage, monthlyLimit, processedSmsLastMonth, t])

  if (isLoadingSubscription || !currentSubscription || subscriptionError) {
    return null
  }

  if (currentSubscription?.plan?.name !== 'free') {
    return null
  }

  return (
    <Alert className={`${alertConfig.bgColor} text-white`}>
      <AlertDescription className='flex flex-col sm:flex-row flex-wrap items-center gap-2 md:gap-4'>
        <span className='w-full sm:flex-1 text-center sm:text-left text-sm md:text-base font-medium'>
          {alertConfig.message}
        </span>
        <span className='w-full sm:flex-1 text-center sm:text-left text-xs md:text-sm'>
          {alertConfig.urgency === 'normal' && isDiscountEnabled ? (
            <>
              {t('alerts.discount', {
                code: discountCode,
                percentage: discountPercentage,
              })}
            </>
          ) : (
            alertConfig.subMessage
          )}
        </span>
        <div className='w-full sm:w-auto mt-2 sm:mt-0 flex justify-center sm:justify-end flex-wrap gap-1 md:gap-2'>
          <Button
            variant='outline'
            size='sm'
            asChild
            className={`${alertConfig.buttonColor} text-xs md:text-sm`}
          >
            <Link href={'/checkout/pro'}>{alertConfig.buttonText}</Link>
          </Button>
          {alertConfig.urgency === 'normal' && (
            <Button
              variant='outline'
              size='sm'
              asChild
              className='bg-orange-500 text-white hover:bg-orange-600 text-xs md:text-sm'
            >
              <Link href={'/#pricing'}>{t('alerts.learnMore')}</Link>
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
