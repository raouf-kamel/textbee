package com.vernu.sms.dtos

class RegisterDeviceResponseDTO {
    @JvmField
    var success: Boolean = false

    @JvmField
    var data: MutableMap<String, Any>? = null

    @JvmField
    var error: String? = null
}
