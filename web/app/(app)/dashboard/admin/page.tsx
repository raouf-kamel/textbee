'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import {
  Users,
  Smartphone,
  MessageSquareText,
  Crown,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
} from 'lucide-react'
import UserManagementModal from './(components)/user-management-modal'
import { useI18n } from '@/lib/i18n'

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
  }
  devicesCount: number
  smsCount: number
}

type Stats = {
  totalUsers: number
  totalDevices: number
  totalSMS: number
  activeSubscriptions: number
  planCounts: { free: number; pro: number; custom: number }
}

type AdminTab = 'overview' | 'users' | 'devices' | 'billing'

type DeviceMonitoringDevice = {
  _id: string
  name?: string
  brand?: string
  manufacturer?: string
  model?: string
  os?: string
  osVersion?: string
  appVersionName?: string
  appVersionCode?: number
  enabled: boolean
  heartbeatEnabled?: boolean
  lastHeartbeat?: string
  heartbeatAgeMinutes?: number | null
  sentSMSCount: number
  receivedSMSCount: number
  smsSendDelaySeconds?: number
  pendingSMSCount: number
  isOnline: boolean
  isStale: boolean
  hasHighPendingSMS: boolean
  connectionStatus?: 'online' | 'offline' | 'disabled' | 'fcm_invalid'
  fcmTokenStatus?: 'valid' | 'invalid'
  fcmTokenInvalidatedAt?: string
  fcmTokenInvalidReason?: string
  batteryInfo?: {
    percentage?: number
    isCharging?: boolean
    lastUpdated?: string
  }
  networkInfo?: {
    networkType?: 'wifi' | 'cellular' | 'none'
    lastUpdated?: string
  }
  user?: {
    _id: string
    name?: string
    email?: string
  }
}

type DeviceMonitoring = {
  thresholds: {
    staleHeartbeatMinutes: number
    highPendingSMS: number
  }
  summary: {
    totalDevices: number
    enabledDevices: number
    disabledDevices: number
    onlineDevices: number
    offlineDevices: number
    staleHeartbeatDevices: number
    highPendingDevices: number
    pendingMessagesTotal: number
  }
  attentionDevices: DeviceMonitoringDevice[]
}

type Plan = {
  _id?: string
  name: string
  dailyLimit: number
  monthlyLimit: number
  bulkSendLimit: number
  monthlyPrice?: number
  yearlyPrice?: number
  isActive?: boolean
  polarProductId?: string
  polarMonthlyProductId?: string
  polarYearlyProductId?: string
}

type PlanFormState = {
  id?: string
  name: string
  dailyLimit: string
  monthlyLimit: string
  bulkSendLimit: string
  monthlyPrice: string
  yearlyPrice: string
  isActive: boolean
}

type UserFilters = {
  status: string
  role: string
  plan: string
  hasDevices: string
  sortBy: string
  sortDir: string
}

type UsersSummary = {
  bannedUsers: number
  unverifiedUsers: number
  usersWithoutDevices: number
  totalMessages: number
}

type AdminUsersResponse = {
  users: User[]
  totalUsers: number
  totalPages: number
  currentPage: number
  summary: UsersSummary
}

const emptyPlanForm: PlanFormState = {
  name: '',
  dailyLimit: '',
  monthlyLimit: '',
  bulkSendLimit: '',
  monthlyPrice: '0',
  yearlyPrice: '0',
  isActive: true,
}

