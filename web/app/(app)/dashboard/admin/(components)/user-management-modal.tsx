'use client'

import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import {
  X,
  ShieldCheck,
  ShieldX,
  Crown,
  Smartphone,
  Trash2,
  Save,
  AlertTriangle,
  CalendarDays,
  Loader2,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type User = {
  _id: string
  name: string
  email: string
  role: string
  isBanned: boolean
  emailVerifiedAt: string | null
  createdAt: string
  subscription: {
    plan: { name: string; dailyLimit: number; monthlyLimit: number; bulkSendLimit: number }
    isActive: boolean
    status: string
    subscriptionEndDate?: string
    customDailyLimit?: number
    customMonthlyLimit?: number
    customBulkSendLimit?: number
  }
  devicesCount: number
}

type Device = {
  _id: string
  name?: string
  brand?: string
  manufacturer?: string
  model?: string
  os?: string
  osVersion?: string
  fcmToken?: string
  serial?: string
  buildId?: string
  appVersionName?: string
  appVersionCode?: number
  receiveSMSEnabled?: boolean
  smsSendDelaySeconds?: number
  enabled: boolean
  sentSMSCount: number
  lastHeartbeat?: string
  createdAt: string
}

type Plan = {
  _id?: string
  name: string
  dailyLimit: number
  monthlyLimit: number
  bulkSendLimit: number
  isActive?: boolean
}

type DeviceFormState = {
  id?: string
  name: string
  brand: string
  manufacturer: string
  model: string
  os: string
  osVersion: string
  fcmToken: string
  serial: string
  buildId: string
  appVersionName: string
  appVersionCode: string
  smsSendDelaySeconds: string
  enabled: boolean
  receiveSMSEnabled: boolean
}

const emptyDeviceForm: DeviceFormState = {
  name: '',
  brand: '',
  manufacturer: '',
  model: '',
  os: 'Android',
  osVersion: '',
  fcmToken: '',
  serial: '',
  buildId: '',
  appVersionName: '',
  appVersionCode: '',
  smsSendDelaySeconds: '5',
  enabled: true,
  receiveSMSEnabled: false,
}

// ─── Expiry Presets ───────────────────────────────────────────────────────────
const EXPIRY_PRESETS = [
  { label: '30 Days (Monthly)', value: '30d' },
  { label: '1 Year (Yearly)', value: '1y' },
  { label: 'Indefinite (No Expiry)', value: 'indefinite' },
  { label: 'Custom Date', value: 'custom' },
]

function computeExpiryDate(preset: string, customDate: string): Date | null {
  if (preset === 'indefinite') return null
  if (preset === 'custom') return customDate ? new Date(customDate) : null
  const now = new Date()
  if (preset === '30d') { now.setDate(now.getDate() + 30); return now }
  if (preset === '1y') { now.setFullYear(now.getFullYear() + 1); return now }
  return null
}

function extractErrorMessage(error: any, fallback: string) {
  const data = error?.response?.data
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.message)) return data.message.join(', ')
  if (typeof data?.error === 'string') return data.error
  if (typeof error?.message === 'string') return error.message
  return fallback
}

function formatLimit(limit?: number) {
  if (limit === -1) return 'Unlimited'
  if (limit === undefined || limit === null) return '-'
  return limit.toLocaleString()
}

function getPlanTone(planName: string) {
  if (planName === 'pro') return 'bg-amber-500 border-amber-500 text-white'
  if (planName.startsWith('custom')) return 'bg-purple-600 border-purple-600 text-white'
  return 'bg-gray-600 border-gray-600 text-white'
}

function toDeviceForm(device: Device): DeviceFormState {
  return {
    id: device._id,
    name: device.name ?? '',
    brand: device.brand ?? '',
    manufacturer: device.manufacturer ?? '',
    model: device.model ?? '',
    os: device.os ?? 'Android',
    osVersion: device.osVersion ?? '',
    fcmToken: device.fcmToken ?? '',
    serial: device.serial ?? '',
    buildId: device.buildId ?? '',
    appVersionName: device.appVersionName ?? '',
    appVersionCode: device.appVersionCode?.toString() ?? '',
    smsSendDelaySeconds: device.smsSendDelaySeconds?.toString() ?? '5',
    enabled: device.enabled,
    receiveSMSEnabled: device.receiveSMSEnabled ?? false,
  }
}

