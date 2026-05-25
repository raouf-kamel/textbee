package com.vernu.sms.workers

import android.content.Context
import android.util.Log
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.vernu.sms.ApiManager
import com.vernu.sms.AppConstants
import com.vernu.sms.TextBeeUtils
import com.vernu.sms.helpers.SMSHelper
import com.vernu.sms.helpers.SharedPreferenceHelper

class SmsSendWorker(
    context: Context,
    workerParams: WorkerParameters,
) : Worker(context, workerParams) {
    override fun doWork(): Result {
        val phone = inputData.getString(KEY_PHONE)
        val message = inputData.getString(KEY_MESSAGE)
        val smsId = inputData.getString(KEY_SMS_ID)
        val smsBatchId = inputData.getString(KEY_SMS_BATCH_ID)
        val simSubscriptionId = inputData.getInt(KEY_SIM_SUBSCRIPTION_ID, -1)

        if (phone == null || message == null || smsId == null) {
            Log.e(TAG, "Missing required parameters")
            return Result.failure()
        }

        val context = applicationContext
        val resolvedSim = resolveSim(context, simSubscriptionId)

        if (!shouldSend(context, smsId)) {
            Log.i(TAG, "SMS skipped because server reported it should not be sent - ID: $smsId")
            return Result.success()
        }

        SMSStatusUpdateWorker.enqueueStatus(context, smsId, smsBatchId, "SENDING")

        if (resolvedSim != null) {
            SMSHelper.sendSMSFromSpecificSim(phone, message, resolvedSim, smsId, smsBatchId, context)
        } else {
            SMSHelper.sendSMS(phone, message, smsId, smsBatchId, context)
        }

        val delaySeconds = SharedPreferenceHelper.getSharedPreferenceInt(
            context,
            AppConstants.SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY,
            AppConstants.DEFAULT_SMS_SEND_DELAY_SECONDS,
        ).coerceIn(0, 3600)

        if (delaySeconds > 0) {
            try {
                Thread.sleep(delaySeconds * 1000L)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        }

        return Result.success()
    }

    private fun resolveSim(context: Context, backendSimId: Int): Int? {
        if (backendSimId != -1 && TextBeeUtils.isValidSubscriptionId(context, backendSimId)) {
            Log.d(TAG, "Using backend-provided SIM subscription ID: $backendSimId")
            return backendSimId
        }

        val preferredSim = SharedPreferenceHelper.getSharedPreferenceInt(
            context,
            AppConstants.SHARED_PREFS_PREFERRED_SIM_KEY,
            -1,
        )
        if (preferredSim != -1 && TextBeeUtils.isValidSubscriptionId(context, preferredSim)) {
            Log.d(TAG, "Using app-preferred SIM subscription ID: $preferredSim")
            return preferredSim
        }

        return null
    }

    private fun shouldSend(context: Context, smsId: String): Boolean {
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

        if (deviceId.isEmpty() || apiKey.isEmpty()) {
            return true
        }

        return try {
            val response = ApiManager.getApiService()
                .checkSMSSendEligibility(deviceId, smsId, apiKey)
                .execute()

            if (response.isSuccessful) {
                response.body()?.data?.canSend ?: true
            } else {
                Log.w(TAG, "Send eligibility check failed with response code: ${response.code()}")
                true
            }
        } catch (e: Exception) {
            Log.w(TAG, "Send eligibility check failed: ${e.message}")
            true
        }
    }

    companion object {
        private const val TAG = "SmsSendWorker"
        private const val QUEUE_NAME = "sms_send_queue"
        const val KEY_PHONE = "phone"
        const val KEY_MESSAGE = "message"
        const val KEY_SMS_ID = "sms_id"
        const val KEY_SMS_BATCH_ID = "sms_batch_id"
        const val KEY_SIM_SUBSCRIPTION_ID = "sim_subscription_id"

        @JvmStatic
        fun enqueue(
            context: Context,
            phone: String,
            message: String,
            smsId: String,
            smsBatchId: String?,
            simSubscriptionId: Int?,
        ) {
            val inputData = Data.Builder()
                .putString(KEY_PHONE, phone)
                .putString(KEY_MESSAGE, message)
                .putString(KEY_SMS_ID, smsId)
                .putString(KEY_SMS_BATCH_ID, smsBatchId)
                .putInt(KEY_SIM_SUBSCRIPTION_ID, simSubscriptionId ?: -1)
                .build()

            val workRequest = OneTimeWorkRequest.Builder(SmsSendWorker::class.java)
                .setInputData(inputData)
                .build()

            WorkManager.getInstance(context)
                .beginUniqueWork(QUEUE_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, workRequest)
                .enqueue()

            Log.d(TAG, "SMS enqueued for sending - ID: $smsId, Phone: $phone")
        }
    }
}
