'use client'

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { ar } from './locales/ar'
import { en } from './locales/en'

export type Locale = 'en' | 'ar'

const STORAGE_KEY = 'textbee-locale'

const dictionaries = {
  en,
  ar,
} as const

type Dictionary = typeof en
type TranslationKey = {
  [K in keyof Dictionary]: `${K}.${Extract<keyof Dictionary[K], string>}`
}[keyof Dictionary]

type I18nContextValue = {
  locale: Locale
  direction: 'ltr' | 'rtl'
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: (key: TranslationKey, values?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en'

  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'ar' || stored === 'en' ? stored : 'en'
}

function interpolate(
  value: string,
  values?: Record<string, string | number>
): string {
  if (!values) return value

  return Object.entries(values).reduce(
    (current, [key, replacement]) =>
      current.replaceAll(`{${key}}`, String(replacement)),
    value
  )
}

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    setLocaleState(getStoredLocale())
  }, [])

  const direction = locale === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = direction
    window.localStorage.setItem(STORAGE_KEY, locale)
  }, [direction, locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction,
      setLocale: setLocaleState,
      toggleLocale: () =>
        setLocaleState((current) => (current === 'en' ? 'ar' : 'en')),
      t: (key, values) => {
        const [section, name] = key.split('.') as [
          keyof Dictionary,
          keyof Dictionary[keyof Dictionary],
        ]
        const translated = dictionaries[locale][section]?.[name]
        const fallback = dictionaries.en[section]?.[name]

        return interpolate(String(translated ?? fallback ?? key), values)
      },
    }),
    [direction, locale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }

  return context
}
