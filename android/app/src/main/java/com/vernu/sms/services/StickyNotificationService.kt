package com.vernu.sms.services

import android.app.ForegroundServiceStartNotAllowedException
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.vernu.sms.AppConstants
import com.vernu.sms.R
import com.vernu.sms.activities.MainActivity
import com.vernu.sms.helpers.SharedPreferenceHelper

class StickyNotificationService : Service() {
    override fun onBind(intent: Intent?): IBinder? {
        Log.i(TAG, "Service onBind ${intent?.action}")
        return null
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Service Started")

        val stickyNotificationEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
            applicationContext,
            AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
            false,
        )

        if (stickyNotificationEnabled) {
            val notification = createNotification()
            try {
                startForeground(1, notification)
                Log.i(TAG, "Started foreground service with sticky notification")
            } catch (e: ForegroundServiceStartNotAllowedException) {
                Log.w(TAG, "Cannot start foreground from background, stopping service: ${e.message}")
                stopSelf()
            }
        } else {
            Log.i(TAG, "Sticky notification disabled by user preference")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "Received start id $startId: $intent")
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "StickyNotificationService destroyed")
    }

    private fun createNotification(): Notification {
        val notificationChannelId = "stickyNotificationChannel"

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channel = NotificationChannel(
                notificationChannelId,
                notificationChannelId,
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                enableVibration(false)
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)

            val notificationIntent = Intent(this, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

            Notification.Builder(this, notificationChannelId)
                .setContentTitle("TextBee Active")
                .setContentText("SMS gateway service is active")
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
        } else {
            NotificationCompat.Builder(this, notificationChannelId)
                .setContentTitle("TextBee Active")
                .setContentText("SMS gateway service is active")
                .setOngoing(true)
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
        }
    }

    companion object {
        private const val TAG = "StickyNotificationService"
    }
}
