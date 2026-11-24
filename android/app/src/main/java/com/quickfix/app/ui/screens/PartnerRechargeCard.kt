package com.quickfix.app.ui.screens

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.firebase.auth.FirebaseAuth
import com.razorpay.Checkout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

private data class RechargePackage(val id: String, val name: String, val amountPaise: Int, val days: Int)

object PartnerRechargePaymentResult {
    var callback: ((String?, String?, String?, String?) -> Unit)? = null
    fun success(paymentId: String, orderId: String, signature: String) {
        callback?.invoke(paymentId, orderId, signature, null)
        callback = null
    }
    fun failure(message: String) {
        callback?.invoke(null, null, null, message)
        callback = null
    }
}

private suspend fun rechargeApi(path: String, payload: JSONObject? = null): JSONObject = withContext(Dispatchers.IO) {
    val token = FirebaseAuth.getInstance().currentUser?.getIdToken(true)?.awaitToken()
        ?: throw IllegalStateException("Partner login session नहीं मिला।")
    val connection = (URL("https://quickfix-india.onrender.com/api/partners/recharge/" + path).openConnection() as HttpURLConnection)
    try {
        connection.requestMethod = if (payload == null) "GET" else "POST"
        connection.connectTimeout = 15000
        connection.readTimeout = 25000
        connection.setRequestProperty("Authorization", "Bearer $token")
        connection.setRequestProperty("Accept", "application/json")
        if (payload != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
        }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        val json = if (body.isBlank()) JSONObject() else JSONObject(body)
        if (status !in 200..299 || !json.optBoolean("success", false)) {
            throw IllegalStateException(json.optString("error").ifBlank { "Recharge request failed (HTTP $status)." })
        }
        json
    } finally { connection.disconnect() }
}

private suspend fun com.google.android.gms.tasks.Task<com.google.firebase.auth.GetTokenResult>.awaitToken(): String? =
    this.await().token

@Composable
fun PartnerRechargeCard() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var packages by remember { mutableStateOf<List<RechargePackage>>(emptyList()) }
    var selected by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("Recharge plans लोड हो रहे हैं…") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val response = rechargeApi("packages")
            val array = response.optJSONArray("packages") ?: JSONArray()
            packages = (0 until array.length()).mapNotNull { index ->
                val item = array.optJSONObject(index) ?: return@mapNotNull null
                RechargePackage(item.optString("id"), item.optString("name"), item.optInt("amountPaise"), item.optInt("durationDays"))
            }
            status = if (packages.isEmpty()) "अभी Admin ने कोई active recharge plan नहीं रखा है।" else
                "Free trial: ${response.optInt("trialDays", 30)} दिन"
        } catch (error: Exception) { status = error.message ?: "Recharge plans नहीं लोड हुए।" }
    }

    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Partner Recharge / पार्टनर रिचार्ज", style = MaterialTheme.typography.titleMedium)
            Text(status, style = MaterialTheme.typography.bodySmall)
            packages.forEach { plan ->
                Button(
                    onClick = { selected = plan.id },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy
                ) {
                    Text("${plan.name} · ₹${plan.amountPaise / 100} · ${plan.days} दिन" + if (selected == plan.id) " ✓" else "")
                }
            }
            Button(
                onClick = {
                    val planId = selected ?: packages.firstOrNull()?.id
                    if (planId == null) { status = "पहले Admin से recharge plan सक्रिय करवाएँ।"; return@Button }
                    busy = true
                    status = "Secure order बनाया जा रहा है…"
                    scope.launch {
                        try {
                            val order = rechargeApi("orders", JSONObject().put("packageId", planId))
                            val orderId = order.getString("orderId")
                            val rechargeId = order.getString("rechargeId")
                            val keyId = order.getString("keyId")
                            val checkout = Checkout()
                            checkout.setKeyID(keyId)
                            val options = JSONObject().apply {
                                put("name", "QuickFix India")
                                put("description", "Channel Partner subscription recharge")
                                put("order_id", orderId)
                                put("currency", "INR")
                                put("amount", order.getInt("amount"))
                                put("theme", JSONObject().put("color", "#2563EB"))
                                put("prefill", JSONObject())
                                put("notes", JSONObject().put("rechargeId", rechargeId))
                            }
                            PartnerRechargePaymentResult.callback = { paymentId, paidOrderId, signature, failure ->
                                scope.launch {
                                    try {
                                        if (failure != null || paymentId == null || paidOrderId != orderId || signature == null) {
                                            status = failure ?: "Payment verify नहीं हुआ। Subscription activate नहीं की गई।"
                                        } else {
                                            rechargeApi("verify", JSONObject()
                                                .put("rechargeId", rechargeId)
                                                .put("orderId", paidOrderId)
                                                .put("paymentId", paymentId)
                                                .put("signature", signature))
                                            status = "भुगतान सत्यापित। Partner subscription सक्रिय हो गई।"
                                        }
                                    } catch (error: Exception) {
                                        status = error.message ?: "Payment verification pending है। दोबारा जाँच करें।"
                                    } finally { busy = false }
                                }
                            }
                            val activity = context.findActivity()
                                ?: throw IllegalStateException("Payment screen could not be opened. Please reopen the partner app.")
                            checkout.open(activity, options)
                        } catch (error: Exception) {
                            PartnerRechargePaymentResult.callback = null
                            busy = false
                            status = error.message ?: "Recharge शुरू नहीं हो सका।"
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy && packages.isNotEmpty()
            ) {
                if (busy) CircularProgressIndicator() else Text("Recharge करें / Pay Securely")
            }
            Text("Subscription केवल server पर captured payment verify होने के बाद सक्रिय होगी। Recharge राशि wallet balance में नहीं जोड़ी जाती।", style = MaterialTheme.typography.bodySmall)
        }
    }
}
