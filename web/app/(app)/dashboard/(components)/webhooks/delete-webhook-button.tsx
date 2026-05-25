'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface DeleteWebhookButtonProps {
  onDelete: () => void
}

export function DeleteWebhookButton({ onDelete }: DeleteWebhookButtonProps) {
  const { t } = useI18n()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='outline' size='sm' disabled>
          <Trash2 className='h-4 w-4 text-destructive' />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('webhooks.deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('webhooks.deleteDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
