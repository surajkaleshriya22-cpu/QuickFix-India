package com.quickfix.app.notifications

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import java.net.HttpURLConnection
import java.net.URL

/**
 * Registers the current Android installation with the authenticated partner account.
 * FCM tokens are never logged or placed in client-readable Firestore documents.
 */
object QuickFixNotificationTokenRegistrar {
    fun unregisterAndThen(onComplete: () -> Unit) {
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null) {
            onComplete()
            return
        }
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                user.getIdToken(true)
                    .addOnSuccessListener { result ->
                        val idToken = result.token
                        if (idToken.isNullOrBlank()) {
                            onComplete()
                            return@addOnSuccessListener
                        }
                        Thread {
                            var connection: HttpURLConnection? = null
                            try {
                                connection = (URL("https://quickfix-india.onrender.com/api/partners/notifications/token")
                                    .openConnection() as HttpURLConnection).apply {
                                    requestMethod = "DELETE"
                                    connectTimeout = 10000
                                    readTimeout = 10000
                                    doOutput = true
                                    setRequestProperty("Authorization", "Bearer $idToken")
                                    setRequestProperty("Content-Type", "application/json")
                                }
                                val payload = org.json.JSONObject().put("token", token).toString()
                                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                                val status = connection.responseCode
                                if (status !in 200..299) {
                                    Log.w("QuickFixFCM", "Partner notification token removal returned HTTP $status")
                                }
                            } catch (error: Exception) {
                                Log.w("QuickFixFCM", "Partner notification token removal failed", error)
                            } finally {
                                connection?.disconnect()
                                onComplete()
                            }
                        }.start()
                    }
                    .addOnFailureListener {
                        onComplete()
                    }
            }
            .addOnFailureListener {
                onComplete()
            }
    }

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
                        val payload = org.json.JSONObject().put("token", token).toString()
                        connection.outputStream.use {
                            it.write(payload.toByteArray(Charsets.UTF_8))
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
