'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Download, ExternalLink, Lightbulb } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiEndpoints } from '@/config/api'
import { Routes } from '@/config/routes'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import GenerateApiKey from './generate-api-key'
import { Skeleton } from '@/components/ui/skeleton'
import { TranslationKey, useI18n } from '@/lib/i18n'

type StatsShape = {
  totalApiKeyCount?: number
  totalDeviceCount?: number
  totalSentSMSCount?: number
}

type UserShape = {
  emailVerifiedAt?: string | Date | null
  createdAt?: string | Date
  onboarding?: {
    completedAt?: string | Date | null
    currentStepId?: string
    skippedStepIds?: string[]
  }
}

type SubShape = { plan?: { name?: string } } | null

type StepDef = {
  id: string
  labelKey: TranslationKey
  descriptionKey: TranslationKey
  optional: boolean
  checkDone: (
    user: UserShape | undefined,
    stats: StatsShape | undefined,
    sub: SubShape,
    skipped: string[],
  ) => boolean
}

const STEPS: StepDef[] = [
  {
    id: 'verify_email',
    labelKey: 'onboarding.verifyEmail',
    descriptionKey: 'onboarding.verifyEmailDescription',
    optional: false,
    checkDone: (user) => !!user?.emailVerifiedAt,
  },
  {
    id: 'download_app',
    labelKey: 'onboarding.downloadApp',
    descriptionKey: 'onboarding.downloadAppDescription',
    optional: true,
    checkDone: (_u, stats, _s, skipped) =>
      (stats?.totalDeviceCount ?? 0) > 0 || skipped.includes('download_app'),
  },
  {
    id: 'api_key',
    labelKey: 'onboarding.generateApiKey',
    descriptionKey: 'onboarding.generateApiKeyDescription',
    optional: false,
    checkDone: (_u, stats) => (stats?.totalApiKeyCount ?? 0) > 0,
  },
  {
    id: 'register_device',
    labelKey: 'onboarding.registerDevice',
    descriptionKey: 'onboarding.registerDeviceDescription',
    optional: false,
    checkDone: (_u, stats) => (stats?.totalDeviceCount ?? 0) > 0,
  },
  {
    id: 'choose_plan',
    labelKey: 'onboarding.choosePlan',
    descriptionKey: 'onboarding.choosePlanDescription',
    optional: true,
    checkDone: (_u, _stats, sub, skipped) =>
      (sub?.plan?.name && sub.plan.name.toLowerCase() !== 'free') ||
      skipped.includes('choose_plan'),
  },
  {
    id: 'first_message',
    labelKey: 'onboarding.firstMessage',
    descriptionKey: 'onboarding.firstMessageDescription',
    optional: false,
    checkDone: (_u, stats) => (stats?.totalSentSMSCount ?? 0) > 0,
  },
]

