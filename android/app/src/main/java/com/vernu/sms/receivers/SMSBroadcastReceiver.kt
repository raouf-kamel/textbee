package com.vernu.sms.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.vernu.sms.AppConstants
import com.vernu.sms.dtos.SMSDTO
import com.vernu.sms.helpers.SMSFilterHelper
import com.vernu.sms.helpers.SharedPreferenceHelper
import com.vernu.sms.workers.SMSReceivedWorker
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap

class SMSBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "onReceive: ${intent.action}")

        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            Log.d(TAG, "Not Valid intent")
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages == null) {
            Log.d(TAG, "No messages found")
            return
        }

        val deviceId = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
            "",
        ).orEmpty()
        val apiKey = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_API_KEY_KEY,
            "",
        ).orEmpty()
        val receiveSMSEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_RECEIVE_SMS_ENABLED_KEY,
            false,
        )

        if (deviceId.isEmpty() || apiKey.isEmpty() || !receiveSMSEnabled) {
            Log.d(TAG, "Device ID or API Key is empty or Receive SMS Feature is disabled")
            return
        }

        val receivedSMSDTO = SMSDTO()
        for (message in messages) {
            receivedSMSDTO.message = receivedSMSDTO.message.orEmpty() + message.messageBody
            receivedSMSDTO.sender = message.originatingAddress
            receivedSMSDTO.receivedAtInMillis = message.timestampMillis
        }

        val sender = receivedSMSDTO.sender
        val message = receivedSMSDTO.message
        if (sender != null && !SMSFilterHelper.shouldProcessSMS(sender, message, context)) {
            Log.d(TAG, "SMS from $sender filtered out by filter rules")
            return
        }

        val fingerprint = generateFingerprint(
            receivedSMSDTO.sender,
            receivedSMSDTO.message,
            receivedSMSDTO.receivedAtInMillis,
        )
        receivedSMSDTO.fingerprint = fingerprint

        val currentTime = System.currentTimeMillis()
        val lastProcessedTime = processedFingerprints[fingerprint]

        if (lastProcessedTime != null && currentTime - lastProcessedTime < CACHE_TTL_MS) {
            Log.d(TAG, "Duplicate SMS detected in cache, skipping: $fingerprint")
            return
        }

        processedFingerprints[fingerprint] = currentTime
        cleanupCache(currentTime)

        SMSReceivedWorker.enqueueWork(context, deviceId, apiKey, receivedSMSDTO)
    }

    private fun generateFingerprint(sender: String?, message: String?, timestamp: Long): String {
        return try {
            val data = "${sender.orEmpty()}|${message.orEmpty()}|$timestamp"
            val hashBytes = MessageDigest.getInstance("MD5").digest(data.toByteArray(Charsets.UTF_8))
            hashBytes.joinToString(separator = "") { byte -> "%02x".format(byte) }
        } catch (e: Exception) {
            Log.e(TAG, "Error generating fingerprint: ${e.message}")
            "${sender.orEmpty()}_${message.orEmpty()}_$timestamp"
        }
    }

    private fun cleanupCache(currentTime: Long) {
        if (processedFingerprints.size > 100) {
            val keysToRemove = processedFingerprints
                .filterValues { timestamp -> currentTime - timestamp > CACHE_TTL_MS }
                .keys
                .toList()

            keysToRemove.forEach { key -> processedFingerprints.remove(key) }
            Log.d(TAG, "Cleaned up ${keysToRemove.size} expired cache entries")
        }
    }

    companion object {
        private const val TAG = "SMSBroadcastReceiver"
        private const val CACHE_TTL_MS = 5000L
        private val processedFingerprints = ConcurrentHashMap<String, Long>()
    }
}
