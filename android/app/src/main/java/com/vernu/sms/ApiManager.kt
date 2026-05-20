package com.vernu.sms

import com.vernu.sms.services.GatewayApiService
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiManager {
    private var apiService: GatewayApiService? = null

    @JvmStatic
    fun getApiService(): GatewayApiService {
        return apiService ?: createApiService().also { apiService = it }
    }

    private fun createApiService(): GatewayApiService {
        val retrofit = Retrofit.Builder()
            .baseUrl(AppConstants.API_BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit.create(GatewayApiService::class.java)
    }
}
