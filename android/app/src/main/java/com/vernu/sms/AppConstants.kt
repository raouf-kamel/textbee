package com.vernu.sms

import android.Manifest

object AppConstants {
    @JvmField
    val API_BASE_URL: String = BuildConfig.API_BASE_URL

    @JvmField
    val requiredPermissions = arrayOf(
        Manifest.permission.SEND_SMS,
        Manifest.permission.READ_SMS,
        Manifest.permission.RECEIVE_SMS,
        Manifest.permission.READ_PHONE_STATE,
    )

    const val SHARED_PREFS_DEVICE_ID_KEY = "DEVICE_ID"
    const val SHARED_PREFS_API_KEY_KEY = "API_KEY"
    const val SHARED_PREFS_GATEWAY_ENABLED_KEY = "GATEWAY_ENABLED"
    const val SHARED_PREFS_PREFERRED_SIM_KEY = "PREFERRED_SIM"
    const val SHARED_PREFS_RECEIVE_SMS_ENABLED_KEY = "RECEIVE_SMS_ENABLED"
    const val SHARED_PREFS_TRACK_SENT_SMS_STATUS_KEY = "TRACK_SENT_SMS_STATUS"
    const val SHARED_PREFS_LAST_VERSION_CODE_KEY = "LAST_VERSION_CODE"
    const val SHARED_PREFS_LAST_VERSION_NAME_KEY = "LAST_VERSION_NAME"
    const val SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY = "STICKY_NOTIFICATION_ENABLED"
    const val HEARTBEAT_WORK_TAG = "heartbeat"
    const val SHARED_PREFS_HEARTBEAT_ENABLED_KEY = "HEARTBEAT_ENABLED"
    const val SHARED_PREFS_HEARTBEAT_INTERVAL_MINUTES_KEY = "HEARTBEAT_INTERVAL_MINUTES"
    const val SHARED_PREFS_SMS_FILTER_CONFIG_KEY = "SMS_FILTER_CONFIG"
    const val SHARED_PREFS_DEVICE_NAME_KEY = "DEVICE_NAME"
    const val SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY = "SMS_SEND_DELAY_SECONDS"

    /** Default delay between SMS sends (seconds). 5s helps avoid carrier/device throttling. */
    const val DEFAULT_SMS_SEND_DELAY_SECONDS = 5
}
