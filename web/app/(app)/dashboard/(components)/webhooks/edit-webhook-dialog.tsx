'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { WebhookData } from '@/lib/types'
import { WEBHOOK_EVENTS } from '@/lib/constants'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { ApiEndpoints } from '@/config/api'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useI18n } from '@/lib/i18n'

const formSchema = z.object({
  deliveryUrl: z.string().url({ message: 'Please enter a valid URL' }),
  events: z.array(z.string()).min(1, { message: 'Select at least one event' }),
  isActive: z.boolean().default(true),
  signingSecret: z.string().min(1, { message: 'Signing secret is required' }),
})

interface EditWebhookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhook: WebhookData
}

export function EditWebhookDialog({
  open,
  onOpenChange,
  webhook,
}: EditWebhookDialogProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useI18n()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: {
      deliveryUrl: webhook.deliveryUrl,
      events: webhook.events,
      isActive: webhook.isActive,
      signingSecret: webhook.signingSecret,
    },
  })

  const { mutate: updateWebhook, isPending } = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      return httpBrowserClient.patch(
        ApiEndpoints.gateway.updateWebhook(webhook._id),
        values
      )
    },
    onSuccess: () => {
      toast({
        title: t('webhooks.success'),
        description: t('webhooks.updated'),
      })
      // Invalidate and refetch webhooks list
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      onOpenChange(false)
    },
    onError: () => {
      toast({
        title: t('common.error'),
        description: t('webhooks.updateFailed'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    updateWebhook(values)
  }

  const message_events = [
    'MESSAGE_RECEIVED',
    'MESSAGE_SENT',
    'MESSAGE_DELIVERED',
    'MESSAGE_FAILED',
    
    // TODO: handle these events better in the future
    // 'UNKNOWN_STATE',
    // 'SMS_STATUS_UPDATED',
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>{t('webhooks.edit')}</DialogTitle>
          <DialogDescription>
            {t('webhooks.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            <FormField
              control={form.control}
              name='deliveryUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webhooks.deliveryUrl')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='https://api.example.com/webhooks'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('webhooks.deliveryDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='signingSecret'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webhooks.signingSecret')}</FormLabel>
                  <FormControl>
                    <div className='flex space-x-2'>
                      <Input {...field} type='text' />
                      <Button
                        type='button'
                        variant='outline'
                        onClick={() => field.onChange(uuidv4())}
                      >
                        {t('webhooks.generate')}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('webhooks.signingDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='events'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webhooks.events')}</FormLabel>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <FormControl>
                        <Button
                          variant='outline'
                          className='w-full justify-between'
                        >
                          {field.value && field.value.length > 0
                            ? t('webhooks.eventsSelected', {
                                count: field.value.length,
                              })
                            : t('webhooks.selectEvents')}
                        </Button>
                      </FormControl>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className='w-full'>
                      {message_events.map((event) => (
                        <DropdownMenuCheckboxItem
                          key={event}
                          checked={field.value?.includes(event) || false}
                          onCheckedChange={(checked) => {
                            const currentValues = field.value || []
                            const newValues = checked
                              ? [...currentValues, event]
                              : currentValues.filter((v: string) => v !== event)
                            field.onChange(newValues)
                          }}
                          // 👇 prevent menu from closing
                          onSelect={(e) => e.preventDefault()}
                        >
                          {event}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <FormDescription>
                    {t('webhooks.eventsDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className='flex justify-end space-x-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending ? t('webhooks.updating') : t('webhooks.update')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
