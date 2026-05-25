'use client'

import { ShieldIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ChangePasswordForm from '../../(components)/change-password-form'
import { useI18n } from '@/lib/i18n'

export default function ChangePasswordPage() {
  const { t } = useI18n()

  return (
    <div className='flex-1 space-y-6 p-6 md:p-8'>
      <div className='space-y-1'>
        <div className='flex items-center space-x-2'>
          <ShieldIcon className='h-6 w-6 text-primary' />
          <h2 className='text-3xl font-bold tracking-tight'>
            {t('account.changePassword')}
          </h2>
        </div>
        <p className='text-muted-foreground'>
          {t('account.changePasswordDescription')}
        </p>
      </div>

      <div className='max-w-2xl'>
        <Card>
          <CardHeader>
            <CardTitle>{t('account.passwordSecurity')}</CardTitle>
            <CardDescription>
              {t('account.passwordSecurityDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
