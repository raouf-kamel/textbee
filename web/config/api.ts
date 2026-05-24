export const ApiEndpoints = {
  auth: {
    login: () => '/auth/login',
    register: () => '/auth/register',
    signInWithGoogle: () => '/auth/google-login',
    updateProfile: () => '/auth/update-profile',
    changePassword: () => '/auth/change-password',

    whoAmI: () => '/auth/who-am-i',
    updateOnboarding: () => '/auth/onboarding',

    sendEmailVerificationEmail: () => '/auth/send-email-verification-email',
    verifyEmail: () => '/auth/verify-email',

    requestPasswordReset: () => '/auth/request-password-reset',
    resetPassword: () => '/auth/reset-password',

    generateApiKey: () => '/auth/api-keys',
    listApiKeys: (status?: 'active' | 'revoked' | 'all') =>
      status
        ? `/auth/api-keys?status=${encodeURIComponent(status)}`
        : '/auth/api-keys',
    revokeApiKey: (id: string) => `/auth/api-keys/${id}/revoke`,
    renameApiKey: (id: string) => `/auth/api-keys/${id}/rename`,
    deleteApiKey: (id: string) => `/auth/api-keys/${id}`,
  },
  gateway: {
    listDevices: () => '/gateway/devices',
    deleteDevice: (id: string) => `/gateway/devices/${id}`,
    sendSMS: (id: string) => `/gateway/devices/${id}/send-sms`,
    sendBulkSMS: (id: string) => `/gateway/devices/${id}/send-bulk-sms`,
    getReceivedSMS: (id: string) => `/gateway/devices/${id}/get-received-sms`,
    getMessages: (id: string) => `/gateway/devices/${id}/messages`,

    getWebhooks: () => '/webhooks',
    getWebhookNotifications: () => '/webhooks/notifications',
    createWebhook: () => '/webhooks',
    updateWebhook: (id: string) => `/webhooks/${id}`,
    getStats: () => '/gateway/stats',
  },
  billing: {
    currentSubscription: () => '/billing/current-subscription',
    checkout: () => '/billing/checkout',
    plans: () => '/billing/plans',
  },
  support: {
    customerSupport: () => '/support/customer-support',
    requestAccountDeletion: () => '/support/request-account-deletion',
  },
  admin: {
    stats: () => '/admin/stats',
    deviceMonitoring: () => '/admin/devices/monitoring',
    listUsers: (
      page: number,
      limit: number,
      filters?: {
        search?: string
        status?: string
        role?: string
        plan?: string
        hasDevices?: string
        sortBy?: string
        sortDir?: string
      },
    ) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      Object.entries(filters ?? {}).forEach(([key, value]) => {
        if (value && value !== 'all') params.set(key, value)
      })
      return `/admin/users?${params.toString()}`
    },
    updateRole: (id: string) => `/admin/users/${id}/role`,
    toggleBan: (id: string) => `/admin/users/${id}/ban`,
    overrideSubscription: (id: string) => `/admin/users/${id}/subscription/override`,
    getUserDevices: (id: string) => `/admin/users/${id}/devices`,
    getUserMessages: (id: string, page: number, limit: number, type?: string, status?: string) => {
      const typeParam = type && type !== 'all' ? `&type=${encodeURIComponent(type)}` : ''
      const statusParam = status && status !== 'all' ? `&status=${encodeURIComponent(status)}` : ''
      return `/admin/users/${id}/messages?page=${page}&limit=${limit}${typeParam}${statusParam}`
    },
    cancelMessage: (messageId: string) => `/admin/messages/${messageId}/cancel`,
    deleteMessage: (messageId: string) => `/admin/messages/${messageId}`,
    createUserDevice: (id: string) => `/admin/users/${id}/devices`,
    updateDevice: (deviceId: string) => `/admin/devices/${deviceId}`,
    deleteDevice: (deviceId: string) => `/admin/devices/${deviceId}`,
    listPlans: () => '/admin/plans',
    upsertPlan: () => '/admin/plans',
    updatePlan: (id: string) => `/admin/plans/${id}`,
  },
}
