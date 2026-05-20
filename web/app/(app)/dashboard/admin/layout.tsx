'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user?.role !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return (
      <div className='flex min-h-[50vh] items-center justify-center'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600'></div>
      </div>
    )
  }

  if (!session || session.user?.role !== 'ADMIN') {
    return null
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      {/* Admin Header Banner */}
      <div className='bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-6 py-3 flex items-center gap-3 shadow-md'>
        <ShieldAlert className='h-5 w-5' />
        <span className='font-semibold text-sm tracking-wide'>Admin Control Panel</span>
        <span className='ml-auto text-xs opacity-75'>Logged in as: {session.user?.email}</span>
      </div>
      <div className='p-4 md:p-6'>
        {children}
      </div>
    </div>
  )
}
