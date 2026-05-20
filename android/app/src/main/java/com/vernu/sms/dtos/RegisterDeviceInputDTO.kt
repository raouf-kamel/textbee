package com.vernu.sms.dtos

class RegisterDeviceInputDTO @JvmOverloads constructor(
    var fcmToken: String? = null,
    var enabled: Boolean? = null,
    var brand: String? = null,
    var manufacturer: String? = null,
    var model: String? = null,
    var name: String? = null,
    var serial: String? = null,
    var buildId: String? = null,
    var os: String? = null,
    var osVersion: String? = null,
    var appVersionName: String? = null,
    var appVersionCode: Int = 0,
    var simInfo: SimInfoCollectionDTO? = null,
) {
    fun isEnabled(): Boolean? = enabled
}
