import React, { Component } from 'react'
import { ar } from '@/lib/locales/ar'
import { en } from '@/lib/locales/en'

interface ErrorBoundaryProps {
  fallback?: string | React.ReactNode
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state = { hasError: false }

  static getDerivedStateFromError(error) {
    console.log(error)
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.log(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const locale =
        typeof document !== 'undefined' && document.documentElement.lang === 'ar'
          ? 'ar'
          : 'en'

      return (
        this.props.fallback ||
        (locale === 'ar' ? ar.auth.somethingWentWrong : en.auth.somethingWentWrong)
      )
    }

    return this.props.children
  }
}
