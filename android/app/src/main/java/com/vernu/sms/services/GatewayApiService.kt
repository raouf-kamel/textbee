package com.vernu.sms.services

import com.vernu.sms.dtos.HeartbeatInputDTO
import com.vernu.sms.dtos.HeartbeatResponseDTO
import com.vernu.sms.dtos.RegisterDeviceInputDTO
import com.vernu.sms.dtos.RegisterDeviceResponseDTO
import com.vernu.sms.dtos.SMSDTO
import com.vernu.sms.dtos.SMSForwardResponseDTO
import com.vernu.sms.dtos.SendEligibilityResponseDTO
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface GatewayApiService {
    @POST("gateway/devices")
    fun registerDevice(
        @Header("x-api-key") apiKey: String?,
        @Body body: RegisterDeviceInputDTO,
    ): Call<RegisterDeviceResponseDTO>

    @PATCH("gateway/devices/{deviceId}")
    fun updateDevice(
        @Path("deviceId") deviceId: String?,
        @Header("x-api-key") apiKey: String?,
        @Body body: RegisterDeviceInputDTO,
    ): Call<RegisterDeviceResponseDTO>

    @POST("gateway/devices/{deviceId}/receive-sms")
    fun sendReceivedSMS(
        @Path("deviceId") deviceId: String?,
        @Header("x-api-key") apiKey: String?,
        @Body body: SMSDTO,
    ): Call<SMSForwardResponseDTO>

    @PATCH("gateway/devices/{deviceId}/sms-status")
    fun updateSMSStatus(
        @Path("deviceId") deviceId: String?,
        @Header("x-api-key") apiKey: String?,
        @Body body: SMSDTO,
    ): Call<SMSForwardResponseDTO>

    @GET("gateway/devices/{deviceId}/sms/{smsId}/send-eligibility")
    fun checkSMSSendEligibility(
        @Path("deviceId") deviceId: String?,
        @Path("smsId") smsId: String?,
        @Header("x-api-key") apiKey: String?,
    ): Call<SendEligibilityResponseDTO>

    @POST("gateway/devices/{deviceId}/heartbeat")
    fun heartbeat(
        @Path("deviceId") deviceId: String?,
        @Header("x-api-key") apiKey: String?,
        @Body body: HeartbeatInputDTO,
    ): Call<HeartbeatResponseDTO>
}