function buildDevicePayload(form: DeviceFormState) {
  return {
    name: form.name || undefined,
    brand: form.brand || undefined,
    manufacturer: form.manufacturer || undefined,
    model: form.model || undefined,
    os: form.os || undefined,
    osVersion: form.osVersion || undefined,
    fcmToken: form.fcmToken || undefined,
    serial: form.serial || undefined,
    buildId: form.buildId || undefined,
    appVersionName: form.appVersionName || undefined,
    appVersionCode: form.appVersionCode !== '' ? Number(form.appVersionCode) : undefined,
    smsSendDelaySeconds: form.smsSendDelaySeconds !== '' ? Number(form.smsSendDelaySeconds) : undefined,
    enabled: form.enabled,
    receiveSMSEnabled: form.receiveSMSEnabled,
  }
}

// ─── Device Card ──────────────────────────────────────────────────────────────
function DeviceCard({
  device,
  onDelete,
  onEdit,
}: {
  device: Device
  onDelete: (id: string) => void
  onEdit: (device: Device) => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete device "${device.name || device.model || device._id}"?`)) return
    setDeleting(true)
    try {
      await onDelete(device._id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className='flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-3 gap-3'>
      <div className='flex items-center gap-3 min-w-0'>
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${device.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-200 dark:bg-gray-600'}`}>
          <Smartphone className={`h-4 w-4 ${device.enabled ? 'text-green-600' : 'text-gray-400'}`} />
        </div>
        <div className='min-w-0'>
          <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
            {device.name || device.model || 'Unknown Device'}
          </p>
          <p className='text-xs text-gray-400 truncate'>
            {[device.brand, device.os, device.osVersion].filter(Boolean).join(' · ')} · {device.sentSMSCount} SMS sent
          </p>
        </div>
      </div>
      <div className='flex flex-shrink-0 items-center gap-2'>
        <button
          onClick={() => onEdit(device)}
          className='rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className='flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors'
        >
          {deleting ? <Loader2 className='h-3 w-3 animate-spin' /> : <Trash2 className='h-3 w-3' />}
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export default function UserManagementModal({
  user,
  onClose,
  onSuccess,
}: {
  user: User
  onClose: () => void
  onSuccess: () => void
}) {
  // Form state
  const [role, setRole] = useState(user.role)
  const [isBanned, setIsBanned] = useState(user.isBanned)
  const [planName, setPlanName] = useState(user.subscription?.plan?.name ?? 'free')
  const [expiryPreset, setExpiryPreset] = useState('indefinite')
  const [customDate, setCustomDate] = useState('')
  const [customDailyLimit, setCustomDailyLimit] = useState<string>(
    user.subscription?.customDailyLimit?.toString() ?? ''
  )
  const [customMonthlyLimit, setCustomMonthlyLimit] = useState<string>(
    user.subscription?.customMonthlyLimit?.toString() ?? ''
  )
  const [customBulkSendLimit, setCustomBulkSendLimit] = useState<string>(
    user.subscription?.customBulkSendLimit?.toString() ?? ''
  )
  const [notes, setNotes] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(emptyDeviceForm)

  // Fetch plans to auto-populate limits
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['adminPlans'],
    queryFn: () => httpBrowserClient.get(ApiEndpoints.billing.plans()).then((r) => r.data),
  })
  const plans = useMemo<Plan[]>(() => {
    const rawPlans = Array.isArray(plansData?.data)
      ? plansData.data
      : Array.isArray(plansData)
      ? plansData
      : []

    return rawPlans
      .filter((plan: Plan) => plan?.name)
      .sort((a: Plan, b: Plan) => {
        const order = ['free', 'pro', 'custom']
        const aIndex = order.indexOf(a.name)
        const bIndex = order.indexOf(b.name)
        return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex)
      })
  }, [plansData])

  const selectedPlan = plans.find((plan) => plan.name === planName)
  const hasAvailablePlans = plans.length > 0
  const planExists = Boolean(selectedPlan)
  const isCustomDateMissing = expiryPreset === 'custom' && !customDate

  // Auto-populate limits when plan changes
  useEffect(() => {
    if (selectedPlan) {
      setCustomDailyLimit(selectedPlan.dailyLimit?.toString() ?? '')
      setCustomMonthlyLimit(selectedPlan.monthlyLimit?.toString() ?? '')
      setCustomBulkSendLimit(selectedPlan.bulkSendLimit?.toString() ?? '')
    }
  }, [selectedPlan])

  // Fetch user devices
  const {
    data: devices,
    isLoading: devicesLoading,
    refetch: refetchDevices,
  } = useQuery<Device[]>({
    queryKey: ['adminUserDevices', user._id],
    queryFn: () =>
      httpBrowserClient.get(ApiEndpoints.admin.getUserDevices(user._id)).then((r) => r.data),
  })

  // Mutations
  const roleMutation = useMutation({
    mutationFn: () => httpBrowserClient.patch(ApiEndpoints.admin.updateRole(user._id), { role }),
    onSuccess: () => showSuccess('Role updated successfully'),
    onError: (error) => showError(extractErrorMessage(error, 'Failed to update role')),
  })

  const banMutation = useMutation({
    mutationFn: () => httpBrowserClient.patch(ApiEndpoints.admin.toggleBan(user._id), { isBanned }),
    onSuccess: () => showSuccess(isBanned ? 'User banned' : 'User unbanned'),
    onError: (error) => showError(extractErrorMessage(error, 'Failed to update ban status')),
  })

  const subscriptionMutation = useMutation({
    mutationFn: () => {
      const endDate = computeExpiryDate(expiryPreset, customDate)
      return httpBrowserClient.post(ApiEndpoints.admin.overrideSubscription(user._id), {
        planName,
        subscriptionEndDate: endDate ?? undefined,
        customDailyLimit: customDailyLimit !== '' ? Number(customDailyLimit) : undefined,
        customMonthlyLimit: customMonthlyLimit !== '' ? Number(customMonthlyLimit) : undefined,
        customBulkSendLimit: customBulkSendLimit !== '' ? Number(customBulkSendLimit) : undefined,
        notes,
      })
    },
    onSuccess: () => showSuccess('Subscription updated successfully'),
    onError: (error) => showError(extractErrorMessage(error, 'Failed to update subscription')),
  })

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: string) =>
      httpBrowserClient.delete(ApiEndpoints.admin.deleteDevice(deviceId)),
    onSuccess: () => { showSuccess('Device deleted'); refetchDevices() },
    onError: (error) => showError(extractErrorMessage(error, 'Failed to delete device')),
  })

  const saveDeviceMutation = useMutation({
    mutationFn: () => {
      const payload = buildDevicePayload(deviceForm)
      if (deviceForm.id) {
        return httpBrowserClient.patch(ApiEndpoints.admin.updateDevice(deviceForm.id), payload)
      }
      return httpBrowserClient.post(ApiEndpoints.admin.createUserDevice(user._id), payload)
    },
    onSuccess: () => {
      showSuccess(deviceForm.id ? 'Device updated' : 'Device added')
      setDeviceForm(emptyDeviceForm)
      refetchDevices()
    },
    onError: (error) => showError(extractErrorMessage(error, 'Failed to save device')),
  })

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setErrorMsg(''); setTimeout(() => setSuccessMsg(''), 3000) }
  const showError = (msg: string) => { setErrorMsg(msg); setSuccessMsg('') }

  const handleSaveAll = async () => {
    setErrorMsg('')
    if (!planExists) {
      showError(`Plan "${planName}" is not available. Add it in billing plans first.`)
      return
    }
    if (isCustomDateMissing) {
      showError('Choose a custom subscription expiry date before saving.')
      return
    }
    try {
      await roleMutation.mutateAsync()
      await banMutation.mutateAsync()
      await subscriptionMutation.mutateAsync()
      setTimeout(onSuccess, 1000)
    } catch {
      // individual mutation error handlers fire
    }
  }

  const isLoading =
    roleMutation.isPending || banMutation.isPending || subscriptionMutation.isPending
  const saveDisabled = isLoading || plansLoading || !planExists || isCustomDateMissing
  const deviceSaveDisabled =
    saveDeviceMutation.isPending ||
    (!deviceForm.name.trim() && !deviceForm.model.trim())

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <div className='relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700'>
        {/* Header */}
        <div className='sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 rounded-t-2xl'>
          <div className='flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-sm flex-shrink-0'>
              {(user.name || user.email)?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <h2 className='font-bold text-gray-900 dark:text-white text-base leading-tight'>{user.name || 'No Name'}</h2>
              <p className='text-xs text-gray-400'>{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <div className='p-6 space-y-6'>
          {/* Success / Error */}
          {successMsg && (
            <div className='flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-4 py-3 text-sm text-green-700 dark:text-green-400'>
              ✅ {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className='flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-400'>
              <AlertTriangle className='h-4 w-4 flex-shrink-0' /> {errorMsg}
            </div>
          )}

          {/* ── Section 1: Role & Status ─────────────────────────────── */}
          <section className='space-y-3'>
            <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700 pb-2'>
              Role & Status
            </h3>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {/* Role */}
              <div className='space-y-1.5'>
                <label className='text-xs font-medium text-gray-600 dark:text-gray-400'>User Role</label>
                <div className='flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600'>
                  {['REGULAR', 'ADMIN'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRole(r)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                        role === r
                          ? r === 'ADMIN'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-600 text-white'
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {r === 'ADMIN' ? <ShieldCheck className='h-4 w-4' /> : <ShieldX className='h-4 w-4' />}
                      {r === 'ADMIN' ? 'Admin' : 'Regular'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ban Status */}
              <div className='space-y-1.5'>
                <label className='text-xs font-medium text-gray-600 dark:text-gray-400'>Account Status</label>
                <div className='flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600'>
                  <button
                    onClick={() => setIsBanned(false)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                      !isBanned
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    ✅ Active
                  </button>
                  <button
                    onClick={() => setIsBanned(true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${
                      isBanned
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    🚫 Banned
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 2: Subscription Override ────────────────────── */}
          <section className='space-y-3'>
            <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2'>
              <Crown className='h-4 w-4 text-amber-500' /> Subscription Override
            </h3>

            {/* Plan selector */}
            <div className='space-y-1.5'>
              <label className='text-xs font-medium text-gray-600 dark:text-gray-400'>Plan</label>
              <div className='flex gap-2 flex-wrap'>
                {(hasAvailablePlans ? plans.map((plan) => plan.name) : [planName]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlanName(p)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors capitalize ${
                      planName === p
                        ? getPlanTone(p)
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              {plansLoading && (
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  Loading billing plans...
                </p>
              )}
              {!plansLoading && !hasAvailablePlans && (
                <p className='text-xs text-amber-600 dark:text-amber-400'>
                  No billing plans were returned by the API. Check the plans collection before overriding subscriptions.
                </p>
              )}
              {!plansLoading && hasAvailablePlans && !planExists && (
                <p className='text-xs text-red-600 dark:text-red-400'>
                  The current plan is not available in billing plans. Add it before saving changes.
                </p>
              )}
              {selectedPlan && (
                <div className='grid grid-cols-3 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs dark:border-gray-700 dark:bg-gray-700/40'>
                  <div>
                    <p className='text-gray-400'>Daily</p>
                    <p className='font-semibold text-gray-700 dark:text-gray-200'>{formatLimit(selectedPlan.dailyLimit)}</p>
                  </div>
                  <div>
                    <p className='text-gray-400'>Monthly</p>
                    <p className='font-semibold text-gray-700 dark:text-gray-200'>{formatLimit(selectedPlan.monthlyLimit)}</p>
                  </div>
                  <div>
                    <p className='text-gray-400'>Bulk</p>
                    <p className='font-semibold text-gray-700 dark:text-gray-200'>{formatLimit(selectedPlan.bulkSendLimit)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Expiry */}
            <div className='space-y-1.5'>
              <label className='text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1'>
                <CalendarDays className='h-3.5 w-3.5' /> Subscription Duration
              </label>
              <div className='flex flex-wrap gap-2'>
                {EXPIRY_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setExpiryPreset(preset.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      expiryPreset === preset.value
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {expiryPreset === 'custom' && (
                <input
                  type='date'
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className='mt-2 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              )}
              {isCustomDateMissing && (
                <p className='text-xs text-red-600 dark:text-red-400'>Choose a date to use the custom duration.</p>
              )}
            </div>

            {/* Custom Limits */}
            <div className='grid grid-cols-3 gap-3'>
              {[
                { label: 'Daily SMS Limit', value: customDailyLimit, setter: setCustomDailyLimit },
                { label: 'Monthly SMS Limit', value: customMonthlyLimit, setter: setCustomMonthlyLimit },
                { label: 'Bulk Send Limit', value: customBulkSendLimit, setter: setCustomBulkSendLimit },
              ].map(({ label, value, setter }) => (
                <div key={label} className='space-y-1.5'>
                  <label className='text-xs font-medium text-gray-600 dark:text-gray-400'>{label}</label>
                  <input
                    type='number'
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder='-1 = unlimited'
                    className='w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className='space-y-1.5'>
              <label className='text-xs font-medium text-gray-600 dark:text-gray-400'>Admin Notes (optional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='e.g. Paid via bank transfer, trial extension for 1 month...'
                className='w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none'
              />
            </div>
          </section>

          {/* ── Section 3: Devices ───────────────────────────────────── */}
          <section className='space-y-3'>
            <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2'>
              <Smartphone className='h-4 w-4 text-blue-500' /> Devices ({devices?.length ?? 0})
            </h3>
            <div className='rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/40'>
              <div className='mb-3 flex items-center justify-between'>
                <p className='text-sm font-semibold text-gray-800 dark:text-gray-100'>
                  {deviceForm.id ? 'Edit Device' : 'Add Device'}
                </p>
                {deviceForm.id && (
                  <button
                    onClick={() => setDeviceForm(emptyDeviceForm)}
                    className='text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                  >
                    Add new
                  </button>
                )}
              </div>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {[
                  ['name', 'Device name'],
                  ['brand', 'Brand'],
                  ['model', 'Model'],
                  ['os', 'OS'],
                  ['osVersion', 'OS version'],
                  ['appVersionName', 'App version'],
                  ['appVersionCode', 'Version code'],
                  ['smsSendDelaySeconds', 'Send delay seconds'],
                ].map(([field, placeholder]) => (
                  <input
                    key={field}
                    type={['appVersionCode', 'smsSendDelaySeconds'].includes(field) ? 'number' : 'text'}
                    value={deviceForm[field as keyof DeviceFormState] as string}
                    onChange={(e) => setDeviceForm((current) => ({ ...current, [field]: e.target.value }))}
                    placeholder={placeholder}
                    className='rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                  />
                ))}
              </div>
              <textarea
                rows={2}
                value={deviceForm.fcmToken}
                onChange={(e) => setDeviceForm((current) => ({ ...current, fcmToken: e.target.value }))}
                placeholder='FCM token'
                className='mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
              />
              <div className='mt-3 flex flex-wrap items-center justify-between gap-3'>
                <div className='flex flex-wrap items-center gap-4'>
                  <label className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300'>
                    <input
                      type='checkbox'
                      checked={deviceForm.enabled}
                      onChange={(e) => setDeviceForm((current) => ({ ...current, enabled: e.target.checked }))}
                      className='h-4 w-4 rounded border-gray-300 text-blue-600'
                    />
                    Enabled
                  </label>
                  <label className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300'>
                    <input
                      type='checkbox'
                      checked={deviceForm.receiveSMSEnabled}
                      onChange={(e) => setDeviceForm((current) => ({ ...current, receiveSMSEnabled: e.target.checked }))}
                      className='h-4 w-4 rounded border-gray-300 text-blue-600'
                    />
                    Receive SMS
                  </label>
                </div>
                <button
                  onClick={() => saveDeviceMutation.mutate()}
                  disabled={deviceSaveDisabled}
                  className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {saveDeviceMutation.isPending ? 'Saving...' : deviceForm.id ? 'Save Device' : 'Add Device'}
                </button>
              </div>
            </div>
            {devicesLoading ? (
              <div className='flex items-center justify-center py-6'>
                <Loader2 className='h-6 w-6 animate-spin text-gray-400' />
              </div>
            ) : !devices || devices.length === 0 ? (
              <p className='text-sm text-gray-400 text-center py-4'>No devices registered</p>
            ) : (
              <div className='space-y-2 max-h-48 overflow-y-auto pr-1'>
                {devices.map((device) => (
                  <DeviceCard
                    key={device._id}
                    device={device}
                    onEdit={(selectedDevice) => setDeviceForm(toDeviceForm(selectedDevice))}
                    onDelete={(id) => deleteDeviceMutation.mutateAsync(id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer Actions */}
        <div className='sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 rounded-b-2xl'>
          <button
            onClick={onClose}
            className='rounded-lg border border-gray-200 dark:border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saveDisabled}
            className='flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md'
          >
            {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
            Save All Changes
          </button>
        </div>
      </div>
    </div>
  )
}
