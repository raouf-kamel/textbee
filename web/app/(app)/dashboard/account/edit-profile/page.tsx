'use client'

import { UserIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import EditProfileForm from '../../(components)/edit-profile-form'
import { useI18n } from '@/lib/i18n'

export default function EditProfilePage() {
  const { t } = useI18n()

  return (
    <div className='flex-1 space-y-6 p-6 md:p-8'>
      <div className='space-y-1'>
        <div className='flex items-center space-x-2'>
          <UserIcon className='h-6 w-6 text-primary' />
          <h2 className='text-3xl font-bold tracking-tight'>
            {t('account.editProfile')}
          </h2>
        </div>
        <p className='text-muted-foreground'>
          {t('account.profileInformationDescription')}
        </p>
      </div>

      <div className='max-w-2xl'>
        <Card>
          <CardHeader>
            <CardTitle>{t('account.profileInformation')}</CardTitle>
            <CardDescription>
              {t('account.profileInformationDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
