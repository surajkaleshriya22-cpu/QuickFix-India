package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

private const val EMERGENCY_CONTACTS_API = "https://quickfix-india.onrender.com/api/me/emergency-contacts"

private data class EmergencyContactUi(
    val id: String,
    val maskedPhone: String,
    val relationship: String,
    val verified: Boolean,
    val consent: Boolean
)

private suspend fun emergencyContactsRequest(path: String = "", method: String = "GET", body: JSONObject? = null): JSONObject {
    val user = FirebaseAuth.getInstance().currentUser ?: error("कृपया पहले लॉगिन करें।")
    val token = user.getIdToken(false).await().token ?: error("सुरक्षित लॉगिन टोकन उपलब्ध नहीं है।")
    return withContext(Dispatchers.IO) {
        val connection = (URL(EMERGENCY_CONTACTS_API + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12000
            readTimeout = 12000
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        try {
            if (body != null) connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            val result = if (raw.isBlank()) JSONObject() else JSONObject(raw)
            if (status !in 200..299 || !result.optBoolean("success", false)) {
                throw IllegalStateException(result.optString("error").ifBlank { "अनुरोध पूरा नहीं हुआ ($status)।" })
            }
            result
        } finally {
            connection.disconnect()
        }
    }
}

@Composable
fun EmergencyContactsSection(isEnglish: Boolean) {
    val scope = rememberCoroutineScope()
    val contacts = remember { mutableStateListOf<EmergencyContactUi>() }
    var phone by remember { mutableStateOf("+91") }
    var relationship by remember { mutableStateOf("Family") }
    var consent by remember { mutableStateOf(false) }
    var otp by remember { mutableStateOf("") }
    var otpPending by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }

    fun loadContacts() {
        scope.launch {
            busy = true
            try {
                val response = emergencyContactsRequest()
                contacts.clear()
                val items = response.optJSONArray("contacts")
                if (items != null) for (i in 0 until items.length()) {
                    val item = items.getJSONObject(i)
                    contacts.add(EmergencyContactUi(
                        id = item.optString("contactId"),
                        maskedPhone = item.optString("maskedPhone"),
                        relationship = item.optString("relationship"),
                        verified = item.optBoolean("verified"),
                        consent = item.optBoolean("consent")
                    ))
                }
                message = ""
            } catch (e: Exception) {
                message = e.message ?: if (isEnglish) "Contacts could not be loaded." else "संपर्क लोड नहीं हुए।"
                isError = true
            } finally { busy = false }
        }
    }

    LaunchedEffect(Unit) { loadContacts() }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFFBEB))
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (isEnglish) "Emergency Contacts" else "आपातकालीन संपर्क", fontSize = 16.sp, color = Color(0xFF92400E))
            Text(
                if (isEnglish) "Add up to 3 trusted people. Their number must be verified by OTP and you must have their consent."
                else "अधिकतम 3 भरोसेमंद लोगों के नंबर जोड़ें। OTP सत्यापन और उनकी अनुमति जरूरी है।",
                fontSize = 12.sp, color = Color(0xFF475569)
            )
            contacts.forEach { contact ->
                Row(
                    modifier = Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(10.dp)).padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${contact.relationship} · ${contact.maskedPhone}", fontSize = 13.sp, color = Color(0xFF0F172A))
                        Text(
                            if (contact.verified && contact.consent) { if (isEnglish) "Verified" else "सत्यापित" }
                            else { if (isEnglish) "Verification pending" else "सत्यापन बाकी" },
                            fontSize = 11.sp, color = if (contact.verified && contact.consent) Color(0xFF047857) else Color(0xFFB45309)
                        )
                    }
                    TextButton(enabled = !busy, onClick = {
                        scope.launch {
                            busy = true
                            try {
                                emergencyContactsRequest("/${contact.id}", "DELETE")
                                message = if (isEnglish) "Contact removed." else "संपर्क हटा दिया गया।"
                                isError = false
                                loadContacts()
                            } catch (e: Exception) {
                                message = e.message ?: "संपर्क नहीं हटाया जा सका।"
                                isError = true
                            } finally { busy = false }
                        }
                    }) { Text(if (isEnglish) "Remove" else "हटाएँ", color = Color(0xFFB91C1C)) }
                }
            }
            if (contacts.size < 3 && !otpPending) {
                OutlinedTextField(
                    value = phone, onValueChange = { phone = it.take(16) },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text(if (isEnglish) "Mobile number (+91)" else "मोबाइल नंबर (+91)") }
                )
                Text(if (isEnglish) "Relationship" else "रिश्ता", fontSize = 12.sp, color = Color(0xFF475569))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("Family", "Friend", "Other").forEach { value ->
                        TextButton(onClick = { relationship = value }) {
                            Text(
                                text = when (value) {
                                    "Family" -> if (isEnglish) "Family" else "परिवार"
                                    "Friend" -> if (isEnglish) "Friend" else "मित्र"
                                    else -> if (isEnglish) "Other" else "अन्य"
                                },
                                color = if (relationship == value) Color(0xFF92400E) else Color.Gray
                            )
                        }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = consent, onCheckedChange = { consent = it })
                    Text(
                        if (isEnglish) "I have this person's permission to add this number."
                        else "मैंने इस व्यक्ति से नंबर जोड़ने की अनुमति ली है।",
                        fontSize = 11.sp, color = Color(0xFF475569)
                    )
                }
                Button(
                    enabled = !busy && consent && phone.trim().length >= 9,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB45309)),
                    onClick = {
                        scope.launch {
                            busy = true; message = ""
                            try {
                                val body = JSONObject().put("phoneNumber", phone.trim())
                                    .put("relationship", relationship).put("consent", consent)
                                val response = emergencyContactsRequest("/send-otp", "POST", body)
                                otpPending = true
                                message = response.optString("message", if (isEnglish) "OTP sent." else "OTP भेज दिया गया है।")
                                isError = false
                            } catch (e: Exception) {
                                message = e.message ?: "OTP नहीं भेजा जा सका।"; isError = true
                            } finally { busy = false }
                        }
                    }
                ) { Text(if (busy) (if (isEnglish) "Please wait…" else "कृपया प्रतीक्षा करें…") else (if (isEnglish) "Send OTP" else "OTP भेजें")) }
            }
            if (otpPending) {
                OutlinedTextField(
                    value = otp, onValueChange = { otp = it.filter(Char::isDigit).take(6) },
                    modifier = Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text(if (isEnglish) "6-digit OTP" else "6 अंकों का OTP") }
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(enabled = !busy && otp.length == 6, onClick = {
                        scope.launch {
                            busy = true
                            try {
                                val body = JSONObject().put("phoneNumber", phone.trim()).put("code", otp)
                                val response = emergencyContactsRequest("/verify", "POST", body)
                                message = response.optString("message", if (isEnglish) "Contact verified." else "संपर्क सत्यापित हुआ।")
                                isError = false; otpPending = false; otp = ""; phone = "+91"; consent = false
                                loadContacts()
                            } catch (e: Exception) {
                                message = e.message ?: "OTP सत्यापन विफल हुआ।"; isError = true
                            } finally { busy = false }
                        }
                    }) { Text(if (isEnglish) "Verify" else "सत्यापित करें") }
                    TextButton(onClick = { otpPending = false; otp = "" }) {
                        Text(if (isEnglish) "Cancel" else "रद्द करें")
                    }
                }
            }
            if (message.isNotBlank()) Text(message, fontSize = 12.sp, color = if (isError) Color(0xFFB91C1C) else Color(0xFF047857))
            Text(
                if (isEnglish) "SOS SMS is attempted only for verified, consented contacts when SMS service is configured. Delivery is not guaranteed. This does not dispatch police or ambulance; call 112 in immediate danger."
                else "SMS सेवा सेट होने पर SOS संदेश केवल सत्यापित और अनुमति वाले संपर्कों को भेजने का प्रयास होगा। SMS पहुँचने की गारंटी नहीं है। पुलिस/एम्बुलेंस dispatch नहीं होता; तत्काल खतरे में 112 पर कॉल करें।",
                fontSize = 10.sp, color = Color(0xFF64748B)
            )
        }
    }
}
