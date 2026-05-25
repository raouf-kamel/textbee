'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTurnstile } from '@/lib/turnstile'
import { useI18n } from '@/lib/i18n'

export default function DeleteAccountForm() {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleteReason, setDeleteReason] = useState('')
  const [turnstileError, setTurnstileError] = useState<string | null>(null)
  const { toast } = useToast()
  const { t } = useI18n()

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.auth.whoAmI())
        .then((res) => res.data?.data),
  })

  const {
    containerRef: turnstileRef,
    token: turnstileToken,
    error: turnstileHookError,
  } = useTurnstile({
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  })

  useEffect(() => {
    if (turnstileToken) {
      setTurnstileError(null)
    }
  }, [turnstileToken])

  useEffect(() => {
    if (turnstileHookError) {
      setTurnstileError(turnstileHookError)
    }
  }, [turnstileHookError])

  const handleDeleteAccount = () => {
    if (deleteConfirmEmail !== currentUser?.email) {
      toast({
        title: t('account.correctEmailRequired'),
      })
      return
    } else if (deleteReason.length < 4) {
      toast({
        title: t('account.deletionReasonRequired'),
      })
      return
    } else if (!turnstileToken) {
      setTurnstileError(t('auth.botVerificationRequired'))
      return
    }
    requestAccountDeletion()
  }

  const {
    mutate: requestAccountDeletion,
    isPending: isRequestingAccountDeletion,
    error: requestAccountDeletionError,
    isSuccess: isRequestAccountDeletionSuccess,
  } = useMutation({
    mutationFn: () =>
      httpBrowserClient.post(ApiEndpoints.support.requestAccountDeletion(), {
        message: deleteReason,
        turnstileToken,
      }),
    onSuccess: () => {
      toast({
        title: t('account.deletionSubmitted'),
      })
      setIsDeleteDialogOpen(false)
    },
    onError: () => {
      toast({
        title: t('account.failedDeletionRequest'),
      })
    },
  })

  return (
    <>
      <p className='text-sm text-muted-foreground mb-6'>
        {t('account.deleteIntro')}
      </p>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <Button
          variant='destructive'
          className='w-full'
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <AlertTriangle className='mr-2 h-4 w-4' />
          {t('account.deleteAccount')}
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              {t('account.deleteAccount')}
            </DialogTitle>
            <DialogDescription className='pt-4'>
              <p className='mb-4'>
                {t('account.deleteConfirmQuestion')}
              </p>
              <ul className='list-disc list-inside space-y-2 mb-4'>
                <li>{t('account.deleteCannotUndo')}</li>
                <li>{t('account.deleteAllData')}</li>
                <li>{t('account.deleteSubscriptions')}</li>
                <li>{t('account.deleteServices')}</li>
              </ul>

              <Label htmlFor='deleteReason'>{t('account.deletionReason')}</Label>
              <Textarea
                className='my-2'
                placeholder={t('account.deletionReasonPlaceholder')}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />

              <p>{t('account.typeEmailToConfirm')}</p>

              <Input
                className='mt-2'
                placeholder={t('account.emailConfirmPlaceholder')}
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
              />

              <div className='mt-4 space-y-2'>
                <div
                  ref={turnstileRef}
                  className='min-h-[65px] w-full flex justify-center'
                />
                {turnstileError && (
                  <p className='text-sm text-destructive'>{turnstileError}</p>
                )}
              </div>

              {requestAccountDeletionError && (
                <p className='text-sm text-destructive'>
                  {(requestAccountDeletionError as any).response?.data
                    ?.message ||
                    requestAccountDeletionError.message ||
                    t('account.failedDeletionRequest')}
                </p>
              )}

              {isRequestAccountDeletionSuccess && (
                <p className='text-sm text-green-500'>
                  {t('account.deletionSubmitted')}
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button
              variant='outline'
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant='destructive'
              onClick={handleDeleteAccount}
              disabled={isRequestingAccountDeletion || !deleteConfirmEmail}
            >
              {isRequestingAccountDeletion ? (
                <Loader2 className='h-4 w-4 animate-spin mr-2' />
              ) : (
                <AlertTriangle className='h-4 w-4 mr-2' />
              )}
              {t('account.deleteAccount')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
