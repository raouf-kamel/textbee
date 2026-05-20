package com.vernu.sms.helpers

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.vernu.sms.AppConstants
import com.vernu.sms.models.SMSFilterRule

object SMSFilterHelper {
    private const val TAG = "SMSFilterHelper"

    enum class FilterMode {
        ALLOW_LIST,
        BLOCK_LIST,
    }

    class FilterConfig {
        private var enabled = false
        private var mode = FilterMode.BLOCK_LIST
        private var rules: MutableList<SMSFilterRule> = ArrayList()

        fun isEnabled(): Boolean = enabled

        fun setEnabled(enabled: Boolean) {
            this.enabled = enabled
        }

        fun getMode(): FilterMode = mode

        fun setMode(mode: FilterMode?) {
            this.mode = mode ?: FilterMode.BLOCK_LIST
        }

        fun getRules(): MutableList<SMSFilterRule> = rules

        fun setRules(rules: List<SMSFilterRule>?) {
            this.rules = rules?.toMutableList() ?: ArrayList()
        }
    }

    @JvmStatic
    fun loadFilterConfig(context: Context): FilterConfig {
        val json = SharedPreferenceHelper.getSharedPreferenceString(
            context,
            AppConstants.SHARED_PREFS_SMS_FILTER_CONFIG_KEY,
            null,
        )

        if (json.isNullOrEmpty()) {
            return FilterConfig()
        }

        return try {
            val type = object : TypeToken<FilterConfig>() {}.type
            Gson().fromJson<FilterConfig>(json, type) ?: FilterConfig()
        } catch (e: Exception) {
            Log.e(TAG, "Error loading filter config: ${e.message}")
            FilterConfig()
        }
    }

    @JvmStatic
    fun saveFilterConfig(context: Context, config: FilterConfig) {
        try {
            val json = Gson().toJson(config)
            SharedPreferenceHelper.setSharedPreferenceString(
                context,
                AppConstants.SHARED_PREFS_SMS_FILTER_CONFIG_KEY,
                json,
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error saving filter config: ${e.message}")
        }
    }

    @JvmStatic
    fun shouldProcessSMS(sender: String?, message: String?, context: Context): Boolean {
        val config = loadFilterConfig(context)

        if (!config.isEnabled()) {
            return true
        }

        val rules = config.getRules()
        if (rules.isEmpty()) {
            return true
        }

        val matchesAnyRule = rules.any { rule -> rule.matches(sender, message) }

        return if (config.getMode() == FilterMode.ALLOW_LIST) {
            matchesAnyRule
        } else {
            !matchesAnyRule
        }
    }

    @JvmStatic
    fun shouldProcessSMS(sender: String?, context: Context): Boolean {
        return shouldProcessSMS(sender, null, context)
    }
}
