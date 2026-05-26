import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiEndpoints } from '@/config/api'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export default function AccountDeletionAlert() {
  const { t } = useI18n()
  const {
    data: userData,
    isLoading: isLoadingUserData,
    error: userDataError,
  } = useQuery({
    queryKey: ['whoAmI'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.auth.whoAmI())
        .then((res) => res.data.data),
  })

  if (isLoadingUserData || !userData || userDataError) {
    return null
  }

  // Only show the alert if the user has requested account deletion
  if (!userData.accountDeletionRequestedAt) {
    return null
  }

  // Calculate days remaining until deletion (assuming 7-day window)
  const deletionDate = new Date(userData.accountDeletionRequestedAt)
  deletionDate.setDate(deletionDate.getDate() + 7)
  const daysRemaining = Math.max(
    0,
    Math.ceil(
      (deletionDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)
    )
  )

  return (
    <Alert className='bg-gradient-to-r from-amber-600 to-red-600 text-white'>
      <AlertDescription className='flex items-center gap-2'>
        <AlertTriangle className='h-5 w-5 flex-shrink-0' />
        <div className='text-sm md:text-base'>
          <span className='font-medium'>{t('alerts.accountPending')}</span>{' '}
          {daysRemaining > 0
            ? t('alerts.accountDeletedIn', {
                days: daysRemaining,
                plural: daysRemaining !== 1 ? 's' : '',
              })
            : t('alerts.accountDeletedSoon')}{' '}
          {t('alerts.cancelDeletion', { email: '' })}
          <span className='font-medium'>support@textbee.dev</span>.
        </div>
      </AlertDescription>
    </Alert>
  )
}
