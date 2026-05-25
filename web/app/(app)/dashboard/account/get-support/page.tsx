'use client'

import { MessageSquareIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import SupportForm from '../../(components)/support-form'
import { useI18n } from '@/lib/i18n'

export default function GetSupportPage() {
  const { t } = useI18n()

  return (
    <div className='flex-1 space-y-6 p-6 md:p-8'>
      <div className='space-y-1'>
        <div className='flex items-center space-x-2'>
          <MessageSquareIcon className='h-6 w-6 text-primary' />
          <h2 className='text-3xl font-bold tracking-tight'>
            {t('account.getSupport')}
          </h2>
        </div>
        <p className='text-muted-foreground'>
          {t('account.getSupportDescription')}
        </p>
      </div>

      <div className='max-w-2xl'>
        <Card>
          <CardHeader>
            <CardTitle>{t('account.contactSupport')}</CardTitle>
            <CardDescription>
              {t('account.contactSupportDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SupportForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
