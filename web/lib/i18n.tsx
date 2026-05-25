'use client'

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type Locale = 'en' | 'ar'

const STORAGE_KEY = 'textbee-locale'

const dictionaries = {
  en: {
    language: {
      label: 'Language',
      current: 'English',
      switchToArabic: 'Arabic',
      switchToEnglish: 'English',
    },
    common: {
      dashboard: 'Dashboard',
      messaging: 'Messaging',
      community: 'Community',
      account: 'Account',
      admin: 'Admin',
      contribute: 'Contribute',
      login: 'Log in',
      logout: 'Log out',
      getStarted: 'Get started',
      home: 'Home',
      downloadApp: 'Download App',
      status: 'Status',
      privacyPolicy: 'Privacy Policy',
      termsOfService: 'Terms of Service',
      refundPolicy: 'Refund Policy',
      allRightsReserved: 'All rights reserved',
      or: 'Or',
      email: 'Email',
      password: 'Password',
      fullName: 'Full Name',
      phoneOptional: 'Phone (optional)',
      user: 'User',
    },
    theme: {
      toggle: 'Toggle theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    auth: {
      welcomeBack: 'Welcome back',
      loginDescription: 'Enter your credentials to access your account',
      forgotPassword: 'Forgot your password?',
      noAccount: "Don't have an account?",
      signUp: 'Sign up',
      signIn: 'Sign In',
      signingIn: 'Signing in...',
      createAccount: 'Create an account',
      registerDescription: 'Enter your details to get started',
      alreadyHaveAccount: 'Already have an account?',
      signInLink: 'Sign in',
      creatingAccount: 'Creating account...',
      marketingOptIn:
        'I want to receive updates about new features and promotions',
      invalidEmail: 'Invalid email address',
      passwordRequired: 'Password is required',
      botVerificationRequired: 'Please complete the bot verification',
      invalidCredentials: 'Invalid email or password',
      unexpectedError: 'An unexpected error occurred. Please try again.',
      nameTooShort: 'Name must be at least 2 characters long',
      passwordTooShort: 'Password must be at least 8 characters long',
      failedCreateAccount: 'Failed to create account',
      googleLogin: 'Continue with Google',
      success: 'Success',
      error: 'Error',
      googleLoginSuccess: 'You are logged in with Google',
      somethingWentWrong: 'Something went wrong',
      resetPassword: 'Reset your password',
      requestResetDescription:
        "Enter your email address and we'll send you a link to reset your password",
      sendingResetLink: 'Sending reset link...',
      sendResetLink: 'Send reset link',
      checkEmail: 'Check your email',
      resetEmailSent:
        'If an account exists for {email}, you will receive a password reset link shortly.',
      resetEmailHelp:
        "If you don't receive an email, please check your spam folder or contact support.",
      backToLogin: 'Back to login',
      newPasswordDescription: 'Enter your new password below',
      otpRequired: 'OTP is required',
      confirmPasswordRequired: 'Please confirm your password',
      passwordsMustMatch: 'Passwords must match',
      failedResetPassword: 'Failed to reset password',
      otp: 'OTP',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      resettingPassword: 'Resetting password...',
      passwordResetSuccessTitle: 'Password reset successful',
      passwordResetSuccessDescription:
        'Your password has been reset successfully. You can now login with your new password.',
      loggingOut: 'Logging out...',
    },
    dashboard: {
      quickStart: 'Quick Start',
      welcomeBack: 'Welcome back, {name}',
    },
  },
  ar: {
    language: {
      label: 'اللغة',
      current: 'العربية',
      switchToArabic: 'العربية',
      switchToEnglish: 'English',
    },
    common: {
      dashboard: 'لوحة التحكم',
      messaging: 'الرسائل',
      community: 'المجتمع',
      account: 'الحساب',
      admin: 'الإدارة',
      contribute: 'المساهمة',
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      getStarted: 'ابدأ الآن',
      home: 'الرئيسية',
      downloadApp: 'تحميل التطبيق',
      status: 'الحالة',
      privacyPolicy: 'سياسة الخصوصية',
      termsOfService: 'شروط الخدمة',
      refundPolicy: 'سياسة الاسترداد',
      allRightsReserved: 'جميع الحقوق محفوظة',
      or: 'أو',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      fullName: 'الاسم الكامل',
      phoneOptional: 'الهاتف (اختياري)',
      user: 'المستخدم',
    },
    theme: {
      toggle: 'تبديل المظهر',
      light: 'فاتح',
      dark: 'داكن',
      system: 'النظام',
    },
    auth: {
      welcomeBack: 'مرحبًا بعودتك',
      loginDescription: 'أدخل بياناتك للوصول إلى حسابك',
      forgotPassword: 'هل نسيت كلمة المرور؟',
      noAccount: 'ليس لديك حساب؟',
      signUp: 'إنشاء حساب',
      signIn: 'تسجيل الدخول',
      signingIn: 'جار تسجيل الدخول...',
      createAccount: 'إنشاء حساب',
      registerDescription: 'أدخل بياناتك للبدء',
      alreadyHaveAccount: 'لديك حساب بالفعل؟',
      signInLink: 'تسجيل الدخول',
      creatingAccount: 'جار إنشاء الحساب...',
      marketingOptIn: 'أرغب في تلقي تحديثات عن الميزات والعروض الجديدة',
      invalidEmail: 'البريد الإلكتروني غير صالح',
      passwordRequired: 'كلمة المرور مطلوبة',
      botVerificationRequired: 'يرجى إكمال التحقق من أنك لست روبوتًا',
      invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      unexpectedError: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      nameTooShort: 'يجب أن يتكون الاسم من حرفين على الأقل',
      passwordTooShort: 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل',
      failedCreateAccount: 'تعذر إنشاء الحساب',
      googleLogin: 'المتابعة باستخدام Google',
      success: 'نجاح',
      error: 'خطأ',
      googleLoginSuccess: 'تم تسجيل الدخول باستخدام Google',
      somethingWentWrong: 'حدث خطأ ما',
      resetPassword: 'إعادة تعيين كلمة المرور',
      requestResetDescription:
        'أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيين كلمة المرور',
      sendingResetLink: 'جار إرسال رابط إعادة التعيين...',
      sendResetLink: 'إرسال رابط إعادة التعيين',
      checkEmail: 'تحقق من بريدك الإلكتروني',
      resetEmailSent:
        'إذا كان يوجد حساب للبريد {email} فستصلك رسالة إعادة تعيين كلمة المرور قريبًا.',
      resetEmailHelp:
        'إذا لم تصلك الرسالة، يرجى التحقق من مجلد الرسائل غير المرغوبة أو التواصل مع الدعم.',
      backToLogin: 'العودة إلى تسجيل الدخول',
      newPasswordDescription: 'أدخل كلمة المرور الجديدة أدناه',
      otpRequired: 'رمز التحقق مطلوب',
      confirmPasswordRequired: 'يرجى تأكيد كلمة المرور',
      passwordsMustMatch: 'يجب أن تتطابق كلمتا المرور',
      failedResetPassword: 'تعذر إعادة تعيين كلمة المرور',
      otp: 'رمز التحقق',
      newPassword: 'كلمة المرور الجديدة',
      confirmPassword: 'تأكيد كلمة المرور',
      resettingPassword: 'جار إعادة تعيين كلمة المرور...',
      passwordResetSuccessTitle: 'تمت إعادة تعيين كلمة المرور',
      passwordResetSuccessDescription:
        'تمت إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
      loggingOut: 'جار تسجيل الخروج...',
    },
    dashboard: {
      quickStart: 'دليل البدء',
      welcomeBack: 'مرحبًا بعودتك، {name}',
    },
  },
} as const

type Dictionary = typeof dictionaries.en
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
