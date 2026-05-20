package com.vernu.sms

import android.app.Application
import android.util.Log
import androidx.work.Configuration
import androidx.work.WorkManager

class SMSGatewayApplication : Application(), Configuration.Provider {
    override fun onCreate() {
        super.onCreate()

        try {
            WorkManager.initialize(this, workManagerConfiguration)
            Log.d(TAG, "WorkManager initialized successfully")
        } catch (e: IllegalStateException) {
            Log.d(TAG, "WorkManager already initialized or will be initialized automatically")
        }
    }

    override fun getWorkManagerConfiguration(): Configuration {
        return Configuration.Builder()
            .setMinimumLoggingLevel(Log.INFO)
            .build()
    }

    companion object {
        private const val TAG = "SMSGatewayApplication"
    }
}
