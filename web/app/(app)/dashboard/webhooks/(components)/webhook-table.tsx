'use client'
import { useParams, useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { DataTable } from './data-table'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Eye } from 'lucide-react'
import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'

interface ProductClientProps {
  data: ProductColumns[]
}

export type ProductColumns = {
  event?: string
  deviceName?: string
  webhookEvent?: string
  deliveryUrl?: string
  webhookSubscription?: {
    deliveryUrl: string
  }
  createdAt?: string
  status: string
  computedStatus?: string
  payload?: any
}


const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM dd, yyyy h:mm a')
}
const ProductClient = ({ data, isLoading, status = 'delivered' }) => {
  const { storeId } = useParams()
  const router = useRouter()
  const { t } = useI18n()

  const columns = useMemo<ColumnDef<ProductColumns>[]>(
    () => [
      {
        accessorKey: 'event',
        header: t('webhooks.event'),
      },
      {
        accessorKey: 'deviceName',
        header: t('sms.device'),
        cell: ({ row }) => {
          const deviceName = row.original.deviceName
          if (Array.isArray(deviceName) && deviceName.length === 2) {
            return (
              <div className="flex flex-col">
                <span className="font-medium">{deviceName[0]}</span>
                <span className="text-xs text-muted-foreground">
                  {deviceName[1]}
                </span>
              </div>
            )
          }
          return <span>{deviceName}</span>
        },
      },
      {
        accessorKey: 'status',
        header: t('common.status'),
      },
      {
        accessorKey: 'webhookSubscriptionData.deliveryUrl',
        header: t('webhooks.deliveryUrl'),
      },
      {
        accessorKey: 'createdAt',
        header: t('webhooks.createdAt'),
      },
      {
        id: 'actions',
        header: t('admin.action'),
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" disabled={!row.original.payload}>
            <Eye className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [t],
  )

  const formatted = data.map((d) => ({
    ...d,
    deviceName: [
      `${d.deviceData.brand}   ${d.deviceData.model}`,
      `  ${d.smsData._id}`,
    ],
    createdAt: formatDate(d.createdAt.toString()),
    status: d.computedStatus || status,
    payload: d.payload,
  }))

  return (
    <>
      <DataTable
        searchKey="event"
        columns={columns}
        data={formatted}
        isLoading={isLoading}
      />
    </>
  )
}

export default ProductClient
