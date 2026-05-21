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
} from 'lucide-react'
import UserManagementModal from './(components)/user-management-modal'

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
}

type Stats = {
  totalUsers: number
  totalDevices: number
  totalSMS: number
  activeSubscriptions: number
  planCounts: { free: number; pro: number; custom: number }
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

const emptyPlanForm: PlanFormState = {
  name: '',
  dailyLimit: '',
  monthlyLimit: '',
  bulkSendLimit: '',
  monthlyPrice: '0',
  yearlyPrice: '0',
  isActive: true,
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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
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
  } = useQuery({
    queryKey: ['adminUsers', page, search],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.admin.listUsers(page, LIMIT, search || undefined))
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

  return (
    <div className='space-y-6'>
      {/* Page Title */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>Admin Dashboard</h1>
          <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>Manage users, subscriptions, and system health</p>
        </div>
        <button
          onClick={refetchAll}
          className='flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm'
        >
          <RefreshCw className='h-4 w-4' />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
        <StatCard
          label='Total Users'
          value={statsLoading ? '...' : (stats?.totalUsers ?? 0)}
          icon={<Users className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-blue-500 to-blue-700'
          sub={`${stats?.planCounts?.pro ?? 0} Pro · ${stats?.planCounts?.custom ?? 0} Custom`}
        />
        <StatCard
          label='Total Devices'
          value={statsLoading ? '...' : (stats?.totalDevices ?? 0)}
          icon={<Smartphone className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-emerald-500 to-emerald-700'
        />
        <StatCard
          label='Total SMS Sent'
          value={statsLoading ? '...' : (stats?.totalSMS ?? 0)}
          icon={<MessageSquareText className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-orange-500 to-rose-600'
        />
        <StatCard
          label='Active Subscriptions'
          value={statsLoading ? '...' : (stats?.activeSubscriptions ?? 0)}
          icon={<Crown className='h-5 w-5 text-white' />}
          gradient='bg-gradient-to-br from-purple-500 to-indigo-700'
          sub={`${stats?.planCounts?.free ?? 0} Free plans`}
        />
      </div>

      <PlanManagementSection />

      {/* Users Table */}
      <div className='rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden'>
        {/* Table Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 dark:border-gray-700 px-5 py-4'>
          <div>
            <h2 className='text-base font-semibold text-gray-900 dark:text-white'>Users</h2>
            <p className='text-xs text-gray-500 dark:text-gray-400'>{totalUsers} total users</p>
          </div>
          <form onSubmit={handleSearch} className='flex items-center gap-2'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search name or email...'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className='pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 w-56'
              />
            </div>
            <button
              type='submit'
              className='rounded-lg bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-medium text-white transition-colors'
            >
              Search
            </button>
            {search && (
              <button
                type='button'
                onClick={() => { setSearch(''); setSearchInput(''); setPage(1) }}
                className='rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Table */}
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60'>
                <th className='px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>User</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Status</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Role</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Plan</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Devices</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Joined</th>
                <th className='px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'>Action</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100 dark:divide-gray-700'>
              {usersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className='px-4 py-3'>
                        <div className='h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse' />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className='px-5 py-12 text-center text-gray-400 dark:text-gray-500'>
                    No users found
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
                    <td className='px-4 py-3 text-xs text-gray-400'>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className='px-4 py-3'>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedUser(user) }}
                        className='rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors'
                      >
                        Manage
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
              Page {page} of {totalPages}
            </p>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className='flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                <ChevronLeft className='h-3.5 w-3.5' /> Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className='flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
              >
                Next <ChevronRight className='h-3.5 w-3.5' />
              </button>
            </div>
          </div>
        )}
      </div>

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
