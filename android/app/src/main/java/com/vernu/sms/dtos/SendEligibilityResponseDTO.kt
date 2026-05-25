package com.vernu.sms.dtos

class SendEligibilityResponseDTO {
    var data: SendEligibilityDataDTO? = null
}

class SendEligibilityDataDTO {
    var canSend: Boolean = true
    var status: String? = null
    var reason: String? = null
}
