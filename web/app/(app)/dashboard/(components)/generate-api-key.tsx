import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { ApiEndpoints } from '@/config/api'
import { Routes } from '@/config/routes'
import { useToast } from '@/hooks/use-toast'
import httpBrowserClient from '@/lib/httpBrowserClient'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { QrCode, Copy, Smartphone, Download, AlertTriangle } from 'lucide-react'
import React, { forwardRef, useImperativeHandle, useState } from 'react'
import QRCode from 'react-qr-code'
import { useI18n } from '@/lib/i18n'

export type GenerateApiKeyHandle = {
  open: () => void
}

type GenerateApiKeyProps = {
  showTrigger?: boolean
}

const GenerateApiKey = forwardRef<GenerateApiKeyHandle, GenerateApiKeyProps>(
  function GenerateApiKey({ showTrigger = true }, ref) {
    const { t } = useI18n()
    const [isGenerateKeyModalOpen, setIsGenerateKeyModalOpen] = useState(false)
    const [isConfirmGenerateKeyModalOpen, setIsConfirmGenerateKeyModalOpen] =
      useState(false)

    const handleConfirmGenerateKey = () => {
      setIsConfirmGenerateKeyModalOpen(true)
    }

    useImperativeHandle(ref, () => ({
      open: () => setIsConfirmGenerateKeyModalOpen(true),
    }))

    const queryClient = useQueryClient()

    const {
      isPending: isGeneratingApiKey,
      mutateAsync: generateApiKey,
      data: generatedApiKey,
    } = useMutation({
      mutationKey: ['generate-api-key'],
      onSuccess: () => {
        setIsConfirmGenerateKeyModalOpen(false)
        setIsGenerateKeyModalOpen(true)
        queryClient.invalidateQueries({ queryKey: ['apiKeys', 'stats'] })
        queryClient.refetchQueries({ queryKey: ['apiKeys', 'stats'] })
        queryClient.invalidateQueries({ queryKey: ['devices'] })
      },
      mutationFn: () =>
        httpBrowserClient
          .post(ApiEndpoints.auth.generateApiKey())
          .then((res) => res.data),
    })

    const { toast } = useToast()

    const handleCopyKey = () => {
      navigator.clipboard.writeText(generatedApiKey?.data)
      toast({
        title: t('integrations.copied'),
      })
    }

    return (
      <>
        {showTrigger ? (
          <Button onClick={handleConfirmGenerateKey}>
            <QrCode className='mr-2 h-4 w-4' />
            {t('integrations.generateApiKey')}
          </Button>
        ) : null}

        <Dialog
          open={isConfirmGenerateKeyModalOpen}
          onOpenChange={setIsConfirmGenerateKeyModalOpen}
        >
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>{t('integrations.createApiKey')}</DialogTitle>
              <DialogDescription>
                <div className='space-y-2 text-sm text-muted-foreground'>
                  <p>
                    {t('integrations.generateWarning')}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className='flex flex-col space-y-4'>
              <Button
                onClick={() => generateApiKey()}
                disabled={isGeneratingApiKey}
              >
                {isGeneratingApiKey ? (
                  <div className='flex justify-center items-center h-full'>
                    <Spinner size='sm' className='text-white dark:text-black' />
                  </div>
                ) : (
                  t('integrations.generateApiKey')
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isGenerateKeyModalOpen}
          onOpenChange={setIsGenerateKeyModalOpen}
        >
          <DialogContent className='sm:max-w-lg'>
            <DialogHeader>
              <DialogTitle>{t('integrations.yourApiKey')}</DialogTitle>
              <DialogDescription>
                {t('integrations.apiKeyDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-6'>
              <div className='flex justify-center p-4 bg-muted dark:bg-white rounded-lg '>
                {generatedApiKey?.data && (
                  <QRCode value={generatedApiKey?.data} size={120} />
                )}
              </div>

              <div className='space-y-2'>
                <div className='flex items-center gap-2'>
                  <code className='relative rounded bg-muted px-[0.5rem] py-[0.3rem] font-mono text-sm flex-1'>
                    {generatedApiKey?.data}
                  </code>
                  <Button variant='outline' size='icon' onClick={handleCopyKey}>
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-4 text-sm'>
                <div className='space-y-2'>
                  <h4 className='font-medium flex items-center gap-2'>
                    <Smartphone className='h-4 w-4' />
                    {t('integrations.deviceRegistration')}
                  </h4>
                  <p className='text-muted-foreground'>
                    {t('integrations.deviceRegistrationDescription')}
                  </p>
                </div>

                <div className='space-y-2'>
                  <h4 className='font-medium flex items-center gap-2'>
                    <Download className='h-4 w-4' />
                    {t('integrations.noApp')}
                  </h4>
                  <p className='text-muted-foreground'>
                    {t('integrations.downloadApk', {
                      url: Routes.downloadAndroidApp,
                    }).split(Routes.downloadAndroidApp)[0]}
                    <a
                      href={Routes.downloadAndroidApp}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary hover:underline'
                    >
                      {Routes.downloadAndroidApp}
                    </a>
                    {t('integrations.downloadApk', {
                      url: Routes.downloadAndroidApp,
                    }).split(Routes.downloadAndroidApp)[1]}
                  </p>
                </div>

                <div className='space-y-2'>
                  <h4 className='font-medium'>
                    {t('integrations.externalServices')}
                  </h4>
                  <p className='text-muted-foreground'>
                    {t('integrations.externalServicesDescription')}
                  </p>
                </div>

                <div className='rounded-md bg-yellow-50 dark:bg-yellow-900/30 p-3 mt-4'>
                  <div className='flex items-center gap-2 text-yellow-800 dark:text-yellow-200'>
                    <AlertTriangle className='h-4 w-4' />
                    <p className='text-sm font-medium'>
                      {t('integrations.important')}
                    </p>
                  </div>
                  <p className='mt-2 text-sm text-yellow-700 dark:text-yellow-300'>
                    {t('integrations.saveWarning')}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  },
)

export default GenerateApiKey
