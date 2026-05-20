package com.vernu.sms.models

class SMSPayload {
    var recipients: Array<String>? = null
    var message: String? = null
    var smsId: String? = null
    var smsBatchId: String? = null
    var simSubscriptionId: Int? = null

    // Legacy fields that are no longer used.
    @Suppress("unused")
    private var receivers: Array<String>? = null

    @Suppress("unused")
    private var smsBody: String? = null
}
