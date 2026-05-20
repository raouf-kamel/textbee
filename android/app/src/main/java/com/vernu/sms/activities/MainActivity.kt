package com.vernu.sms.activities

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.material.snackbar.Snackbar
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import com.google.gson.Gson
import com.google.zxing.integration.android.IntentIntegrator
import com.vernu.sms.ApiManager
import com.vernu.sms.AppConstants
import com.vernu.sms.BuildConfig
import com.vernu.sms.R
import com.vernu.sms.TextBeeUtils
import com.vernu.sms.dtos.RegisterDeviceInputDTO
import com.vernu.sms.dtos.RegisterDeviceResponseDTO
import com.vernu.sms.dtos.SimInfoCollectionDTO
import com.vernu.sms.helpers.HeartbeatManager
import com.vernu.sms.helpers.SharedPreferenceHelper
import com.vernu.sms.helpers.VersionTracker
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException
import java.util.Arrays

class MainActivity : AppCompatActivity() {
    private lateinit var context: Context
    private lateinit var gatewaySwitch: Switch
    private lateinit var receiveSMSSwitch: Switch
    private lateinit var stickyNotificationSwitch: Switch
    private lateinit var apiKeyEditText: EditText
    private lateinit var fcmTokenEditText: EditText
    private lateinit var deviceIdEditText: EditText
    private lateinit var deviceNameEditText: EditText
    private lateinit var smsSendDelayEditText: EditText
    private lateinit var registerDeviceBtn: Button
    private lateinit var grantSMSPermissionBtn: Button
    private lateinit var scanQRBtn: Button
    private lateinit var checkUpdatesBtn: Button
    private lateinit var configureFilterBtn: Button
    private lateinit var copyDeviceIdImgBtn: ImageButton
    private lateinit var deviceBrandAndModelTxt: TextView
    private lateinit var deviceIdTxt: TextView
    private lateinit var appVersionNameTxt: TextView
    private lateinit var appVersionCodeTxt: TextView
    private lateinit var defaultSimSlotRadioGroup: RadioGroup

