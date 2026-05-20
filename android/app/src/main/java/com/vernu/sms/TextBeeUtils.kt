package com.vernu.sms

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.vernu.sms.dtos.SimInfoDTO
import com.vernu.sms.helpers.SharedPreferenceHelper
import com.vernu.sms.services.StickyNotificationService

object TextBeeUtils {
    private const val TAG = "TextBeeUtils"

    @JvmStatic
    fun isPermissionGranted(context: Context, permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
    }

    @JvmStatic
    fun getAvailableSimSlots(context: Context): List<SubscriptionInfo> {
        if (
            ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_STATE,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return emptyList()
        }

        return SubscriptionManager.from(context).activeSubscriptionInfoList ?: emptyList()
    }

    @JvmStatic
    fun startStickyNotificationService(context: Context) {
        if (!isPermissionGranted(context, Manifest.permission.RECEIVE_SMS)) {
            return
        }

        val stickyNotificationEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
            false,
        )

        if (stickyNotificationEnabled) {
            val notificationIntent = Intent(context, StickyNotificationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(notificationIntent)
            } else {
                context.startService(notificationIntent)
            }
            Log.i(TAG, "Starting sticky notification service")
        } else {
            Log.i(TAG, "Sticky notification disabled by user, not starting service")
        }
    }

    @JvmStatic
    fun stopStickyNotificationService(context: Context) {
        val notificationIntent = Intent(context, StickyNotificationService::class.java)
        context.stopService(notificationIntent)
        Log.i(TAG, "Stopping sticky notification service")
    }

    @JvmStatic
    fun logException(throwable: Throwable, message: String, customData: Map<String, Any>?) {
        try {
            Log.e(TAG, message, throwable)

            val crashlytics = FirebaseCrashlytics.getInstance()
            crashlytics.log(message)

            customData?.forEach { (key, value) ->
                when (value) {
                    is String -> crashlytics.setCustomKey(key, value)
                    is Boolean -> crashlytics.setCustomKey(key, value)
                    is Int -> crashlytics.setCustomKey(key, value)
                    is Long -> crashlytics.setCustomKey(key, value)
                    is Float -> crashlytics.setCustomKey(key, value)
                    is Double -> crashlytics.setCustomKey(key, value)
                    else -> crashlytics.setCustomKey(key, value.toString())
                }
            }

            crashlytics.recordException(throwable)
        } catch (e: Exception) {
            Log.e(TAG, "Error logging exception to Crashlytics", e)
        }
    }

    @JvmStatic
    fun logException(throwable: Throwable, message: String) {
        logException(throwable, message, null)
    }

    @JvmStatic
    fun collectSimInfo(context: Context): List<SimInfoDTO> {
        val simInfoList = mutableListOf<SimInfoDTO>()

        if (
            ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_STATE,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "READ_PHONE_STATE permission not granted, cannot collect SIM info")
            return simInfoList
        }

        try {
            val subscriptionInfoList = SubscriptionManager.from(context).activeSubscriptionInfoList
            if (subscriptionInfoList == null) {
                Log.d(TAG, "No active subscriptions found")
                return simInfoList
            }

            for (subscriptionInfo in subscriptionInfoList) {
                val simInfo = SimInfoDTO().apply {
                    subscriptionId = subscriptionInfo.subscriptionId
                }

                try {
                    subscriptionInfo.iccId?.takeIf { it.isNotEmpty() }?.let {
                        simInfo.iccId = it
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get ICCID for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val cardId = subscriptionInfo.cardId
                        if (cardId >= 0) {
                            simInfo.cardId = cardId
                        }
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get Card ID for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    subscriptionInfo.carrierName?.let {
                        simInfo.carrierName = it.toString()
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get carrier name for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    subscriptionInfo.displayName?.let {
                        simInfo.displayName = it.toString()
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get display name for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    val simSlotIndex = subscriptionInfo.simSlotIndex
                    if (simSlotIndex >= 0) {
                        simInfo.simSlotIndex = simSlotIndex
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get SIM slot index for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    val mcc = getMcc(subscriptionInfo)
                    if (!mcc.isNullOrEmpty()) {
                        simInfo.mcc = mcc
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get MCC for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    val mnc = getMnc(subscriptionInfo)
                    if (!mnc.isNullOrEmpty()) {
                        simInfo.mnc = mnc
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get MNC for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    subscriptionInfo.countryIso?.takeIf { it.isNotEmpty() }?.let {
                        simInfo.countryIso = it
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get country ISO for subscription ${subscriptionInfo.subscriptionId}")
                }

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        when (subscriptionInfo.subscriptionType) {
                            SubscriptionManager.SUBSCRIPTION_TYPE_LOCAL_SIM -> simInfo.subscriptionType = "PHYSICAL_SIM"
                            SubscriptionManager.SUBSCRIPTION_TYPE_REMOTE_SIM -> simInfo.subscriptionType = "ESIM"
                        }
                    } else {
                        simInfo.subscriptionType = "PHYSICAL_SIM"
                    }
                } catch (e: Exception) {
                    Log.d(TAG, "Could not get subscription type for subscription ${subscriptionInfo.subscriptionId}")
                }

                simInfoList.add(simInfo)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error collecting SIM info: ${e.message}", e)
        }

        return simInfoList
    }

    @JvmStatic
    fun isValidSubscriptionId(context: Context, subscriptionId: Int): Boolean {
        if (
            ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_PHONE_STATE,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        return try {
            SubscriptionManager.from(context)
                .activeSubscriptionInfoList
                ?.any { subscriptionInfo -> subscriptionInfo.subscriptionId == subscriptionId }
                ?: false
        } catch (e: Exception) {
            Log.e(TAG, "Error validating subscription ID: ${e.message}", e)
            false
        }
    }

    @Suppress("DEPRECATION")
    private fun getMcc(subscriptionInfo: SubscriptionInfo): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            subscriptionInfo.mccString
        } else {
            val mccInt = subscriptionInfo.mcc
            if (mccInt != Int.MAX_VALUE) "%03d".format(mccInt) else null
        }
    }

    @Suppress("DEPRECATION")
    private fun getMnc(subscriptionInfo: SubscriptionInfo): String? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            subscriptionInfo.mncString
        } else {
            val mncInt = subscriptionInfo.mnc
            if (mncInt != Int.MAX_VALUE) mncInt.toString() else null
        }
    }
}
