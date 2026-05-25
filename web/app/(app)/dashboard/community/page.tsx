'use client'

import { UsersIcon } from 'lucide-react'
import CommunityLinks from '../(components)/community-links'
import { useI18n } from '@/lib/i18n'

export default function CommunityPage() {
  const { t } = useI18n()

  return (
    <div className='flex-1 space-y-6 p-6 md:p-8'>
      <div className='space-y-1'>
        <div className='flex items-center space-x-2'>
          <UsersIcon className='h-6 w-6 text-primary' />
          <h2 className='text-3xl font-bold tracking-tight'>
            {t('common.community')}
          </h2>
        </div>
        <p className='text-muted-foreground'>
          {t('dashboard.communityDescription')}
        </p>
      </div>

      <div className=''>
        <CommunityLinks />
      </div>
    </div>
  )
}
