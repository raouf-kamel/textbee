'use client'

import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'

export default function LanguageToggle() {
  const { locale, toggleLocale, t } = useI18n()
  const nextLocaleLabel =
    locale === 'en'
      ? t('language.switchToArabic')
      : t('language.switchToEnglish')

  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      onClick={toggleLocale}
      aria-label={t('language.label')}
      className='gap-2'
    >
      <Languages className='h-4 w-4' />
      <span className='hidden sm:inline'>{nextLocaleLabel}</span>
    </Button>
  )
}