    private val smsDelaySaveHandler = Handler(Looper.getMainLooper())
    private lateinit var smsDelaySaveRunnable: Runnable
    private var deviceId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        context = applicationContext
        deviceId = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
            ""
        )
        setContentView(R.layout.activity_main)
        bindViews()
        initializeDeviceInfo()
        setupStartupServices()
        setupPermissions()
        setupClipboard()
        setupStoredSettings()
        setupGatewaySwitch()
        setupReceiveSmsSwitch()
        setupStickyNotificationSwitch()
        setupActions()
        setupSmsSendDelay()
    }

    private fun bindViews() {
        gatewaySwitch = findViewById(R.id.gatewaySwitch)
        receiveSMSSwitch = findViewById(R.id.receiveSMSSwitch)
        stickyNotificationSwitch = findViewById(R.id.stickyNotificationSwitch)
        apiKeyEditText = findViewById(R.id.apiKeyEditText)
        fcmTokenEditText = findViewById(R.id.fcmTokenEditText)
        deviceIdEditText = findViewById(R.id.deviceIdEditText)
        deviceNameEditText = findViewById(R.id.deviceNameEditText)
        smsSendDelayEditText = findViewById(R.id.smsSendDelayEditText)
        registerDeviceBtn = findViewById(R.id.registerDeviceBtn)
        grantSMSPermissionBtn = findViewById(R.id.grantSMSPermissionBtn)
        scanQRBtn = findViewById(R.id.scanQRButton)
        checkUpdatesBtn = findViewById(R.id.checkUpdatesBtn)
        configureFilterBtn = findViewById(R.id.configureFilterBtn)
        copyDeviceIdImgBtn = findViewById(R.id.copyDeviceIdImgBtn)
        deviceBrandAndModelTxt = findViewById(R.id.deviceBrandAndModelTxt)
        deviceIdTxt = findViewById(R.id.deviceIdTxt)
        appVersionNameTxt = findViewById(R.id.appVersionNameTxt)
        appVersionCodeTxt = findViewById(R.id.appVersionCodeTxt)
        defaultSimSlotRadioGroup = findViewById(R.id.defaultSimSlotRadioGroup)
    }

    private fun initializeDeviceInfo() {
        deviceIdTxt.text = deviceId
        deviceIdEditText.setText(deviceId)
        deviceBrandAndModelTxt.text = "${Build.BRAND} ${Build.MODEL}"

        val versionName = BuildConfig.VERSION_NAME
        appVersionNameTxt.text = versionName
        appVersionCodeTxt.text = BuildConfig.VERSION_CODE.toString()

        if (VersionTracker.hasVersionChanged(context)) {
            Log.d(TAG, "App version changed or first launch, reporting to server")
            VersionTracker.reportVersionToServer(context)
        }

        FirebaseCrashlytics.getInstance().apply {
            setCustomKey("device_id", deviceId ?: "not_registered")
            setCustomKey("device_model", Build.MODEL)
            setCustomKey("app_version", versionName)
            setCustomKey("app_version_code", BuildConfig.VERSION_CODE)
        }

        registerDeviceBtn.text = if (deviceId.isNullOrEmpty()) "Register" else "Update"
    }

    private fun setupStartupServices() {
        val gatewayEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_GATEWAY_ENABLED_KEY,
            false
        )
        val stickyNotificationEnabled = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
            false
        )

        if (gatewayEnabled && stickyNotificationEnabled) {
            TextBeeUtils.startStickyNotificationService(context)
            Log.d(TAG, "Starting sticky notification service on app start")
        }

        if (gatewayEnabled && !deviceId.isNullOrEmpty()) {
            HeartbeatManager.scheduleHeartbeat(context)
            Log.d(TAG, "Scheduling heartbeat on app start")
        }
    }

    private fun setupPermissions() {
        val missingPermissions = AppConstants.requiredPermissions
            .filter { permission -> !TextBeeUtils.isPermissionGranted(context, permission) }
            .toTypedArray()

        if (missingPermissions.isEmpty()) {
            grantSMSPermissionBtn.isEnabled = false
            grantSMSPermissionBtn.text = "Permission Granted"
            renderAvailableSimOptions()
        } else {
            Snackbar.make(
                grantSMSPermissionBtn,
                "Please Grant Required Permissions to continue: ${Arrays.toString(missingPermissions)}",
                Snackbar.LENGTH_SHORT
            ).show()
            grantSMSPermissionBtn.isEnabled = true
            grantSMSPermissionBtn.setOnClickListener(::handleRequestPermissions)
        }
    }

    private fun setupClipboard() {
        copyDeviceIdImgBtn.setOnClickListener { view ->
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Device ID", deviceId)
            clipboard.setPrimaryClip(clip)
            Snackbar.make(view, "Copied", Snackbar.LENGTH_LONG).show()
        }
    }

    private fun setupStoredSettings() {
        apiKeyEditText.setText(
            SharedPreferenceHelper.getSharedPreferenceString(
                context,
                AppConstants.SHARED_PREFS_API_KEY_KEY,
                ""
            )
        )

        val storedDeviceName = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_DEVICE_NAME_KEY,
            ""
        ).orEmpty()
        deviceNameEditText.setText(
            if (storedDeviceName.isEmpty()) "${Build.BRAND} ${Build.MODEL}" else storedDeviceName
        )

        gatewaySwitch.isChecked = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_GATEWAY_ENABLED_KEY,
            false
        )
        receiveSMSSwitch.isChecked = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_RECEIVE_SMS_ENABLED_KEY,
            false
        )
        stickyNotificationSwitch.isChecked = SharedPreferenceHelper.getSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
            false
        )
    }

    private fun setupGatewaySwitch() {
        gatewaySwitch.setOnCheckedChangeListener { compoundButton, isChecked ->
            val view = compoundButton.rootView
            compoundButton.isEnabled = false
            val key = apiKeyEditText.text.toString()

            val registerDeviceInput = RegisterDeviceInputDTO().apply {
                enabled = isChecked
                appVersionCode = BuildConfig.VERSION_CODE
                appVersionName = BuildConfig.VERSION_NAME
            }

            ApiManager.getApiService()
                .updateDevice(deviceId, key, registerDeviceInput)
                .enqueue(object : Callback<RegisterDeviceResponseDTO> {
                    override fun onResponse(
                        call: Call<RegisterDeviceResponseDTO>,
                        response: Response<RegisterDeviceResponseDTO>
                    ) {
                        Log.d(TAG, response.toString())
                        if (!response.isSuccessful) {
                            Snackbar.make(view, extractErrorMessage(response), Snackbar.LENGTH_LONG).show()
                            compoundButton.isEnabled = true
                            return
                        }

                        Snackbar.make(
                            view,
                            "Gateway ${if (isChecked) "enabled" else "disabled"}",
                            Snackbar.LENGTH_LONG
                        ).show()
                        SharedPreferenceHelper.setSharedPreferenceBoolean(
                            context,
                            AppConstants.SHARED_PREFS_GATEWAY_ENABLED_KEY,
                            isChecked
                        )

                        val enabled = response.body()?.data?.get("enabled") == true
                        compoundButton.isChecked = enabled
                        if (enabled) {
                            if (SharedPreferenceHelper.getSharedPreferenceBoolean(
                                    context,
                                    AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
                                    false
                                )
                            ) {
                                TextBeeUtils.startStickyNotificationService(context)
                            }
                            HeartbeatManager.scheduleHeartbeat(context)
                        } else {
                            TextBeeUtils.stopStickyNotificationService(context)
                            HeartbeatManager.cancelHeartbeat(context)
                        }
                        compoundButton.isEnabled = true
                    }

                    override fun onFailure(call: Call<RegisterDeviceResponseDTO>, t: Throwable) {
                        Snackbar.make(view, "An error occurred :(", Snackbar.LENGTH_LONG).show()
                        Log.e(TAG, "API_ERROR ${t.message}")
                        Log.e(TAG, "API_ERROR ${t.localizedMessage}")
                        TextBeeUtils.logException(t, "Error updating device")
                        compoundButton.isEnabled = true
                    }
                })
        }
    }

    private fun setupReceiveSmsSwitch() {
        receiveSMSSwitch.setOnCheckedChangeListener { compoundButton, isChecked ->
            val view = compoundButton.rootView
            SharedPreferenceHelper.setSharedPreferenceBoolean(
                context,
                AppConstants.SHARED_PREFS_RECEIVE_SMS_ENABLED_KEY,
                isChecked
            )
            compoundButton.isChecked = isChecked
            Snackbar.make(
                view,
                "Receive SMS ${if (isChecked) "enabled" else "disabled"}",
                Snackbar.LENGTH_LONG
            ).show()
        }
    }

    private fun setupStickyNotificationSwitch() {
        stickyNotificationSwitch.setOnCheckedChangeListener { compoundButton, isChecked ->
            val view = compoundButton.rootView
            SharedPreferenceHelper.setSharedPreferenceBoolean(
                context,
                AppConstants.SHARED_PREFS_STICKY_NOTIFICATION_ENABLED_KEY,
                isChecked
            )

            if (isChecked) {
                TextBeeUtils.startStickyNotificationService(context)
                Snackbar.make(
                    view,
                    "Background service enabled - app will be more reliable",
                    Snackbar.LENGTH_LONG
                ).show()
            } else {
                TextBeeUtils.stopStickyNotificationService(context)
                Snackbar.make(
                    view,
                    "Background service disabled - app may be killed when in background",
                    Snackbar.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun setupActions() {
        registerDeviceBtn.setOnClickListener {
            val storedDeviceId = SharedPreferenceHelper.getSharedPreferenceString(
                context,
                AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
                ""
            )
            if (storedDeviceId.isNullOrEmpty()) {
                handleRegisterDevice()
            } else {
                handleUpdateDevice()
            }
        }

        scanQRBtn.setOnClickListener {
            IntentIntegrator(this).apply {
                setPrompt("Go to textbee.dev/dashboard and click Register Device to generate QR Code")
                setRequestCode(SCAN_QR_REQUEST_CODE)
                initiateScan()
            }
        }

        checkUpdatesBtn.setOnClickListener {
            val versionInfo = "${BuildConfig.VERSION_NAME}(${BuildConfig.VERSION_CODE})"
            val encodedVersionInfo = Uri.encode(versionInfo)
            val downloadUrl = "https://textbee.dev/download?currentVersion=$encodedVersionInfo"
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl)))
        }

        configureFilterBtn.setOnClickListener {
            startActivity(Intent(this, SMSFilterActivity::class.java))
        }
    }

    private fun setupSmsSendDelay() {
        val currentDelay = SharedPreferenceHelper.getSharedPreferenceInt(
            context,
            AppConstants.SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY,
            AppConstants.DEFAULT_SMS_SEND_DELAY_SECONDS
        )
        smsSendDelayEditText.setText(currentDelay.toString())
        smsDelaySaveRunnable = Runnable { saveSendDelay() }
        smsSendDelayEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

            override fun afterTextChanged(s: Editable?) {
                smsDelaySaveHandler.removeCallbacks(smsDelaySaveRunnable)
                smsDelaySaveHandler.postDelayed(smsDelaySaveRunnable, SMS_DELAY_SAVE_DEBOUNCE_MS)
            }
        })
        smsSendDelayEditText.setOnEditorActionListener { _, _, _ ->
            smsDelaySaveHandler.removeCallbacks(smsDelaySaveRunnable)
            saveSendDelay()
            false
        }
    }

    private fun saveSendDelay() {
        val text = smsSendDelayEditText.text.toString().trim()
        if (text.isEmpty()) {
            val defaultDelay = AppConstants.DEFAULT_SMS_SEND_DELAY_SECONDS
            smsSendDelayEditText.setText(defaultDelay.toString())
            SharedPreferenceHelper.setSharedPreferenceInt(
                context,
                AppConstants.SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY,
                defaultDelay
            )
            Snackbar.make(
                smsSendDelayEditText,
                "SMS send delay saved ($defaultDelay sec)",
                Snackbar.LENGTH_SHORT
            ).show()
            return
        }

        try {
            val value = text.toInt().coerceIn(0, 3600)
            when {
                value != text.toInt() && value == 0 -> {
                    smsSendDelayEditText.setText("0")
                    Snackbar.make(smsSendDelayEditText, "Minimum delay is 0 seconds. Saved.", Snackbar.LENGTH_SHORT).show()
                }
                value != text.toInt() && value == 3600 -> {
                    smsSendDelayEditText.setText("3600")
                    Snackbar.make(smsSendDelayEditText, "Maximum delay is 3600 seconds. Saved.", Snackbar.LENGTH_SHORT).show()
                }
                else -> {
                    Snackbar.make(
                        smsSendDelayEditText,
                        "SMS send delay saved ($value sec)",
                        Snackbar.LENGTH_SHORT
                    ).show()
                }
            }
            SharedPreferenceHelper.setSharedPreferenceInt(
                context,
                AppConstants.SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY,
                value
            )
        } catch (e: NumberFormatException) {
            val defaultDelay = AppConstants.DEFAULT_SMS_SEND_DELAY_SECONDS
            smsSendDelayEditText.setText(defaultDelay.toString())
            SharedPreferenceHelper.setSharedPreferenceInt(
                context,
                AppConstants.SHARED_PREFS_SMS_SEND_DELAY_SECONDS_KEY,
                defaultDelay
            )
            Snackbar.make(
                smsSendDelayEditText,
                "Invalid value. Reset to $defaultDelay sec.",
                Snackbar.LENGTH_SHORT
            ).show()
        }
    }

    private fun renderAvailableSimOptions() {
        try {
            defaultSimSlotRadioGroup.removeAllViews()
            @Suppress("DEPRECATION")
            defaultSimSlotRadioGroup.setBackgroundColor(resources.getColor(R.color.background_secondary))
            defaultSimSlotRadioGroup.setPadding(16, 8, 16, 8)

            val defaultSimSlotRadioBtn = RadioButton(context).apply {
                text = "Device Default"
                id = DEFAULT_SIM_RADIO_ID
                applyRadioButtonStyle(this)
            }
            defaultSimSlotRadioGroup.addView(defaultSimSlotRadioBtn)

            TextBeeUtils.getAvailableSimSlots(context).forEach { subscriptionInfo ->
                val displayName = subscriptionInfo.displayName?.toString() ?: "Unknown"
                val simInfo = "$displayName (Subscription ID: ${subscriptionInfo.subscriptionId})"
                val radioButton = RadioButton(context).apply {
                    text = simInfo
                    id = subscriptionInfo.subscriptionId
                    applyRadioButtonStyle(this)
                }
                defaultSimSlotRadioGroup.addView(radioButton)
            }

            val preferredSim = SharedPreferenceHelper.getSharedPreferenceInt(
                context,
                AppConstants.SHARED_PREFS_PREFERRED_SIM_KEY,
                -1
            )
            if (preferredSim == -1) {
                defaultSimSlotRadioGroup.check(defaultSimSlotRadioBtn.id)
            } else {
                defaultSimSlotRadioGroup.check(preferredSim)
            }

            defaultSimSlotRadioGroup.setOnCheckedChangeListener { _, checkedId ->
                val radioButton = findViewById<RadioButton>(checkedId) ?: return@setOnCheckedChangeListener
                radioButton.isChecked = true
                if (radioButton.text.toString() == "Device Default") {
                    SharedPreferenceHelper.clearSharedPreference(context, AppConstants.SHARED_PREFS_PREFERRED_SIM_KEY)
                } else {
                    SharedPreferenceHelper.setSharedPreferenceInt(
                        context,
                        AppConstants.SHARED_PREFS_PREFERRED_SIM_KEY,
                        radioButton.id
                    )
                }
            }
        } catch (e: Exception) {
            Snackbar.make(defaultSimSlotRadioGroup.rootView, "Error: ${e.message}", Snackbar.LENGTH_LONG).show()
            Log.e(TAG, "SIM_SLOT_ERROR ${e.message}")
        }
    }

    private fun extractErrorMessage(response: Response<*>): String {
        try {
            val errorBody: ResponseBody? = response.errorBody()
            if (errorBody != null) {
                val errorBodyString = errorBody.string()
                if (errorBodyString.isNotEmpty()) {
                    try {
                        val errorResponse = Gson().fromJson(
                            errorBodyString,
                            RegisterDeviceResponseDTO::class.java
                        )
                        if (!errorResponse?.error.isNullOrEmpty()) {
                            return errorResponse.error.orEmpty()
                        }
                    } catch (e: Exception) {
                        Log.d(TAG, "Could not parse error response as JSON: $errorBodyString")
                    }
                }
            }
        } catch (e: IOException) {
            Log.d(TAG, "Could not read error body: ${e.message}")
        }

        if (response.message().isNotEmpty()) {
            return response.message()
        }

        return "An error occurred :( ${response.code()}"
    }

    private fun applyRadioButtonStyle(radioButton: RadioButton) {
        setRadioButtonTextColor(radioButton)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            radioButton.buttonTintList = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                resources.getColorStateList(R.color.radio_button_tint, theme)
            } else {
                @Suppress("DEPRECATION")
                resources.getColorStateList(R.color.radio_button_tint)
            }
        }

        radioButton.setPadding(
            radioButton.paddingLeft + 8,
            radioButton.paddingTop + 12,
            radioButton.paddingRight,
            radioButton.paddingBottom + 12
        )
    }

    private fun setRadioButtonTextColor(radioButton: RadioButton) {
        radioButton.setTextColor(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                resources.getColorStateList(R.color.radio_button_text_color, theme)
            } else {
                @Suppress("DEPRECATION")
                resources.getColorStateList(R.color.radio_button_text_color)
            }
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != PERMISSION_REQUEST_CODE) {
            return
        }

        val allPermissionsGranted = permissions.all { permission ->
            TextBeeUtils.isPermissionGranted(context, permission)
        }
        if (allPermissionsGranted) {
            Snackbar.make(findViewById(R.id.grantSMSPermissionBtn), "All Permissions Granted", Snackbar.LENGTH_SHORT).show()
            grantSMSPermissionBtn.isEnabled = false
            grantSMSPermissionBtn.text = "Permission Granted"
            renderAvailableSimOptions()
        } else {
            Snackbar.make(
                findViewById(R.id.grantSMSPermissionBtn),
                "Please Grant Required Permissions to continue",
                Snackbar.LENGTH_SHORT
            ).show()
        }
    }

    private fun handleRegisterDevice() {
        val newKey = apiKeyEditText.text.toString()
        val deviceIdInput = deviceIdEditText.text.toString()
        val view = findViewById<View>(R.id.registerDeviceBtn)

        registerDeviceBtn.isEnabled = false
        registerDeviceBtn.text = "Loading..."

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Snackbar.make(view, "Failed to obtain FCM Token :(", Snackbar.LENGTH_LONG).show()
                resetRegisterButton()
                return@addOnCompleteListener
            }

            val token = task.result.orEmpty()
            fcmTokenEditText.setText(token)
            val registerDeviceInput = createDeviceInput(token)

            if (deviceIdInput.isNotEmpty()) {
                Log.d(TAG, "Updating device with deviceId: $deviceIdInput")
                updateExistingDeviceFromRegistration(view, deviceIdInput, newKey, registerDeviceInput)
                return@addOnCompleteListener
            }

            ApiManager.getApiService()
                .registerDevice(newKey, registerDeviceInput)
                .enqueue(object : Callback<RegisterDeviceResponseDTO> {
                    override fun onResponse(
                        call: Call<RegisterDeviceResponseDTO>,
                        response: Response<RegisterDeviceResponseDTO>
                    ) {
                        Log.d(TAG, response.toString())
                        if (!response.isSuccessful) {
                            Snackbar.make(view, extractErrorMessage(response), Snackbar.LENGTH_LONG).show()
                            resetRegisterButton()
                            return
                        }

                        SharedPreferenceHelper.setSharedPreferenceString(
                            context,
                            AppConstants.SHARED_PREFS_API_KEY_KEY,
                            newKey
                        )
                        Snackbar.make(view, "Device Registration Successful :)", Snackbar.LENGTH_LONG).show()
                        syncDeviceFromResponse(response, registerDeviceInput)
                        VersionTracker.updateStoredVersion(context)
                        resetRegisterButton()
                    }

                    override fun onFailure(call: Call<RegisterDeviceResponseDTO>, t: Throwable) {
                        handleDeviceRequestFailure(view, t, "Error registering device")
                    }
                })
        }
    }

    private fun updateExistingDeviceFromRegistration(
        view: View,
        deviceIdInput: String,
        apiKey: String,
        registerDeviceInput: RegisterDeviceInputDTO
    ) {
        ApiManager.getApiService()
            .updateDevice(deviceIdInput, apiKey, registerDeviceInput)
            .enqueue(object : Callback<RegisterDeviceResponseDTO> {
                override fun onResponse(
                    call: Call<RegisterDeviceResponseDTO>,
                    response: Response<RegisterDeviceResponseDTO>
                ) {
                    Log.d(TAG, response.toString())
                    if (!response.isSuccessful) {
                        Snackbar.make(view, extractErrorMessage(response), Snackbar.LENGTH_LONG).show()
                        resetRegisterButton()
                        return
                    }

                    SharedPreferenceHelper.setSharedPreferenceString(
                        context,
                        AppConstants.SHARED_PREFS_API_KEY_KEY,
                        apiKey
                    )
                    Snackbar.make(view, "Device Updated Successfully :)", Snackbar.LENGTH_LONG).show()
                    syncDeviceFromResponse(response, registerDeviceInput)
                    VersionTracker.updateStoredVersion(context)
                    resetRegisterButton()
                }

                override fun onFailure(call: Call<RegisterDeviceResponseDTO>, t: Throwable) {
                    handleDeviceRequestFailure(view, t, "Error registering device")
                }
            })
    }

    private fun handleUpdateDevice() {
        val apiKey = apiKeyEditText.text.toString()
        val deviceIdInput = deviceIdEditText.text.toString()
        val deviceIdToUse = if (deviceIdInput.isNotEmpty()) deviceIdInput else deviceId
        val view = findViewById<View>(R.id.registerDeviceBtn)

        registerDeviceBtn.isEnabled = false
        registerDeviceBtn.text = "Loading..."

        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Snackbar.make(view, "Failed to obtain FCM Token :(", Snackbar.LENGTH_LONG).show()
                resetRegisterButton()
                return@addOnCompleteListener
            }

            val token = task.result.orEmpty()
            fcmTokenEditText.setText(token)
            val updateDeviceInput = createDeviceInput(token)

            ApiManager.getApiService()
                .updateDevice(deviceIdToUse, apiKey, updateDeviceInput)
                .enqueue(object : Callback<RegisterDeviceResponseDTO> {
                    override fun onResponse(
                        call: Call<RegisterDeviceResponseDTO>,
                        response: Response<RegisterDeviceResponseDTO>
                    ) {
                        Log.d(TAG, response.toString())
                        if (!response.isSuccessful) {
                            Snackbar.make(view, extractErrorMessage(response), Snackbar.LENGTH_LONG).show()
                            resetRegisterButton()
                            return
                        }

                        SharedPreferenceHelper.setSharedPreferenceString(
                            context,
                            AppConstants.SHARED_PREFS_API_KEY_KEY,
                            apiKey
                        )
                        syncDeviceFromResponse(response, updateDeviceInput)
                        VersionTracker.updateStoredVersion(context)
                        Snackbar.make(view, "Device Updated Successfully :)", Snackbar.LENGTH_LONG).show()
                        resetRegisterButton()
                    }

                    override fun onFailure(call: Call<RegisterDeviceResponseDTO>, t: Throwable) {
                        handleDeviceRequestFailure(view, t, "Error updating device")
                    }
                })
        }
    }

    private fun createDeviceInput(token: String): RegisterDeviceInputDTO {
        val deviceName = deviceNameEditText.text.toString().trim()
            .ifEmpty { "${Build.BRAND} ${Build.MODEL}" }
        val simInfoCollection = SimInfoCollectionDTO().apply {
            lastUpdated = System.currentTimeMillis()
            sims = TextBeeUtils.collectSimInfo(context)
        }

        return RegisterDeviceInputDTO().apply {
            enabled = true
            fcmToken = token
            brand = Build.BRAND
            manufacturer = Build.MANUFACTURER
            model = Build.MODEL
            buildId = Build.ID
            os = Build.VERSION.BASE_OS
            appVersionCode = BuildConfig.VERSION_CODE
            appVersionName = BuildConfig.VERSION_NAME
            name = deviceName
            simInfo = simInfoCollection
        }
    }

    private fun syncDeviceFromResponse(
        response: Response<RegisterDeviceResponseDTO>,
        deviceInput: RegisterDeviceInputDTO
    ) {
        val data = response.body()?.data ?: return
        val responseDeviceId = data["_id"]?.toString() ?: return

        deviceId = responseDeviceId
        deviceIdTxt.text = responseDeviceId
        deviceIdEditText.setText(responseDeviceId)
        SharedPreferenceHelper.setSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_DEVICE_ID_KEY,
            responseDeviceId
        )
        SharedPreferenceHelper.setSharedPreferenceBoolean(
            context,
            AppConstants.SHARED_PREFS_GATEWAY_ENABLED_KEY,
            deviceInput.isEnabled() == true
        )
        gatewaySwitch.isChecked = deviceInput.isEnabled() == true

        (data["heartbeatIntervalMinutes"] as? Number)?.let { intervalObj ->
            val intervalMinutes = intervalObj.toInt()
            SharedPreferenceHelper.setSharedPreferenceInt(
                context,
                AppConstants.SHARED_PREFS_HEARTBEAT_INTERVAL_MINUTES_KEY,
                intervalMinutes
            )
            Log.d(TAG, "Synced heartbeat interval from server: $intervalMinutes minutes")
        }

        data["name"]?.toString()?.let { deviceName ->
            SharedPreferenceHelper.setSharedPreferenceString(
                context,
                AppConstants.SHARED_PREFS_DEVICE_NAME_KEY,
                deviceName
            )
            deviceNameEditText.setText(deviceName)
            Log.d(TAG, "Synced device name from server: $deviceName")
        }

        if (deviceInput.isEnabled() == true) {
            HeartbeatManager.scheduleHeartbeat(context)
        }
    }

    private fun handleDeviceRequestFailure(view: View, t: Throwable, logMessage: String) {
        Snackbar.make(view, "An error occurred :(", Snackbar.LENGTH_LONG).show()
        Log.e(TAG, "API_ERROR ${t.message}")
        Log.e(TAG, "API_ERROR ${t.localizedMessage}")
        TextBeeUtils.logException(t, logMessage)
        resetRegisterButton()
    }

    private fun resetRegisterButton() {
        registerDeviceBtn.isEnabled = true
        registerDeviceBtn.text = "Update"
    }

    private fun handleRequestPermissions(view: View) {
        val allPermissionsGranted = AppConstants.requiredPermissions.all { permission ->
            TextBeeUtils.isPermissionGranted(context, permission)
        }
        if (allPermissionsGranted) {
            Snackbar.make(view, "Already got permissions", Snackbar.LENGTH_SHORT).show()
            return
        }

        val permissionsToRequest = AppConstants.requiredPermissions
            .filter { permission -> !TextBeeUtils.isPermissionGranted(context, permission) }
            .toTypedArray()
        Snackbar.make(view, "Please Grant Required Permissions to continue", Snackbar.LENGTH_SHORT).show()
        ActivityCompat.requestPermissions(this, permissionsToRequest, PERMISSION_REQUEST_CODE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == SCAN_QR_REQUEST_CODE) {
            val intentResult = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
            if (intentResult == null || intentResult.contents == null) {
                Toast.makeText(baseContext, "Canceled", Toast.LENGTH_SHORT).show()
                return
            }

            apiKeyEditText.setText(intentResult.contents)
            if (deviceIdEditText.text.toString().isEmpty()) {
                handleRegisterDevice()
            } else {
                handleUpdateDevice()
            }
        }
    }

    companion object {
        private const val SCAN_QR_REQUEST_CODE = 49374
        private const val PERMISSION_REQUEST_CODE = 0
        private const val SMS_DELAY_SAVE_DEBOUNCE_MS = 3000L
        private const val DEFAULT_SIM_RADIO_ID = 123456
        private const val TAG = "MainActivity"
    }
}
