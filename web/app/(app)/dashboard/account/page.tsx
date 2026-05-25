'use client'

import { UserIcon, PencilIcon, KeyIcon, AlertTriangleIcon, MessageSquareIcon } from 'lucide-react'
import SubscriptionInfo from '../(components)/subscription-info'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

export default function AccountPage() {
  const { t } = useI18n()

  return (
    <div className='flex-1 space-y-6 p-6 md:p-8'>
      <div className='space-y-1'>
        <div className='flex items-center space-x-2'>
          <UserIcon className='h-6 w-6 text-primary' />
          <h2 className='text-3xl font-bold tracking-tight'>
            {t('common.account')}
          </h2>
        </div>
        <p className='text-muted-foreground'>{t('account.description')}</p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Left column - Subscription Information */}
        <div className='space-y-4'>
          <h3 className='text-lg font-semibold'>
            {t('account.subscriptionInfo')}
          </h3>
          <SubscriptionInfo />
        </div>

        {/* Right column - Account Management */}
        <div className='space-y-6'>
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold'>
              {t('account.accountManagement')}
            </h3>
            
            <div className='grid gap-4'>
              <Link href="/dashboard/account/edit-profile">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className='flex items-center'>
                    <div className='bg-primary/10 p-2 rounded-full mr-3'>
                      <PencilIcon className='h-5 w-5 text-primary' />
                    </div>
                    <div className='text-left'>
                      <div className='font-medium'>
                        {t('account.editProfile')}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        {t('account.editProfileDescription')}
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
              
              <Link href="/dashboard/account/change-password">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className='flex items-center'>
                    <div className='bg-primary/10 p-2 rounded-full mr-3'>
                      <KeyIcon className='h-5 w-5 text-primary' />
                    </div>
                    <div className='text-left'>
                      <div className='font-medium'>
                        {t('account.changePassword')}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        {t('account.changePasswordDescription')}
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
              
              <Link href="/dashboard/account/get-support">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <div className='flex items-center'>
                    <div className='bg-primary/10 p-2 rounded-full mr-3'>
                      <MessageSquareIcon className='h-5 w-5 text-primary' />
                    </div>
                    <div className='text-left'>
                      <div className='font-medium'>
                        {t('account.getSupport')}
                      </div>
                      <div className='text-sm text-muted-foreground'>
                        {t('account.getSupportDescription')}
                      </div>
                    </div>
                  </div>
                </Button>
              </Link>
            </div>
          </div>
          
          <div className='space-y-4 pt-4 border-t'>
            <h3 className='text-lg font-semibold text-destructive'>
              {t('account.dangerZone')}
            </h3>
            
            <Link href="/dashboard/account/delete-account">
              <Button variant="outline" className="w-full justify-start h-auto py-3 border-destructive/30">
                <div className='flex items-center'>
                  <div className='bg-destructive/10 p-2 rounded-full mr-3'>
                    <AlertTriangleIcon className='h-5 w-5 text-destructive' />
                  </div>
                  <div className='text-left'>
                    <div className='font-medium text-destructive'>
                      {t('account.deleteAccount')}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      {t('account.deleteAccountDescription')}
                    </div>
                  </div>
                </div>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
