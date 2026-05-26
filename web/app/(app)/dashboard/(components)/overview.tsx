'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Smartphone, Key, MessageSquare, TrendingUp } from 'lucide-react'
import GetStartedCard from './get-started'
import { ApiEndpoints } from '@/config/api'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
// import GetStartedCard from "@/components/get-started-card";

export const StatCard = ({ title, value, icon: Icon, description }) => {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <div className="rounded-full bg-primary/10 p-2">
          <Icon className='h-4 w-4 text-primary' />
        </div>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>
          {value !== undefined ? value : <Skeleton className='h-6 w-16' />}
        </div>
        <p className='text-xs text-muted-foreground mt-1 flex items-center'>
          {description}
          {value !== undefined && <TrendingUp className="ml-1 h-3 w-3 text-green-500" />}
        </p>
      </CardContent>
    </Card>
  )
}

export default function Overview() {
  const { t } = useI18n()
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () =>
      httpBrowserClient
        .get(ApiEndpoints.gateway.getStats())
        .then((res) => res.data?.data),
  })

  return (
    <div className='space-y-6'>
      <GetStartedCard />
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title={t('dashboard.totalSmsSent')}
          value={stats?.totalSentSMSCount?.toLocaleString()}
          icon={MessageSquare}
          description={t('dashboard.sinceLastYear')}
        />
        <StatCard
          title={t('dashboard.activeDevices')}
          value={stats?.totalDeviceCount}
          icon={Smartphone}
          description={t('dashboard.connectedNow')}
        />
        <StatCard
          title={t('dashboard.apiKeys')}
          value={stats?.totalApiKeyCount}
          icon={Key}
          description={t('dashboard.activeKeys')}
        />
        <StatCard
          title={t('dashboard.smsReceived')}
          value={stats?.totalReceivedSMSCount?.toLocaleString()}
          icon={BarChart3}
          description={t('dashboard.sinceLastYear')}
        />
      </div>
    </div>
  )
}
