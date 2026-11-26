package com.quickfix.app.ui.screens

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class CustomerBookingRazorpayOrder(
    val orderId: String,
    val amountPaise: Int,
    val currency: String,
    val keyId: String
)

/** Routes Razorpay callbacks to the active customer booking flow. */
object CustomerBookingPaymentResult {
    @Volatile
    var callback: ((String?, String?, String?, String?) -> Unit)? = null

    fun hasPending(): Boolean = callback != null

    fun success(paymentId: String, orderId: String, signature: String) {
        val current = callback
        callback = null
        current?.invoke(paymentId, orderId, signature, null)
    }

    fun failure(message: String) {
        val current = callback
        callback = null
        current?.invoke(null, null, null, message)
    }
}

private suspend fun customerBookingPaymentRequest(path: String, payload: JSONObject): JSONObject =
    withContext(Dispatchers.IO) {
        val user = FirebaseAuth.getInstance().currentUser
            ?: throw SecurityException("कृपया दोबारा Customer account में sign in करें।")
        val token = user.getIdToken(true).await().token
            ?: throw SecurityException("Secure login token नहीं मिला।")
        val connection = URL("https://quickfix-india.onrender.com/api/payments/razorpay/$path")
            .openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 25000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = if (body.isBlank()) JSONObject() else JSONObject(body)
            if (status !in 200..299 || !json.optBoolean("success", false)) {
                throw IllegalStateException(
                    json.optString("error").ifBlank { "Secure payment request failed (HTTP $status)." }
                )
            }
            json
        } finally {
            connection.disconnect()
        }
    }

suspend fun createCustomerBookingPaymentOrder(bookingId: String): CustomerBookingRazorpayOrder {
    require(bookingId.isNotBlank()) { "Booking ID missing." }
    val response = customerBookingPaymentRequest("orders", JSONObject().put("bookingId", bookingId))
    val orderId = response.optString("orderId")
    val keyId = response.optString("keyId")
    val amount = response.optInt("amount", 0)
    val currency = response.optString("currency", "INR")
    if (orderId.isBlank() || keyId.isBlank() || amount < 100 || currency != "INR") {
        throw IllegalStateException("Razorpay ने valid UPI order नहीं दिया। कोई payment नहीं कटा है।")
    }
    return CustomerBookingRazorpayOrder(orderId, amount, currency, keyId)
}

suspend fun verifyCustomerBookingPayment(
    bookingId: String,
    orderId: String,
    paymentId: String,
    signature: String
) {
    val response = customerBookingPaymentRequest(
        "verify",
        JSONObject()
            .put("bookingId", bookingId)
            .put("orderId", orderId)
            .put("paymentId", paymentId)
            .put("signature", signature)
    )
    if (response.optString("paymentStatus") != "paid") {
        throw IllegalStateException("Server ने payment को paid confirm नहीं किया। Booking unpaid रहेगी।")
    }
}
