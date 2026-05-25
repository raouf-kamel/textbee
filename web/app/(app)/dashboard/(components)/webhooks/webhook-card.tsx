'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DeleteWebhookButton } from './delete-webhook-button'
import { Edit2, Eye, EyeOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { CopyButton } from '@/components/shared/copy-button'
import { WebhookData } from '@/lib/types'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import { useQueryClient } from '@tanstack/react-query'
import { useI18n } from '@/lib/i18n'

interface WebhookCardProps {
  webhook: WebhookData
  onEdit: () => void
  onDelete?: () => void
}

export function WebhookCard({ webhook, onEdit, onDelete }: WebhookCardProps) {
  const { toast } = useToast()
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()
  const [showSecret, setShowSecret] = useState(false)

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true)
    try {
      await httpBrowserClient.patch(
        ApiEndpoints.gateway.updateWebhook(webhook._id),
        { isActive: checked }
      )
      
      await queryClient.invalidateQueries({
        queryKey: ['webhooks']
      })

      toast({
        title: checked
          ? t('webhooks.enabledToast')
          : t('webhooks.disabledToast'),
        description: checked
          ? t('webhooks.enabledDescription')
          : t('webhooks.disabledDescription'),
      })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('webhooks.toggleFailed', {
          action: checked ? t('webhooks.enable') : t('webhooks.disable'),
        }),
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const maskSecret = (secret: string) => {
    // if the secret is less than 18 characters, show all
    if (secret.length <= 18) {
      return secret.slice(0, 18)
    }
    return secret.slice(0, 18) + '*'.repeat(secret.length - 24)
  }

  return (
    <Card>
      <CardHeader className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div className='space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-base font-semibold'>
              {t('webhooks.endpoint')}
            </h3>
            <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
              {webhook.isActive ? t('webhooks.active') : t('webhooks.inactive')}
            </Badge>
          </div>
          <p className='text-sm text-muted-foreground'>
            {t('webhooks.notifications')}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Switch 
            checked={webhook.isActive} 
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
          <Button variant='outline' size='sm' onClick={onEdit}>
            <Edit2 className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>{t('common.edit')}</span>
          </Button>
          <DeleteWebhookButton onDelete={onDelete} />
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div>
            <label className='text-sm font-medium'>
              {t('webhooks.deliveryUrl')}
            </label>
            <div className='flex items-center gap-1 mt-1'>
              <code className='flex-1 bg-muted px-3 py-2 rounded-md text-sm break-all'>
                {webhook.deliveryUrl}
              </code>
              <CopyButton
                value={webhook.deliveryUrl}
                label={t('webhooks.copyUrl')}
                className="ml-1"
              />
            </div>
          </div>
          <div>
            <label className='text-sm font-medium'>
              {t('webhooks.signingSecret')}
            </label>
            <div className='flex items-center gap-1 mt-1'>
              <code className='flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono break-all'>
                {showSecret ? webhook.signingSecret : maskSecret(webhook.signingSecret)}
              </code>
              <div className='flex items-center gap-1 shrink-0 ml-1'>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                  className="h-8 w-8"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <CopyButton
                  value={webhook.signingSecret}
                  label={t('webhooks.copySecret')}
                />
              </div>
            </div>
          </div>
          <div>
            <label className='text-sm font-medium'>
              {t('webhooks.events')}
            </label>
            <div className='flex flex-wrap gap-2 mt-1'>
              {webhook.events.map((event) => (
                <Badge key={event} variant='secondary'>
                  {event}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
