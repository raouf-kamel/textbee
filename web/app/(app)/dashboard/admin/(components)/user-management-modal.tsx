'use client'

import { useState, useEffect } from 'react'
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
  model?: string
  os?: string
  osVersion?: string
  enabled: boolean
  sentSMSCount: number
  lastHeartbeat?: string
  createdAt: string
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

// ─── Device Card ──────────────────────────────────────────────────────────────
function DeviceCard({ device, onDelete }: { device: Device; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Delete device "${device.name || device.model || device._id}"?`)) return
    setDeleting(true)
    await onDelete(device._id)
    setDeleting(false)
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
      <button
        onClick={handleDelete}
        disabled={deleting}
        className='flex-shrink-0 flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors'
      >
        {deleting ? <Loader2 className='h-3 w-3 animate-spin' /> : <Trash2 className='h-3 w-3' />}
        Delete
      </button>
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

  // Fetch plans to auto-populate limits
  const { data: plansData } = useQuery({
    queryKey: ['adminPlans'],
    queryFn: () => httpBrowserClient.get(ApiEndpoints.billing.plans()).then((r) => r.data),
  })
  const plans: any[] = Array.isArray(plansData) ? plansData : []

  // Auto-populate limits when plan changes
  useEffect(() => {
    const plan = plans.find((p: any) => p.name === planName)
    if (plan) {
      setCustomDailyLimit(plan.dailyLimit?.toString() ?? '')
      setCustomMonthlyLimit(plan.monthlyLimit?.toString() ?? '')
      setCustomBulkSendLimit(plan.bulkSendLimit?.toString() ?? '')
    }
  }, [planName, plans])

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
    onError: () => showError('Failed to update role'),
  })

  const banMutation = useMutation({
    mutationFn: () => httpBrowserClient.patch(ApiEndpoints.admin.toggleBan(user._id), { isBanned }),
    onSuccess: () => showSuccess(isBanned ? 'User banned' : 'User unbanned'),
    onError: () => showError('Failed to update ban status'),
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
    onError: () => showError('Failed to update subscription'),
  })

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: string) =>
      httpBrowserClient.delete(ApiEndpoints.admin.deleteDevice(deviceId)),
    onSuccess: () => { showSuccess('Device deleted'); refetchDevices() },
    onError: () => showError('Failed to delete device'),
  })

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setErrorMsg(''); setTimeout(() => setSuccessMsg(''), 3000) }
  const showError = (msg: string) => { setErrorMsg(msg); setSuccessMsg('') }

  const handleSaveAll = async () => {
    setErrorMsg('')
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
                {['free', 'pro', 'custom'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlanName(p)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors capitalize ${
                      planName === p
                        ? p === 'pro'
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : p === 'custom'
                          ? 'bg-purple-600 border-purple-600 text-white'
                          : 'bg-gray-600 border-gray-600 text-white'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {p === 'pro' && '⭐ '}
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
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
            disabled={isLoading}
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
