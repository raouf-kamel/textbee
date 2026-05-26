'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Mail,
  Shield,
  UserCircle,
  Loader2,
  Check,
  Calendar,
  Info,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@/hooks/use-toast'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Textarea } from '@/components/ui/textarea'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { Routes } from '@/config/routes'
import { polarCustomerPortalRequestUrl } from '@/config/external-links'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useI18n } from '@/lib/i18n'

type UpdateProfileFormData = {
  name: string
  email?: string
  phone?: string
}

type ChangePasswordFormData = {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export default function AccountSettings() {
  const { locale, t } = useI18n()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const { update: updateSession } = useSession()

  const { toast } = useToast()

  const updateProfileSchema = z.object({
    name: z.string().min(1, t('account.nameRequired')),
    email: z.string().email(t('auth.invalidEmail')).optional(),
    phone: z
      .string()
      .regex(/^\+?\d{0,14}$/, t('account.invalidPhone'))
      .optional(),
  })

  const changePasswordSchema = z
    .object({
      oldPassword: z.string().min(1, t('account.oldPasswordRequired')),
      newPassword: z
        .string()
        .min(8, { message: t('auth.passwordTooShort') }),
      confirmPassword: z
        .string()
        .min(4, { message: t('auth.confirmPasswordRequired') }),
    })
    .superRefine((data, ctx) => {
      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('auth.passwordsMustMatch'),
          path: ['confirmPassword'],
        })
      }
    })

  const {
    data: currentUser,
    isLoading: isLoadingUser,
    refetch: refetchCurrentUser,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.auth.whoAmI())
        .then((res) => res.data?.data),
  })

  const updateProfileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: currentUser?.name,
      email: currentUser?.email,
      phone: currentUser?.phone,
    },
  })

  const changePasswordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  const handleDeleteAccount = () => {
    if (deleteConfirmEmail !== currentUser?.email) {
      toast({
        title: t('account.correctEmailRequired'),
      })
      return
    }
    requestAccountDeletion()
  }

  const handleVerifyEmail = () => {
    // TODO: Implement email verification
  }

  const {
    mutate: updateProfile,
    isPending: isUpdatingProfile,
    error: updateProfileError,
    isSuccess: isUpdateProfileSuccess,
  } = useMutation({
    mutationFn: (data: UpdateProfileFormData) =>
      httpBrowserClient.patch(ApiEndpoints.auth.updateProfile(), data),
    onSuccess: () => {
      refetchCurrentUser()
      toast({
        title: t('account.profileUpdated'),
      })
      updateSession({
        name: updateProfileForm.getValues().name,
        phone: updateProfileForm.getValues().phone,
      })
    },
    onError: () => {
      toast({
        title: t('account.failedUpdateProfile'),
      })
    },
  })

  const {
    mutate: changePassword,
    isPending: isChangingPassword,
    error: changePasswordError,
    isSuccess: isChangePasswordSuccess,
  } = useMutation({
    mutationFn: (data: ChangePasswordFormData) =>
      httpBrowserClient.post(ApiEndpoints.auth.changePassword(), data),
    onSuccess: () => {
      toast({
        title: t('account.passwordChanged'),
      })
      changePasswordForm.reset()
    },
    onError: (error) => {
      const errorMessage = (error as any).response?.data?.error
      changePasswordForm.setError('root.serverError', {
        message: errorMessage || t('account.failedChangePassword'),
      })
      toast({
        title: t('account.failedChangePassword'),
      })
    },
  })

  const [deleteReason, setDeleteReason] = useState('')

  const {
    mutate: requestAccountDeletion,
    isPending: isRequestingAccountDeletion,
    error: requestAccountDeletionError,
    isSuccess: isRequestAccountDeletionSuccess,
  } = useMutation({
    mutationFn: () =>
      httpBrowserClient.post(ApiEndpoints.support.requestAccountDeletion(), {
        message: deleteReason,
      }),
    onSuccess: () => {
      toast({
        title: t('account.deletionSubmitted'),
      })
    },
    onError: () => {
      toast({
        title: t('account.failedDeletionRequest'),
      })
    },
  })

  const CurrentSubscription = () => {
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

    if (isLoadingSubscription)
      return (
        <div className='flex justify-center items-center h-full min-h-[200px] mt-10'>
          <Spinner size='sm' />
        </div>
      )
    if (subscriptionError)
      return (
        <p className='text-sm text-destructive'>
          {t('account.failedLoadSubscription')}
        </p>
      )

    // Format price with currency symbol
    const formatPrice = (
      amount: number | null | undefined,
      currency: string | null | undefined
    ) => {
      if (amount == null || currency == null) return t('account.free')

      const formatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
        style: 'currency',
        currency: currency.toUpperCase() || 'USD',
        minimumFractionDigits: 2,
      })

      return formatter.format(amount / 100)
    }

    const getBillingInterval = (interval: string | null | undefined) => {
      if (!interval) return ''
      return interval.toLowerCase() === 'month'
        ? t('account.monthly')
        : t('account.yearly')
    }

    return (
      <div className='bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border rounded-lg shadow p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
              {currentSubscription?.plan?.name || t('account.freePlan')}
            </h3>
            <div className='flex items-center gap-2'>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {t('account.currentSubscription')}
              </p>
              {currentSubscription?.amount > 0 && (
                <Badge variant='outline' className='text-xs font-medium'>
                  {formatPrice(
                    currentSubscription?.amount,
                    currentSubscription?.currency
                  )}
                  {currentSubscription?.recurringInterval && (
                    <span className='ml-1'>
                      /{' '}
                      {getBillingInterval(
                        currentSubscription?.recurringInterval
                      )}
                    </span>
                  )}
                </Badge>
              )}
            </div>
          </div>
          <div
            className={`flex items-center px-2 py-0.5 rounded-full ${
              currentSubscription?.status === 'active'
                ? 'bg-green-50 dark:bg-green-900/30'
                : currentSubscription?.status === 'past_due'
                ? 'bg-amber-50 dark:bg-amber-900/30'
                : 'bg-gray-50 dark:bg-gray-800/50'
            }`}
          >
            <Check
              className={`h-3 w-3 mr-1 ${
                currentSubscription?.status === 'active'
                  ? 'text-green-600 dark:text-green-400'
                  : currentSubscription?.status === 'past_due'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                currentSubscription?.status === 'active'
                  ? 'text-green-600 dark:text-green-400'
                  : currentSubscription?.status === 'past_due'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {currentSubscription?.status
                ? currentSubscription.status
                    .split('_')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                : t('common.active')}
            </span>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='flex items-center space-x-2 bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm'>
            <Calendar className='h-4 w-4 text-brand-600 dark:text-brand-400' />
            <div>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {t('account.startDate')}
              </p>
              <p className='text-sm font-medium text-gray-900 dark:text-white'>
                {currentSubscription?.subscriptionStartDate
                  ? new Date(
                      currentSubscription?.subscriptionStartDate
                    ).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : t('sms.notAvailable')}
              </p>
            </div>
          </div>

          <div className='flex items-center space-x-2 bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm'>
            <Calendar className='h-4 w-4 text-brand-600 dark:text-brand-400' />
            <div>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {t('account.nextPayment')}
              </p>
              <p className='text-sm font-medium text-gray-900 dark:text-white'>
                {currentSubscription?.currentPeriodEnd
                  ? new Date(
                      currentSubscription?.currentPeriodEnd
                    ).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : t('sms.notAvailable')}
              </p>
            </div>
          </div>

          <div className='col-span-2 bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm'>
            <p className='text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium'>
              {t('account.usageLimits')}
            </p>
            <div className='grid grid-cols-3 gap-3'>
              <div className='bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md'>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {t('account.daily')}
                </p>
                <p className='text-sm font-medium text-gray-900 dark:text-white'>
                  {currentSubscription?.plan?.dailyLimit === -1
                    ? t('account.unlimited')
                    : currentSubscription?.plan?.dailyLimit || '0'}
                  {currentSubscription?.plan?.dailyLimit === -1 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='inline-flex items-center'>
                            <Info className='h-4 w-4 text-gray-500 ml-1 cursor-pointer' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('account.unlimitedMonthly')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </p>
              </div>
              <div className='bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md'>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {t('account.monthlyLimit')}
                </p>
                <p className='text-sm font-medium text-gray-900 dark:text-white'>
                  {currentSubscription?.plan?.monthlyLimit === -1
                    ? t('account.unlimited')
                    : currentSubscription?.plan?.monthlyLimit?.toLocaleString() ||
                      '0'}
                  {currentSubscription?.plan?.monthlyLimit === -1 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='inline-flex items-center'>
                            <Info className='h-4 w-4 text-gray-500 ml-1 cursor-pointer' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('account.unlimitedFairUsage')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </p>
              </div>
              <div className='bg-gray-50 dark:bg-gray-700/50 p-2 rounded-md'>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {t('account.bulk')}
                </p>
                <p className='text-sm font-medium text-gray-900 dark:text-white'>
                  {currentSubscription?.plan?.bulkSendLimit === -1
                    ? t('account.unlimited')
                    : currentSubscription?.plan?.bulkSendLimit || '0'}
                  {currentSubscription?.plan?.bulkSendLimit === -1 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='inline-flex items-center'>
                            <Info className='h-4 w-4 text-gray-500 ml-1 cursor-pointer' />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t('account.unlimitedMonthly')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className='mt-4 flex justify-end gap-2'>
          {!currentSubscription?.plan?.name ||
          currentSubscription?.plan?.name?.toLowerCase() === 'free' ? (
            <Link
              href='/checkout/pro'
              className='text-xs font-medium text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md transition-colors'
            >
              {t('account.upgradeToPro')}
            </Link>
          ) : (
            <Link
              href={polarCustomerPortalRequestUrl(currentUser?.email)}
              className='text-xs font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md transition-colors'
            >
              {t('account.manageSubscription')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (isLoadingUser)
    return (
      <div className='flex justify-center items-center h-full min-h-[200px] mt-10'>
        <Spinner size='sm' />
      </div>
    )

  return (
    <div className='grid gap-6 max-w-2xl mt-10'>
      <CurrentSubscription />
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <UserCircle className='h-5 w-5' />
            <CardTitle>{t('account.profileInformation')}</CardTitle>
          </div>
          <CardDescription>{t('account.profileInformationDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={updateProfileForm.handleSubmit((data) =>
              updateProfile(data)
            )}
            className='space-y-4'
          >
            <div className='space-y-2'>
              <Label htmlFor='name'>{t('common.fullName')}</Label>
              <Input
                id='name'
                {...updateProfileForm.register('name')}
                placeholder={t('account.fullNamePlaceholder')}
                defaultValue={currentUser?.name}
              />
              {updateProfileForm.formState.errors.name && (
                <p className='text-sm text-destructive'>
                  {updateProfileForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='email' className='flex items-center gap-2'>
                {t('account.emailAddress')}
                {currentUser?.emailVerifiedAt && (
                  <Badge variant='secondary' className='ml-2'>
                    <Shield className='h-3 w-3 mr-1' />
                    {t('account.verified')}
                  </Badge>
                )}
              </Label>
              <div className='flex gap-2'>
                <Input
                  id='email'
                  type='email'
                  {...updateProfileForm.register('email')}
                  placeholder={t('account.emailPlaceholder')}
                  defaultValue={currentUser?.email}
                  disabled
                />
                {!currentUser?.emailVerifiedAt ? (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleVerifyEmail}
                    disabled={true}
                  >
                    {isUpdatingProfile ? (
                      <Loader2 className='h-4 w-4 animate-spin' />
                    ) : (
                      <Mail className='h-4 w-4 mr-2' />
                    )}
                {t('account.verify')}
                  </Button>
                ) : (
                  <Button variant='outline' disabled>
                    <Check className='h-4 w-4 mr-2' />
                    {t('account.verified')}
                  </Button>
                )}
              </div>
              {updateProfileForm.formState.errors.email && (
                <p className='text-sm text-destructive'>
                  {updateProfileForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='phone'>{t('account.phoneNumber')}</Label>
              <Input
                id='phone'
                type='tel'
                {...updateProfileForm.register('phone')}
                placeholder={t('account.phonePlaceholder')}
                defaultValue={currentUser?.phone}
              />
              {updateProfileForm.formState.errors.phone && (
                <p className='text-sm text-destructive'>
                  {updateProfileForm.formState.errors.phone.message}
                </p>
              )}
            </div>

            {isUpdateProfileSuccess && (
              <p className='text-sm text-green-500'>
                {t('account.profileUpdated')}
              </p>
            )}

            <Button
              type='submit'
              className='w-full mt-6'
              disabled={isUpdatingProfile}
            >
              {isUpdatingProfile ? (
                <Loader2 className='h-4 w-4 animate-spin mr-2' />
              ) : null}
              {t('account.saveChanges')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <CardTitle>{t('account.changePassword')}</CardTitle>
          </div>
          <CardDescription>
            {t('account.googlePasswordResetPrefix')}
            <Link href={Routes.resetPassword} className='underline'>
              {t('account.here')}
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={changePasswordForm.handleSubmit((data) =>
              changePassword(data)
            )}
            className='space-y-4'
          >
            <div className='space-y-2'>
              <Label htmlFor='oldPassword'>{t('account.oldPassword')}</Label>
              <Input
                id='oldPassword'
                type='password'
                {...changePasswordForm.register('oldPassword')}
                placeholder={t('account.oldPasswordPlaceholder')}
              />
              {changePasswordForm.formState.errors.oldPassword && (
                <p className='text-sm text-destructive'>
                  {changePasswordForm.formState.errors.oldPassword.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='newPassword'>{t('auth.newPassword')}</Label>
              <Input
                id='newPassword'
                type='password'
                {...changePasswordForm.register('newPassword')}
                placeholder={t('account.newPasswordPlaceholder')}
              />
              {changePasswordForm.formState.errors.newPassword && (
                <p className='text-sm text-destructive'>
                  {changePasswordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='confirmPassword'>{t('auth.confirmPassword')}</Label>
              <Input
                id='confirmPassword'
                type='password'
                {...changePasswordForm.register('confirmPassword')}
                placeholder={t('account.confirmPasswordPlaceholder')}
              />
              {changePasswordForm.formState.errors.confirmPassword && (
                <p className='text-sm text-destructive'>
                  {changePasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {changePasswordForm.formState.errors.root?.serverError && (
              <p className='text-sm text-destructive'>
                {changePasswordForm.formState.errors.root.serverError.message}
              </p>
            )}

            {isChangePasswordSuccess && (
              <p className='text-sm text-green-500'>
                {t('account.passwordChanged')}
              </p>
            )}

            <Button
              type='submit'
              className='w-full mt-6'
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <Loader2 className='h-4 w-4 animate-spin mr-2' />
              ) : null}
              {t('account.changePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className='border-destructive/50'>
        <CardHeader>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-5 w-5' />
            <CardTitle>{t('account.dangerZone')}</CardTitle>
          </div>
          <CardDescription>
            {t('account.deleteAccountWarning')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
          >
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

                  {/* enter reason for deletion text area */}
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
        </CardContent>
      </Card>
    </div>
  )
}
