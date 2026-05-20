package com.vernu.sms.helpers

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.os.BatteryManager
import android.os.StatFs
import android.os.SystemClock
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.vernu.sms.ApiManager
import com.vernu.sms.AppConstants
import com.vernu.sms.BuildConfig
import com.vernu.sms.TextBeeUtils
import com.vernu.sms.dtos.HeartbeatInputDTO
import com.vernu.sms.dtos.SimInfoCollectionDTO
import java.io.IOException
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object HeartbeatHelper {
    private const val TAG = "HeartbeatHelper"

    @JvmStatic
    fun sendHeartbeat(context: Context, deviceId: String?, apiKey: String?): Boolean {
        if (deviceId.isNullOrEmpty()) {
            Log.d(TAG, "Device not registered, skipping heartbeat")
            return false
        }

        if (apiKey.isNullOrEmpty()) {
            Log.e(TAG, "API key not available, skipping heartbeat")
            return false
        }

        val heartbeatInput = HeartbeatInputDTO()

        return try {
            collectFcmToken(heartbeatInput)
            collectBatteryInfo(context, heartbeatInput)
            collectNetworkInfo(context, heartbeatInput)

            heartbeatInput.appVersionName = BuildConfig.VERSION_NAME
            heartbeatInput.appVersionCode = BuildConfig.VERSION_CODE
            heartbeatInput.deviceUptimeMillis = SystemClock.uptimeMillis()

            val runtime = Runtime.getRuntime()
            heartbeatInput.memoryFreeBytes = runtime.freeMemory()
            heartbeatInput.memoryTotalBytes = runtime.totalMemory()
            heartbeatInput.memoryMaxBytes = runtime.maxMemory()

            val statFs = StatFs(context.filesDir.path)
            heartbeatInput.storageAvailableBytes = statFs.availableBytes
            heartbeatInput.storageTotalBytes = statFs.totalBytes

            heartbeatInput.timezone = TimeZone.getDefault().id
            heartbeatInput.locale = Locale.getDefault().toString()

            heartbeatInput.receiveSMSEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
                context,
                AppConstants.SHARED_PREFS_RECEIVE_SMS_ENABLED_KEY,
                false,
            )

            heartbeatInput.smsSendDelaySeconds = SharedPreferenceHelper.getSharedPreferenceInt(
                context,
                AppConstants.SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY,
                AppConstants.DEFAULT_SMS_SEND_DELAY_SECONDS,
            )

            heartbeatInput.simInfo = SimInfoCollectionDTO().apply {
                lastUpdated = System.currentTimeMillis()
                sims = TextBeeUtils.collectSimInfo(context)
            }

            val response = ApiManager.getApiService()
                .heartbeat(deviceId, apiKey, heartbeatInput)
                .execute()

            if (response.isSuccessful && response.body() != null) {
                val responseBody = response.body()!!
                if (responseBody.fcmTokenUpdated) {
                    Log.d(TAG, "FCM token was updated during heartbeat")
                }

                val name = responseBody.name
                if (!name.isNullOrBlank()) {
                    SharedPreferenceHelper.setSharedPreferenceString(
                        context,
                        AppConstants.SHARED_PREFS_DEVICE_NAME_KEY,
                        name,
                    )
                    Log.d(TAG, "Synced device name from heartbeat: $name")
                }

                Log.d(TAG, "Heartbeat sent successfully")
                true
            } else {
                Log.e(TAG, "Failed to send heartbeat. Response code: ${response.code()}")
                false
            }
        } catch (e: IOException) {
            Log.e(TAG, "Heartbeat API call failed: ${e.message}")
            false
        } catch (e: Exception) {
            Log.e(TAG, "Error collecting device information: ${e.message}")
            false
        }
    }

    @JvmStatic
    fun isDeviceEligibleForHeartbeat(context: Context): Boolean {
        val deviceId = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
            "",
        )

        if (deviceId.isNullOrEmpty()) {
            return false
        }

        val deviceEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_GATEWAY_ENABLED_KEY,
            false,
        )

        if (!deviceEnabled) {
            return false
        }

        return SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_HEARTBEAT_ENABLED_KEY,
            true,
        )
    }

    private fun collectFcmToken(heartbeatInput: HeartbeatInputDTO) {
        try {
            val latch = CountDownLatch(1)
            var fcmToken: String? = null
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    fcmToken = task.result
                }
                latch.countDown()
            }
            if (latch.await(5, TimeUnit.SECONDS) && fcmToken != null) {
                heartbeatInput.fcmToken = fcmToken
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get FCM token: ${e.message}")
        }
    }

    private fun collectBatteryInfo(context: Context, heartbeatInput: HeartbeatInputDTO) {
        val batteryStatus = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        if (batteryStatus != null) {
            val level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val batteryPct = ((level / scale.toFloat()) * 100).toInt()
            heartbeatInput.batteryPercentage = batteryPct

            val status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            heartbeatInput.setIsCharging(
                status == BatteryManager.BATTERY_STATUS_CHARGING ||
                    status == BatteryManager.BATTERY_STATUS_FULL,
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun collectNetworkInfo(context: Context, heartbeatInput: HeartbeatInputDTO) {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val activeNetwork = connectivityManager?.activeNetworkInfo
        heartbeatInput.networkType = if (activeNetwork?.isConnected == true) {
            when (activeNetwork.type) {
                ConnectivityManager.TYPE_WIFI -> "wifi"
                ConnectivityManager.TYPE_MOBILE -> "cellular"
                else -> "none"
            }
        } else {
            "none"
        }
    }
}