function GetStartedCardSkeleton() {
  return (
    <Card className='border-l-4 border-l-primary border border-primary/20 bg-gradient-to-br from-primary/10 to-background shadow-sm'>
      <CardHeader className='pb-2'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-8 w-8 shrink-0 rounded-full' />
            <div className='space-y-2'>
              <Skeleton className='h-5 w-32' />
              <Skeleton className='h-4 w-48' />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className='pt-2'>
        <div className='space-y-0'>
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1
            return (
              <div key={step.id} className='flex gap-3'>
                <div className='flex w-9 shrink-0 flex-col items-center'>
                  <Skeleton className='h-8 w-8 shrink-0 rounded-full' />
                  {!isLast && (
                    <div className='mt-1 min-h-[20px] w-0.5 flex-1 rounded-full bg-border/60' />
                  )}
                </div>
                <div
                  className={cn('min-w-0 flex-1 pb-6', isLast && 'pb-2')}
                >
                  <Skeleton
                    className={cn('h-4 max-w-[220px]', index % 2 === 0 ? 'w-[85%]' : 'w-[70%]')}
                  />
                  <Skeleton className='mt-2 h-3 max-w-md w-full' />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default function GetStartedCard() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const autoCompletedRef = useRef(false)
  const legacyAutoCompletedRef = useRef(false)
  const [registerHelpOpen, setRegisterHelpOpen] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['whoAmI'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.auth.whoAmI())
        .then((res) => res.data?.data as UserShape),
    refetchInterval: (query) => {
      const u = query.state.data as UserShape | undefined
      return u?.onboarding?.completedAt ? false : 10_000
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.gateway.getStats())
        .then((res) => res.data?.data as StatsShape),
    refetchInterval: () => (userData?.onboarding?.completedAt ? false : 10_000),
  })

  const { data: currentSubscription, isLoading: subLoading } = useQuery({
    queryKey: ['currentSubscription'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.billing.currentSubscription())
        .then((res) => res.data as SubShape),
    refetchInterval: () => (userData?.onboarding?.completedAt ? false : 10_000),
  })

  const { mutate: updateOnboarding, isPending: savingOnboarding } = useMutation({
    mutationFn: (body: {
      skipStepId?: string
      complete?: boolean
      currentStepId?: string
    }) =>
      httpBrowserClient
        .patch(ApiEndpoints.auth.updateOnboarding(), body)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whoAmI'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['currentSubscription'] })
    },
  })

  const skippedIds = useMemo(
    () => userData?.onboarding?.skippedStepIds ?? [],
    [userData?.onboarding?.skippedStepIds],
  )

  const stepStates = useMemo(
    () =>
      STEPS.map((s) => ({
        ...s,
        isDone: s.checkDone(
          userData,
          stats,
          currentSubscription ?? null,
          skippedIds,
        ),
      })),
    [userData, stats, currentSubscription, skippedIds],
  )

  const doneCount = stepStates.filter((s) => s.isDone).length

  const isFreePlan =
    !currentSubscription?.plan?.name ||
    currentSubscription.plan.name.toLowerCase() === 'free'

  const canNavigateToStep = useCallback((stepId: string) => {
    if (stepId === 'verify_email') return false
    if (stepId === 'choose_plan') return isFreePlan
    return true
  }, [isFreePlan])

  useEffect(() => {
    if (selectedStepId) return
    const persisted = userData?.onboarding?.currentStepId
    if (persisted && stepStates.some((s) => s.id === persisted)) {
      if (!canNavigateToStep(persisted)) return
      setSelectedStepId(persisted)
    }
  }, [selectedStepId, userData?.onboarding?.currentStepId, stepStates, canNavigateToStep])

  const activeStepId = useMemo(() => {
    const firstIncomplete = stepStates.find((s) => !s.isDone)?.id
    const candidate =
      (selectedStepId && stepStates.some((s) => s.id === selectedStepId))
        ? selectedStepId
        : userData?.onboarding?.currentStepId

    if (candidate && stepStates.some((s) => s.id === candidate)) {
      if (!canNavigateToStep(candidate)) {
        return firstIncomplete ?? STEPS[STEPS.length - 1].id
      }
      return candidate
    }

    return firstIncomplete ?? STEPS[STEPS.length - 1].id
  }, [
    stepStates,
    userData?.onboarding?.currentStepId,
    selectedStepId,
    canNavigateToStep,
  ])

  useEffect(() => {
    if (
      !userData ||
      stats === undefined ||
      subLoading ||
      autoCompletedRef.current
    ) {
      return
    }
    if (userData.onboarding?.completedAt) return

    const allStepsDone = STEPS.every((step) =>
      step.checkDone(
        userData,
        stats,
        currentSubscription ?? null,
        skippedIds,
      ),
    )

    if (allStepsDone) {
      autoCompletedRef.current = true
      updateOnboarding({ complete: true })
    }
  }, [
    userData,
    stats,
    currentSubscription,
    skippedIds,
    subLoading,
    updateOnboarding,
  ])

  useEffect(() => {
    if (!userData || stats === undefined || subLoading) return
    if (legacyAutoCompletedRef.current) return
    if (userData.onboarding?.completedAt) return

    const createdAt = userData.createdAt ? new Date(userData.createdAt) : null
    if (!createdAt || Number.isNaN(createdAt.getTime())) return

    const cutoff = new Date('2026-01-01T00:00:00.000Z')
    const isLegacy = createdAt < cutoff
    if (!isLegacy) return

    const hasDevice = (stats.totalDeviceCount ?? 0) >= 1
    const hasApiKey = (stats.totalApiKeyCount ?? 0) >= 1
    const hasSent = (stats.totalSentSMSCount ?? 0) >= 1
    if (!hasDevice || !hasApiKey || !hasSent) return

    legacyAutoCompletedRef.current = true
    updateOnboarding({ complete: true })
  }, [userData, stats, subLoading, updateOnboarding])

  if (userLoading) {
    return <GetStartedCardSkeleton />
  }

  if (userData?.onboarding?.completedAt) {
    return null
  }

  const finishSetup = () => updateOnboarding({ complete: true })

  return (
    <>
      <Card className='border-l-4 border-l-primary border border-primary/20 bg-gradient-to-br from-primary/10 to-background shadow-sm'>
        <CardHeader className='pb-2'>
          <div className='flex items-start justify-between gap-4'>
            <div className='flex items-center gap-2'>
              <div className='rounded-full bg-primary/20 p-1.5'>
                <Lightbulb className='h-4 w-4 text-primary' />
              </div>
              <div>
                <CardTitle className='text-lg'>{t('common.getStarted')}</CardTitle>
                <CardDescription className='mt-1'>
                  {t('onboarding.stepsComplete', {
                    done: doneCount,
                    total: STEPS.length,
                  })}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className='pt-2'>
          <div className='space-y-0'>
            {stepStates.map((step, index) => {
              const isActive = step.id === activeStepId
              const isLast = index === stepStates.length - 1
              const lineActive =
                stepStates[index].isDone &&
                (index === stepStates.length - 1 ||
                  stepStates[index + 1].isDone ||
                  STEPS[index + 1]?.id === activeStepId)

              const activeIndex = stepStates.findIndex((s) => s.id === activeStepId)
              const canClickStep = canNavigateToStep(step.id)

              return (
                <div key={step.id} className='flex gap-3'>
                  <div className='flex w-9 shrink-0 flex-col items-center'>
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        step.isDone &&
                          'bg-primary text-primary-foreground shadow-sm',
                        !step.isDone &&
                          isActive &&
                          'border-2 border-primary bg-background text-primary',
                        !step.isDone &&
                          !isActive &&
                          'bg-muted text-muted-foreground',
                      )}
                    >
                      {step.isDone ? (
                        <Check className='h-4 w-4' strokeWidth={2.5} />
                      ) : (
                        index + 1
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          'mt-1 min-h-[20px] w-0.5 flex-1 rounded-full',
                          lineActive ? 'bg-primary/50' : 'bg-border',
                        )}
                      />
                    )}
                  </div>
                  <div className={cn('min-w-0 flex-1 pb-6', isLast && 'pb-2')}>
                    <div className='flex flex-wrap items-center gap-2'>
                      {canClickStep ? (
                        <button
                          type='button'
                          className={cn(
                            'text-left text-sm font-medium underline-offset-4 transition-colors hover:text-primary hover:underline',
                            isActive || step.isDone
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                          onClick={() => {
                            setSelectedStepId(step.id)
                            updateOnboarding({ currentStepId: step.id })
                          }}
                        >
                          {t(step.labelKey)}
                        </button>
                      ) : (
                        <p
                          className={cn(
                            'text-sm font-medium',
                            step.isDone || isActive
                              ? 'text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {t(step.labelKey)}
                        </p>
                      )}
                      {/* {step.optional && (
                        <Badge variant='secondary' className='text-[10px] font-normal'>
                          Optional
                        </Badge>
                      )} */}
                    </div>
                    {isActive && (
                      <>
                        <p className='mt-1 text-sm text-muted-foreground'>
                          {t(step.descriptionKey)}
                        </p>
                        <div className='mt-3 flex flex-wrap items-center gap-2'>
                          {step.id === 'verify_email' && (
                            <Button size='sm' asChild>
                              <Link href={Routes.verifyEmail}>
                                {t('onboarding.verifyEmailAction')}
                              </Link>
                            </Button>
                          )}
                          {step.id === 'download_app' && (
                            <>
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() =>
                                  window.open(Routes.downloadAndroidApp, '_blank')
                                }
                              >
                                <Download className='h-4 w-4' />
                                {t('onboarding.downloadApk')}
                              </Button>
                              <Button
                                variant='link'
                                size='sm'
                                className='h-auto px-2 text-muted-foreground'
                                disabled={savingOnboarding}
                                onClick={() =>
                                  updateOnboarding({ skipStepId: 'download_app' })
                                }
                              >
                                {t('onboarding.skip')}
                              </Button>
                            </>
                          )}
                          {step.id === 'api_key' && <GenerateApiKey />}
                          {step.id === 'register_device' && (
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => setRegisterHelpOpen(true)}
                            >
                              {t('onboarding.howToRegister')}
                            </Button>
                          )}
                          {step.id === 'choose_plan' && (
                            <>
                              {subLoading ? (
                                <div className='grid w-full gap-3 md:grid-cols-2'>
                                  <Skeleton className='h-40 rounded-lg' />
                                  <Skeleton className='h-40 rounded-lg' />
                                </div>
                              ) : (
                                <div className='grid w-full gap-3 md:grid-cols-2'>
                                  <Card className='border-border shadow-none'>
                                    <CardHeader className='pb-2 pt-4'>
                                      <CardTitle className='text-base'>
                                        {t('account.free')}
                                      </CardTitle>
                                      <CardDescription>$0/month</CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-2 pb-4 text-sm text-muted-foreground'>
                                      <p className='flex gap-2'>
                                        <Check className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                                        {t('onboarding.oneDevice')}
                                      </p>
                                      <p className='flex gap-2'>
                                        <Check className='mt-0.5 h-4 w-4 shrink-0 text-muted-foreground' />
                                        {t('onboarding.freeLimits')}
                                      </p>
                                    </CardContent>
                                    <CardFooter className='flex-col gap-2 pb-4 pt-0'>
                                      <Button
                                        variant='outline'
                                        className='w-full'
                                        disabled={savingOnboarding}
                                        onClick={() =>
                                          updateOnboarding({ skipStepId: 'choose_plan' })
                                        }
                                      >
                                        {t('onboarding.continueWithFree')}
                                      </Button>
                                    </CardFooter>
                                  </Card>
                                  <Card className='relative border-2 border-primary shadow-md'>
                                    <Badge className='absolute right-3 top-3 text-[10px]'>
                                      {t('onboarding.recommended')}
                                    </Badge>
                                    <CardHeader className='pb-2 pt-4 pr-14'>
                                      <CardTitle className='text-base'>Pro</CardTitle>
                                      <CardDescription>$10/month</CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-2 pb-4 text-sm'>
                                      <p className='flex gap-2 text-foreground'>
                                        <Check className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
                                        {t('onboarding.upToFiveDevices')}
                                      </p>
                                      <p className='flex gap-2 text-foreground'>
                                        <Check className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
                                        {t('onboarding.noDailyLimit')}
                                      </p>
                                      <p className='flex gap-2 text-foreground'>
                                        <Check className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
                                        {t('onboarding.proMonthlyLimit')}
                                      </p>
                                      <p className='flex gap-2 text-foreground'>
                                        <Check className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
                                        {t('onboarding.prioritySupport')}
                                      </p>
                                    </CardContent>
                                    <CardFooter className='flex-col gap-2 pb-4 pt-0'>
                                      <Button className='w-full' size='sm' asChild>
                                        <Link href='/checkout/pro'>
                                          {t('account.upgradeToPro')}
                                        </Link>
                                      </Button>
                                      <Button
                                        variant='link'
                                        size='sm'
                                        className='h-auto text-xs text-muted-foreground'
                                        asChild
                                      >
                                        <a
                                          href={`${Routes.landingPage}/pricing`}
                                          target='_blank'
                                          rel='noreferrer'
                                        >
                                          {t('onboarding.comparePlans')}
                                          <ExternalLink className='ml-1 h-3 w-3' />
                                        </a>
                                      </Button>
                                    </CardFooter>
                                  </Card>
                                </div>
                              )}
                              <Button
                                variant='link'
                                size='sm'
                                className='h-auto px-0 text-muted-foreground'
                                disabled={savingOnboarding}
                                onClick={() =>
                                  updateOnboarding({ skipStepId: 'choose_plan' })
                                }
                              >
                                {t('onboarding.skipForNow')}
                              </Button>
                            </>
                          )}
                          {step.id === 'first_message' && (
                            <Button size='sm' asChild>
                              <Link href='/dashboard/messaging'>
                                {t('onboarding.goToMessaging')}
                              </Link>
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
        <CardFooter className='flex justify-end border-t border-border/60 pt-4'>
          <Button
            variant='ghost'
            size='sm'
            disabled={savingOnboarding}
            onClick={finishSetup}
          >
            {t('onboarding.finishSetup')}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={registerHelpOpen} onOpenChange={setRegisterHelpOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('onboarding.registerDevice')}</DialogTitle>
            <DialogDescription>
              {t('onboarding.registerHelpDescription')}
            </DialogDescription>
          </DialogHeader>
          <ol className='mt-2 list-decimal space-y-3 pl-5 text-sm text-muted-foreground'>
            <li>
              {t('onboarding.registerHelpStepApiKey')}
            </li>
            <li>
              {t('onboarding.registerHelpStepDownloadPrefix')}{' '}
              <a
                href={Routes.downloadAndroidApp}
                target='_blank'
                rel='noreferrer'
                className='font-medium text-primary underline-offset-4 hover:underline'
              >
                {Routes.downloadAndroidApp}
              </a>
              .
            </li>
            <li>{t('onboarding.registerHelpStepPermissions')}</li>
            <li>
              {t('onboarding.registerHelpStepRegister')}
            </li>
            <li>
              {t('onboarding.registerHelpStepDone')}
            </li>
          </ol>
          <DialogFooter className='flex flex-col gap-2 sm:flex-row sm:justify-between'>
            <Button variant='outline' size='sm' asChild>
              <a href={Routes.quickstart} target='_blank' rel='noreferrer'>
                {t('onboarding.viewFullGuide')}
                <ExternalLink className='ml-1 h-3 w-3' />
              </a>
            </Button>
            <Button size='sm' onClick={() => setRegisterHelpOpen(false)}>
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