const defaultUserFilters: UserFilters = {
  status: 'all',
  role: 'all',
  plan: 'all',
  hasDevices: 'all',
  sortBy: 'createdAt',
  sortDir: 'desc',
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

function formatDeviceName(device: DeviceMonitoringDevice) {
  return device.name || [device.brand, device.model].filter(Boolean).join(' ') || 'Unknown Device'
}

function formatHeartbeat(timestamp?: string) {
  if (!timestamp) return 'Never'
  return new Date(timestamp).toLocaleString()
}

function formatHeartbeatAge(ageMinutes?: number | null) {
  if (ageMinutes === null || ageMinutes === undefined) return 'Never'
  if (ageMinutes < 1) return 'Just now'
  if (ageMinutes < 60) return `${ageMinutes}m ago`
  const hours = Math.floor(ageMinutes / 60)
  const minutes = ageMinutes % 60
  if (hours < 24) return minutes ? `${hours}h ${minutes}m ago` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours ? `${days}d ${remainingHours}h ago` : `${days}d ago`
}

function formatVersion(device: DeviceMonitoringDevice) {
  const androidVersion = device.osVersion ? `Android ${device.osVersion}` : device.os || 'Android -'
  const appVersion = [
    device.appVersionName ? `v${device.appVersionName}` : null,
    device.appVersionCode !== undefined && device.appVersionCode !== null
      ? `(${device.appVersionCode})`
      : null,
  ].filter(Boolean).join(' ')

  return `${androidVersion} / ${appVersion || 'App -'}`
}

function getDeviceConnectionBadge(device: DeviceMonitoringDevice) {
  if (device.connectionStatus === 'disabled') {
    return {
      label: 'Disabled',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
      icon: <WifiOff className='h-3 w-3' />,
    }
  }
  if (device.connectionStatus === 'fcm_invalid') {
    return {
      label: 'FCM Invalid',
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      icon: <AlertCircle className='h-3 w-3' />,
    }
  }
  if (device.isOnline) {
    return {
      label: 'Online',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      icon: <Wifi className='h-3 w-3' />,
    }
  }
  return {
    label: 'Offline',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: <WifiOff className='h-3 w-3' />,
  }
}

function formatBattery(device: DeviceMonitoringDevice) {
  if (typeof device.batteryInfo?.percentage !== 'number') return 'Battery -'
  const charging = device.batteryInfo.isCharging ? 'charging' : 'not charging'
  return `${device.batteryInfo.percentage}% ${charging}`
}

function formatNetwork(device: DeviceMonitoringDevice) {
  const network = device.networkInfo?.networkType
  if (!network) return 'Network -'
  return network.charAt(0).toUpperCase() + network.slice(1)
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  gradient,
  sub,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  gradient: string
  sub?: string
}) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient}`}>
      <div className='flex items-start justify-between'>
        <div>
          <p className='text-sm font-medium opacity-80'>{label}</p>
          <p className='mt-1 text-3xl font-bold'>{value.toLocaleString()}</p>
          {sub && <p className='mt-1 text-xs opacity-70'>{sub}</p>}
        </div>
        <div className='rounded-xl bg-white/20 p-3'>{icon}</div>
      </div>
    </div>
  )
}

// ─── Plan Badge ───────────────────────────────────────────────────────────────
function PlanBadge({ planName }: { planName: string }) {
  const styles: Record<string, string> = {
    pro: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300',
    custom: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-300',
    free: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-300',
  }
  const cls = styles[planName] ?? styles.free
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {planName === 'pro' && <Crown className='h-3 w-3' />}
      {planName.toUpperCase()}
    </span>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ isBanned, emailVerifiedAt }: { isBanned: boolean; emailVerifiedAt: string | null }) {
  if (isBanned)
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-300'>
        <ShieldX className='h-3 w-3' /> Banned
      </span>
    )
  if (!emailVerifiedAt)
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-300'>
        Unverified
      </span>
    )
  return (
    <span className='inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-300'>
      <CheckCircle2 className='h-3 w-3' /> Active
    </span>
  )
}

// ─── Role Badge ───────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  if (role === 'ADMIN')
    return (
      <span className='inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-300'>
        <ShieldCheck className='h-3 w-3' /> Admin
      </span>
    )
  return (
    <span className='inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-300'>
      User
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function DeviceMonitoringSection() {
  const {
    data,
    isLoading,
    refetch,
  } = useQuery<DeviceMonitoring>({
    queryKey: ['adminDeviceMonitoring'],
    queryFn: () => httpBrowserClient.get(ApiEndpoints.admin.deviceMonitoring()).then((r) => r.data),
  })

  const summary = data?.summary
  const thresholds = data?.thresholds
  const attentionDevices = data?.attentionDevices ?? []

  return (
    <div className='rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden'>
      <div className='flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-base font-semibold text-gray-900 dark:text-white'>Device Monitoring</h2>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            Online status, heartbeat freshness, app versions, and pending SMS pressure.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className='flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        >
          <RefreshCw className='h-4 w-4' />
          Refresh Devices
        </button>
      </div>

      <div className='space-y-5 p-5'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
          {[
            {
              label: 'Online',
              value: summary?.onlineDevices ?? 0,
              icon: <Wifi className='h-4 w-4 text-green-600 dark:text-green-300' />,
              tone: 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40',
            },
            {
              label: 'Offline',
              value: summary?.offlineDevices ?? 0,
              icon: <WifiOff className='h-4 w-4 text-red-600 dark:text-red-300' />,
              tone: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40',
            },
            {
              label: 'Stale Heartbeat',
              value: summary?.staleHeartbeatDevices ?? 0,
              icon: <AlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-300' />,
              tone: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40',
            },
            {
              label: 'High Pending',
              value: summary?.highPendingDevices ?? 0,
              icon: <MessageSquareText className='h-4 w-4 text-blue-600 dark:text-blue-300' />,
              tone: 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40',
            },
            {
              label: 'Pending SMS',
              value: summary?.pendingMessagesTotal ?? 0,
              icon: <Activity className='h-4 w-4 text-purple-600 dark:text-purple-300' />,
              tone: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40',
            },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl border p-3 ${item.tone}`}>
              <div className='flex items-center justify-between gap-3'>
                <span className='text-xs font-semibold uppercase'>{item.label}</span>
                {item.icon}
              </div>
              <p className='mt-2 text-2xl font-bold'>{isLoading ? '...' : item.value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className='flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400'>
          <span>{summary?.totalDevices ?? 0} total devices</span>
          <span>{summary?.enabledDevices ?? 0} enabled</span>
          <span>{summary?.disabledDevices ?? 0} disabled</span>
          <span>Stale after {thresholds?.staleHeartbeatMinutes ?? 30} minutes</span>
          <span>High pending at {thresholds?.highPendingSMS ?? 5}+ SMS</span>
        </div>

        <div>
          <div className='mb-3 flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-gray-800 dark:text-gray-100'>Devices needing attention</h3>
            <span className='text-xs text-gray-500 dark:text-gray-400'>{attentionDevices.length} shown</span>
          </div>

          <div className='overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700'>
            <table className='w-full min-w-[1120px] text-sm'>
              <thead className='bg-gray-50 dark:bg-gray-700/40'>
                <tr>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Device</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Status</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Last heartbeat</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Heartbeat age</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Versions</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>FCM</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Battery / Network</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Pending</th>
                  <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>User</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-gray-700'>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 9 }).map((__, cellIndex) => (
                        <td key={cellIndex} className='px-3 py-3'>
                          <div className='h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700' />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : attentionDevices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className='px-3 py-8 text-center text-gray-400'>
                      No devices need attention
                    </td>
                  </tr>
                ) : (
                  attentionDevices.map((device) => {
                    const connectionBadge = getDeviceConnectionBadge(device)
                    return (
                      <tr key={device._id}>
                        <td className='px-3 py-3'>
                          <p className='font-medium text-gray-900 dark:text-white'>{formatDeviceName(device)}</p>
                          <p className='text-xs text-gray-400'>{device.brand || '-'} {device.model || ''}</p>
                        </td>
                        <td className='px-3 py-3'>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${connectionBadge.className}`}>
                            {connectionBadge.icon}
                            {connectionBadge.label}
                          </span>
                        </td>
                        <td className='px-3 py-3 text-xs text-gray-500 dark:text-gray-400'>
                          {formatHeartbeat(device.lastHeartbeat)}
                        </td>
                        <td className='px-3 py-3 text-xs text-gray-600 dark:text-gray-300'>
                          {formatHeartbeatAge(device.heartbeatAgeMinutes)}
                        </td>
                        <td className='px-3 py-3 text-xs text-gray-600 dark:text-gray-300'>
                          {formatVersion(device)}
                        </td>
                        <td className='px-3 py-3'>
                          <div className='max-w-[170px] space-y-1'>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              device.fcmTokenStatus === 'invalid'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                              {device.fcmTokenStatus === 'invalid' ? 'Invalid' : 'Valid'}
                            </span>
                            {device.fcmTokenInvalidReason && (
                              <p className='line-clamp-2 text-xs text-orange-600 dark:text-orange-300' title={device.fcmTokenInvalidReason}>
                                {device.fcmTokenInvalidReason}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className='px-3 py-3 text-xs text-gray-600 dark:text-gray-300'>
                          <p>{formatBattery(device)}</p>
                          <p className='text-gray-400'>{formatNetwork(device)}</p>
                        </td>
                        <td className='px-3 py-3'>
                          <div className='space-y-1'>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              device.hasHighPendingSMS
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {device.pendingSMSCount}
                            </span>
                            <p className='text-xs text-gray-400'>
                              Delay {device.smsSendDelaySeconds ?? 5}s
                            </p>
                          </div>
                        </td>
                        <td className='px-3 py-3'>
                          <p className='max-w-[180px] truncate text-xs font-medium text-gray-700 dark:text-gray-200'>
                            {device.user?.name || device.user?.email || '-'}
                          </p>
                          {device.user?.email && (
                            <p className='max-w-[180px] truncate text-xs text-gray-400'>{device.user.email}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewSection({ stats, isLoading }: { stats?: Stats; isLoading: boolean }) {
  return (
    <div className='rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden'>
      <div className='border-b border-gray-200 px-5 py-4 dark:border-gray-700'>
        <h2 className='text-base font-semibold text-gray-900 dark:text-white'>Overview</h2>
        <p className='text-xs text-gray-500 dark:text-gray-400'>System snapshot and active plan distribution.</p>
      </div>
      <div className='grid gap-4 p-5 md:grid-cols-3'>
        {[
          ['Free Plans', stats?.planCounts?.free ?? 0, 'bg-gray-50 text-gray-700 dark:bg-gray-700/40 dark:text-gray-200'],
          ['Pro Plans', stats?.planCounts?.pro ?? 0, 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'],
          ['Custom Plans', stats?.planCounts?.custom ?? 0, 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'],
        ].map(([label, value, tone]) => (
          <div key={label} className={`rounded-xl border border-gray-200 p-4 dark:border-gray-700 ${tone}`}>
            <p className='text-xs font-semibold uppercase'>{label}</p>
            <p className='mt-2 text-2xl font-bold'>{isLoading ? '...' : Number(value).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanManagementSection() {
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const {
    data: plans = [],
    isLoading,
    refetch,
  } = useQuery<Plan[]>({
    queryKey: ['adminPlansManagement'],
    queryFn: () => httpBrowserClient.get(ApiEndpoints.admin.listPlans()).then((r) => r.data),
  })

  const savePlanMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim().toLowerCase(),
        dailyLimit: Number(form.dailyLimit),
        monthlyLimit: Number(form.monthlyLimit),
        bulkSendLimit: Number(form.bulkSendLimit),
        monthlyPrice: Number(form.monthlyPrice || 0),
        yearlyPrice: Number(form.yearlyPrice || 0),
        isActive: form.isActive,
      }

      if (form.id) {
        return httpBrowserClient.patch(ApiEndpoints.admin.updatePlan(form.id), payload)
      }

      return httpBrowserClient.post(ApiEndpoints.admin.upsertPlan(), payload)
    },
    onSuccess: () => {
      setMessage(form.id ? 'Plan updated successfully' : 'Plan created successfully')
      setError('')
      setForm(emptyPlanForm)
      refetch()
      setTimeout(() => setMessage(''), 3000)
    },
    onError: (err) => {
      setError(extractErrorMessage(err, 'Failed to save plan'))
      setMessage('')
    },
  })

  const editPlan = (plan: Plan) => {
    setForm({
      id: plan._id,
      name: plan.name,
      dailyLimit: String(plan.dailyLimit ?? ''),
      monthlyLimit: String(plan.monthlyLimit ?? ''),
      bulkSendLimit: String(plan.bulkSendLimit ?? ''),
      monthlyPrice: String(plan.monthlyPrice ?? 0),
      yearlyPrice: String(plan.yearlyPrice ?? 0),
      isActive: plan.isActive ?? true,
    })
    setMessage('')
    setError('')
  }

  const saveDisabled =
    savePlanMutation.isPending ||
    !form.name.trim() ||
    form.dailyLimit === '' ||
    form.monthlyLimit === '' ||
    form.bulkSendLimit === ''

  return (
    <div className='rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden'>
      <div className='flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 px-5 py-4'>
        <h2 className='text-base font-semibold text-gray-900 dark:text-white'>Billing Plans</h2>
        <p className='text-xs text-gray-500 dark:text-gray-400'>Create and update plan limits without editing Mongo manually.</p>
      </div>

      <div className='grid gap-4 p-5 lg:grid-cols-[1fr_360px]'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-100 dark:border-gray-700'>
                <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Plan</th>
                <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Daily</th>
                <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Monthly</th>
                <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Bulk</th>
                <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Status</th>
                <th className='px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500'>Action</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100 dark:divide-gray-700'>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className='px-3 py-6 text-center text-gray-400'>Loading plans...</td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-3 py-6 text-center text-gray-400'>No plans found</td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan._id ?? plan.name}>
                    <td className='px-3 py-2 font-medium capitalize text-gray-900 dark:text-white'>{plan.name}</td>
                    <td className='px-3 py-2 text-gray-600 dark:text-gray-300'>{formatLimit(plan.dailyLimit)}</td>
                    <td className='px-3 py-2 text-gray-600 dark:text-gray-300'>{formatLimit(plan.monthlyLimit)}</td>
                    <td className='px-3 py-2 text-gray-600 dark:text-gray-300'>{formatLimit(plan.bulkSendLimit)}</td>
                    <td className='px-3 py-2'>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${plan.isActive === false ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                        {plan.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className='px-3 py-2'>
                      <button
                        onClick={() => editPlan(plan)}
                        className='rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className='rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/30'>
          <div className='mb-3 flex items-center justify-between'>
            <h3 className='text-sm font-semibold text-gray-900 dark:text-white'>{form.id ? 'Edit Plan' : 'New Plan'}</h3>
            {form.id && (
              <button onClick={() => setForm(emptyPlanForm)} className='text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'>New</button>
            )}
          </div>
          <div className='space-y-3'>
            <input
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              placeholder='Plan name'
              className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
            />
            <div className='grid grid-cols-3 gap-2'>
              {[
                ['dailyLimit', 'Daily'],
                ['monthlyLimit', 'Monthly'],
                ['bulkSendLimit', 'Bulk'],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className='text-xs text-gray-500'>{label}</label>
                  <input
                    type='number'
                    value={form[field as keyof PlanFormState] as string}
                    onChange={(e) => setForm((current) => ({ ...current, [field]: e.target.value }))}
                    placeholder='-1'
                    className='mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                  />
                </div>
              ))}
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <input
                type='number'
                value={form.monthlyPrice}
                onChange={(e) => setForm((current) => ({ ...current, monthlyPrice: e.target.value }))}
                placeholder='Monthly price'
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
              />
              <input
                type='number'
                value={form.yearlyPrice}
                onChange={(e) => setForm((current) => ({ ...current, yearlyPrice: e.target.value }))}
                placeholder='Yearly price'
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
              />
            </div>
            <label className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300'>
              <input
                type='checkbox'
                checked={form.isActive}
                onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
                className='h-4 w-4 rounded border-gray-300 text-purple-600'
              />
              Active plan
            </label>
            {message && <p className='rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-300'>{message}</p>}
            {error && <p className='rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300'>{error}</p>}
            <button
              onClick={() => savePlanMutation.mutate()}
              disabled={saveDisabled}
              className='w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {savePlanMutation.isPending ? 'Saving...' : form.id ? 'Save Plan' : 'Create Plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [userFilters, setUserFilters] = useState<UserFilters>(defaultUserFilters)
  const LIMIT = 10

  // Stats query
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery<Stats>({
    queryKey: ['adminStats'],
    queryFn: () =>
      httpBrowserClient.get(ApiEndpoints.admin.stats()).then((r) => r.data),
  })

  // Users query
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery<AdminUsersResponse>({
    queryKey: ['adminUsers', page, search, userFilters],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.admin.listUsers(page, LIMIT, { search, ...userFilters }))
        .then((r) => r.data),
  })

  const refetchAll = useCallback(() => {
    refetchStats()
    refetchUsers()
  }, [refetchStats, refetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  const users: User[] = usersData?.users ?? []
  const totalPages: number = usersData?.totalPages ?? 1
  const totalUsers: number = usersData?.totalUsers ?? 0
  const usersSummary: UsersSummary = usersData?.summary ?? {
    bannedUsers: 0,
    unverifiedUsers: 0,
    usersWithoutDevices: 0,
    totalMessages: 0,
  }
  const updateUserFilter = (field: keyof UserFilters, value: string) => {
    setUserFilters((current) => ({ ...current, [field]: value }))
    setPage(1)
  }
  const resetUserFilters = () => {
    setUserFilters(defaultUserFilters)
    setSearch('')
    setSearchInput('')
    setPage(1)
  }
  const tabs: Array<{ key: AdminTab; label: string; icon: React.ReactNode }> = [
    { key: 'overview', label: t('admin.overview'), icon: <Activity className='h-4 w-4' /> },
    { key: 'users', label: t('admin.users'), icon: <Users className='h-4 w-4' /> },
    { key: 'devices', label: t('admin.devices'), icon: <Smartphone className='h-4 w-4' /> },
    { key: 'billing', label: t('admin.billing'), icon: <Crown className='h-4 w-4' /> },
  ]

  return (
    <div className='space-y-6'>
      {/* Page Title */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>{t('admin.dashboard')}</h1>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>{t('admin.description')}</p>
        </div>
        <button
          onClick={refetchAll}
          className='flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm'
        >
          <RefreshCw className='h-4 w-4' />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <StatCard
          label={t('admin.totalUsers')}
          value={statsLoading ? '...' : (stats?.totalUsers ?? 0)}
          icon={<Users className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-blue-500 to-blue-700'
          sub={`${stats?.planCounts?.pro ?? 0} Pro · ${stats?.planCounts?.custom ?? 0} Custom`}
        />
        <StatCard
          label={t('admin.totalDevices')}
          value={statsLoading ? '...' : (stats?.totalDevices ?? 0)}
          icon={<Smartphone className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-emerald-500 to-emerald-700'
        />
        <StatCard
          label={t('admin.totalSmsSent')}
          value={statsLoading ? '...' : (stats?.totalSMS ?? 0)}
          icon={<MessageSquareText className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-orange-500 to-rose-600'
        />
        <StatCard
          label={t('admin.activeSubscriptions')}
          value={statsLoading ? '...' : (stats?.activeSubscriptions ?? 0)}
          icon={<Crown className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-purple-500 to-indigo-700'
          sub={t('admin.freePlans', { count: stats?.planCounts?.free ?? 0 })}
        />
      </div>

      <div className='rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
        <div className='grid gap-1 sm:grid-cols-4'>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && <OverviewSection stats={stats} isLoading={statsLoading} />}

      {activeTab === 'devices' && <DeviceMonitoringSection />}

      {activeTab === 'billing' && <PlanManagementSection />}

      {/* Users Table */}
      {activeTab === 'users' && <div className='rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden'>
        {/* Table Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 dark:border-gray-700 px-5 py-4'>
          <div>
            <h2 className='text-base font-semibold text-gray-900 dark:text-white'>{t('admin.users')}</h2>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              {t('admin.totalUsersCount', { count: totalUsers })}
            </p>
          </div>
          <form onSubmit={handleSearch} className='flex items-center gap-2'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder={t('admin.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className='pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-56'
              />
            </div>
            <button
              type='submit'
              className='rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-medium text-white transition-colors'
            >
              {t('common.search')}
            </button>
            {search && (
              <button
                type='button'
                onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
                className='rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              >
                {t('common.clear')}
              </button>
            )}
          </form>
        </div>

        <div className='border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/50'>
          <div className='grid gap-3 md:grid-cols-3 lg:grid-cols-6'>
            <label className='space-y-1 text-xs font-medium text-gray-500 dark:text-gray-400'>
              {t('admin.status')}
              <select
                value={userFilters.status}
                onChange={(e) => updateUserFilter('status', e.target.value)}
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
              >
                <option value='all'>{t('admin.allStatuses')}</option>
                <option value='active'>{t('common.active')}</option>
                <option value='banned'>{t('common.banned')}</option>
                <option value='unverified'>{t('common.unverified')}</option>
              </select>
            </label>
            <label className='space-y-1 text-xs font-medium text-gray-500 dark:text-gray-400'>
              {t('admin.role')}
              <select
                value={userFilters.role}
                onChange={(e) => updateUserFilter('role', e.target.value)}
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
              >
                <option value='all'>{t('admin.allRoles')}</option>
                <option value='REGULAR'>{t('common.regular')}</option>
                <option value='ADMIN'>{t('common.adminRole')}</option>
              </select>
            </label>
            <label className='space-y-1 text-xs font-medium text-gray-500 dark:text-gray-400'>
              {t('admin.plan')}
              <select
                value={userFilters.plan}
                onChange={(e) => updateUserFilter('plan', e.target.value)}
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
              >
                <option value='all'>{t('admin.allPlans')}</option>
                <option value='free'>{t('account.free')}</option>
                <option value='pro'>Pro</option>
                <option value='custom'>Custom</option>
              </select>
            </label>
            <label className='space-y-1 text-xs font-medium text-gray-500 dark:text-gray-400'>
              {t('admin.devices')}
              <select
                value={userFilters.hasDevices}
                onChange={(e) => updateUserFilter('hasDevices', e.target.value)}
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
              >
                <option value='all'>{t('admin.anyDevices')}</option>
                <option value='with'>{t('admin.hasDevices')}</option>
                <option value='without'>{t('admin.noDevices')}</option>
              </select>
            </label>
            <label className='space-y-1 text-xs font-medium text-gray-500 dark:text-gray-400'>
              {t('admin.sortBy')}
              <select
                value={userFilters.sortBy}
                onChange={(e) => updateUserFilter('sortBy', e.target.value)}
                className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
              >
                <option value='createdAt'>{t('admin.joined')}</option>
                <option value='smsCount'>{t('admin.messages')}</option>
                <option value='devicesCount'>{t('admin.devices')}</option>
                <option value='plan'>{t('admin.plan')}</option>
                <option value='name'>{t('account.yourName')}</option>
                <option value='email'>{t('common.email')}</option>
              </select>
            </label>
            <div className='flex items-end gap-2'>
              <label className='flex-1 space-y-1 text-xs font-medium text-gray-500 dark:text-gray-400'>
                {t('admin.direction')}
                <select
                  value={userFilters.sortDir}
                  onChange={(e) => updateUserFilter('sortDir', e.target.value)}
                  className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                >
                  <option value='desc'>{t('admin.desc')}</option>
                  <option value='asc'>{t('admin.asc')}</option>
                </select>
              </label>
              <button
                type='button'
                onClick={resetUserFilters}
                className='rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              >
                {t('admin.reset')}
              </button>
            </div>
          </div>
          <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {[
              [t('common.banned'), usersSummary.bannedUsers],
              [t('common.unverified'), usersSummary.unverifiedUsers],
              [t('admin.noDevices'), usersSummary.usersWithoutDevices],
              [t('admin.filteredMessages'), usersSummary.totalMessages],
            ].map(([label, value]) => (
              <div key={label} className='rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800'>
                <p className='text-xs font-semibold uppercase text-gray-500'>{label}</p>
                <p className='mt-1 text-xl font-bold text-gray-900 dark:text-white'>{Number(value).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60'>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('common.user')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.status')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.role')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.plan')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.devices')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.messages')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.joined')}</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>{t('admin.action')}</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100 dark:divide-gray-700'>
              {usersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className='px-4 py-3'>
                        <div className='h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse' />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className='px-5 py-12 text-center text-gray-400 dark:text-gray-500'>
                    {t('admin.noUsersFound')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className='hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer'
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className='px-5 py-3'>
                      <div className='flex items-center gap-3'>
                        <div className='flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-xs font-bold flex-shrink-0'>
                          {(user.name || user.email)?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className='min-w-0'>
                          <p className='font-medium text-gray-900 dark:text-white truncate max-w-[160px]'>
                            {user.name || '—'}
                          </p>
                          <p className='text-xs text-gray-400 truncate max-w-[160px]'>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className='px-4 py-3'>
                      <StatusBadge isBanned={user.isBanned} emailVerifiedAt={user.emailVerifiedAt} />
                    </td>
                    <td className='px-4 py-3'>
                      <RoleBadge role={user.role} />
                    </td>
                    <td className='px-4 py-3'>
                      <PlanBadge planName={user.subscription?.plan?.name ?? 'free'} />
                    </td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-300'>
                      <span className='flex items-center gap-1'>
                        <Smartphone className='h-3.5 w-3.5 text-gray-400' />
                        {user.devicesCount}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-gray-600 dark:text-gray-300'>
                      <span className='flex items-center gap-1'>
                        <MessageSquareText className='h-3.5 w-3.5 text-gray-400' />
                        {user.smsCount ?? 0}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-xs text-gray-400'>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className='px-4 py-3'>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedUser(user) }}
                        className='rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors'
                      >
                        {t('admin.manage')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='flex items-center justify-between border-t border-gray-100 dark:border-gray-700 px-5 py-3'>
            <p className='text-xs text-gray-500 dark:text-gray-400'>
              {t('admin.pageOf', { page, totalPages })}
            </p>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className='flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronLeft className='h-3.5 w-3.5' /> {t('admin.prev')}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className='flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                {t('admin.next')} <ChevronRight className='h-3.5 w-3.5' />
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* User Management Modal */}
      {selectedUser && (
        <UserManagementModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSuccess={() => {
            setSelectedUser(null)
            refetchAll()
          }}
        />
      )}
    </div>
  )
}
