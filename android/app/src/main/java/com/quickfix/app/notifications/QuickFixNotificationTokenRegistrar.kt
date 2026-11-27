package com.quickfix.app.notifications

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import java.net.HttpURLConnection
import java.net.URL

/**
 * Registers the current Android installation with the authenticated partner account.
 * FCM tokens are never logged or placed in client-readable Firestore documents.
 */
object QuickFixNotificationTokenRegistrar {
    fun register(token: String) {
        if (token.length !in 80..4096) return
        val user = FirebaseAuth.getInstance().currentUser ?: return
        user.getIdToken(true)
            .addOnSuccessListener { result ->
                val idToken = result.token ?: return@addOnSuccessListener
                Thread {
                    var connection: HttpURLConnection? = null
                    try {
                        connection = (URL("https://quickfix-india.onrender.com/api/partners/notifications/token")
                            .openConnection() as HttpURLConnection).apply {
                            requestMethod = "POST"
                            connectTimeout = 15000
                            readTimeout = 20000
                            doOutput = true
                            setRequestProperty("Authorization", "Bearer $idToken")
                            setRequestProperty("Content-Type", "application/json")
                        }
                        val escaped = token.replace("\\", "\\\\").replace("\"", "\\\"")
                        connection.outputStream.use {
                            it.write("""{"token":"$escaped"}""".toByteArray(Charsets.UTF_8))
                        }
                        val status = connection.responseCode
                        if (status !in 200..299) {
                            Log.w("QuickFixFCM", "Partner notification token registration returned HTTP $status")
                        }
                    } catch (error: Exception) {
                        Log.w("QuickFixFCM", "Partner notification token registration failed", error)
                    } finally {
                        connection?.disconnect()
                    }
                }.start()
            }
            .addOnFailureListener { error ->
                Log.w("QuickFixFCM", "Could not obtain Firebase token for notification registration", error)
            }
    }
}
