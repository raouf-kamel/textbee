package com.vernu.sms.helpers

import android.content.Context
import android.util.Log
import com.vernu.sms.ApiManager
import com.vernu.sms.AppConstants
import com.vernu.sms.BuildConfig
import com.vernu.sms.dtos.RegisterDeviceInputDTO
import com.vernu.sms.dtos.RegisterDeviceResponseDTO
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object VersionTracker {
    private const val TAG = "VersionTracker"

    @JvmStatic
    fun hasVersionChanged(context: Context): Boolean {
        val lastVersionCode = SharedPreferenceHelper.getSharedPreferenceInt(
            context,
            AppConstants.SHARED_PREFS_LAST_VERSION_CODE_KEY,
            -1,
        )

        val lastVersionName = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_LAST_VERSION_NAME_KEY,
            "",
        ).orEmpty()

        return lastVersionCode == -1 ||
            lastVersionCode != BuildConfig.VERSION_CODE ||
            lastVersionName != BuildConfig.VERSION_NAME
    }

    @JvmStatic
    fun updateStoredVersion(context: Context) {
        SharedPreferenceHelper.setSharedPreferenceInt(
            context,
            AppConstants.SHARED_PREFS_LAST_VERSION_CODE_KEY,
            BuildConfig.VERSION_CODE,
        )

        SharedPreferenceHelper.setSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_LAST_VERSION_NAME_KEY,
            BuildConfig.VERSION_NAME,
        )
    }

    @JvmStatic
    fun reportVersionToServer(context: Context) {
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
            Log.d(TAG, "Can't report version: device not registered or no API key")
            return
        }

        val updateInput = RegisterDeviceInputDTO().apply {
            appVersionCode = BuildConfig.VERSION_CODE
            appVersionName = BuildConfig.VERSION_NAME
        }

        ApiManager.getApiService()
            .updateDevice(deviceId, apiKey, updateInput)
            .enqueue(object : Callback<RegisterDeviceResponseDTO> {
                override fun onResponse(
                    call: Call<RegisterDeviceResponseDTO>,
                    response: Response<RegisterDeviceResponseDTO>,
                ) {
                    if (response.isSuccessful) {
                        Log.d(TAG, "Version update reported successfully")
                        updateStoredVersion(context)
                    } else {
                        Log.e(TAG, "Failed to report version update: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<RegisterDeviceResponseDTO>, t: Throwable) {
                    Log.e(TAG, "Error reporting version update: ${t.message}")
                }
            })
    }
}
