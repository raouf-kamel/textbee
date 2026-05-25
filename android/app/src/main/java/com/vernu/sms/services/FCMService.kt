package com.vernu.sms.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.google.gson.Gson
import com.vernu.sms.ApiManager
import com.vernu.sms.AppConstants
import com.vernu.sms.R
import com.vernu.sms.activities.MainActivity
import com.vernu.sms.dtos.RegisterDeviceInputDTO
import com.vernu.sms.dtos.RegisterDeviceResponseDTO
import com.vernu.sms.helpers.HeartbeatHelper
import com.vernu.sms.helpers.HeartbeatManager
import com.vernu.sms.helpers.SharedPreferenceHelper
import com.vernu.sms.models.SMSPayload
import com.vernu.sms.workers.SMSStatusUpdateWorker
import com.vernu.sms.workers.SmsSendWorker
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FCMService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d(TAG, remoteMessage.data.toString())

        try {
            val messageType = remoteMessage.data["type"]

            if (messageType == "heartbeat_check") {
                handleHeartbeatCheck()
                return
            }

            val smsPayload = Gson().fromJson(remoteMessage.data["smsData"], SMSPayload::class.java)

            if (remoteMessage.data.isNotEmpty()) {
                sendSMS(smsPayload)
            }

            if (remoteMessage.notification != null) {
                // Notification display is intentionally disabled for SMS dispatch payloads.
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing FCM message: ${e.message}")
        }
    }

    private fun handleHeartbeatCheck() {
        Log.d(TAG, "Received heartbeat check request from backend")

        if (!HeartbeatHelper.isDeviceEligibleForHeartbeat(this)) {
            Log.d(TAG, "Device not eligible for heartbeat, skipping heartbeat check")
            return
        }

        val deviceId = SharedPreferenceHelper.getSharedPreferenceString(
            this,
            AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
            ""
        ).orEmpty()
        val apiKey = SharedPreferenceHelper.getSharedPreferenceString(
            this,
            AppConstants.SHARED_PREFS_API_KEY_KEY,
            ""
        ).orEmpty()

        val success = HeartbeatHelper.sendHeartbeat(this, deviceId, apiKey)

        if (success) {
            Log.d(TAG, "Heartbeat sent successfully in response to backend check")
        } else {
            Log.e(TAG, "Failed to send heartbeat in response to backend check")
        }
        HeartbeatManager.scheduleHeartbeat(this)
    }

    private fun sendSMS(smsPayload: SMSPayload?) {
        if (smsPayload == null) {
            Log.e(TAG, "SMS payload is null")
            return
        }

        val recipients = smsPayload.recipients
        if (recipients.isNullOrEmpty()) {
            Log.e(TAG, "No recipients found in SMS payload")
            return
        }

        val message = smsPayload.message
        val smsId = smsPayload.smsId
        if (message == null || smsId == null) {
            Log.e(TAG, "Missing SMS message or SMS ID in payload")
            return
        }

        for (recipient in recipients) {
            SMSStatusUpdateWorker.enqueueStatus(
                this,
                smsId,
                smsPayload.smsBatchId,
                "RECEIVED_BY_DEVICE",
            )
            SmsSendWorker.enqueue(
                this,
                recipient,
                message,
                smsId,
                smsPayload.smsBatchId,
                smsPayload.simSubscriptionId
            )
        }

        Log.d(TAG, "Enqueued ${recipients.size} SMS for sending - Batch: ${smsPayload.smsBatchId}")
    }

    override fun onNewToken(token: String) {
        sendRegistrationToServer(token)
    }

    private fun sendRegistrationToServer(token: String) {
        val deviceId = SharedPreferenceHelper.getSharedPreferenceString(
            this,
            AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
            ""
        ).orEmpty()
        val apiKey = SharedPreferenceHelper.getSharedPreferenceString(
            this,
            AppConstants.SHARED_PREFS_API_KEY_KEY,
            ""
        ).orEmpty()

        if (deviceId.isEmpty() || apiKey.isEmpty()) {
            Log.d(TAG, "Device ID or API key not available, skipping FCM token update")
            return
        }

        val updateInput = RegisterDeviceInputDTO().apply {
            fcmToken = token
        }

        Log.d(TAG, "Updating FCM token for device: $deviceId")
        ApiManager.getApiService()
            .updateDevice(deviceId, apiKey, updateInput)
            .enqueue(object : Callback<RegisterDeviceResponseDTO> {
                override fun onResponse(
                    call: Call<RegisterDeviceResponseDTO>,
                    response: Response<RegisterDeviceResponseDTO>
                ) {
                    if (response.isSuccessful) {
                        Log.d(TAG, "FCM token updated successfully")
                    } else {
                        Log.e(TAG, "Failed to update FCM token. Response code: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<RegisterDeviceResponseDTO>, t: Throwable) {
                    Log.e(TAG, "Error updating FCM token: ${t.message}")
                }
            })
    }

    @Suppress("unused")
    private fun sendNotification(title: String, messageBody: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        var flags = PendingIntent.FLAG_ONE_SHOT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

        val channelId = DEFAULT_NOTIFICATION_CHANNEL_ID
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val notificationBuilder = NotificationCompat.Builder(this, DEFAULT_NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(messageBody)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Channel human readable title",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(0, notificationBuilder.build())
    }

    companion object {
        private const val TAG = "FirebaseMessagingService"
        private const val DEFAULT_NOTIFICATION_CHANNEL_ID = "N1"
    }
}
