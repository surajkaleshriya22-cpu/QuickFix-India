package com.quickfix.app.data.repository

import android.app.Activity
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.Timestamp
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    val currentUserUid: String?
        get() = auth.currentUser?.uid

    val currentUserEmail: String?
        get() = auth.currentUser?.email

    /** E.164 phone number verified by Firebase Phone Auth. */
    val currentUserPhoneNumber: String?
        get() = auth.currentUser?.phoneNumber

    val isUserLoggedIn: Boolean
        get() = auth.currentUser != null

    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null
    private var resendTokenPhoneNumber: String? = null

    /**
     * Ensures strict E.164 phone format (+[countryCode][number]) without spaces or symbols.
     */
    fun sanitizePhoneNumber(raw: String): String {
        val trimmed = raw.trim()
        val digitsOnly = trimmed.filter { it.isDigit() }
        return when {
            trimmed.startsWith("+") -> "+" + trimmed.filter { it.isDigit() }
            digitsOnly.length == 10 -> "+91$digitsOnly"
            digitsOnly.length > 10 && digitsOnly.startsWith("91") -> "+$digitsOnly"
            else -> "+91$digitsOnly"
        }
    }

    fun sendPhoneOtp(
        phoneNumber: String,
        activity: Activity,
        onCodeSent: (verificationId: String) -> Unit,
        onVerificationFailed: (exception: Exception) -> Unit,
        onAutoVerified: (credential: PhoneAuthCredential) -> Unit
    ) {
        val formattedNumber = sanitizePhoneNumber(phoneNumber)
        val builder = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(formattedNumber)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    onAutoVerified(credential)
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    onVerificationFailed(e)
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    resendToken = token
                    resendTokenPhoneNumber = formattedNumber
                    onCodeSent(verificationId)
                }
            })

        // A Firebase resend token is tied to the phone number that received it.
        // Never reuse it after the user switches to a different number.
        if (resendTokenPhoneNumber == formattedNumber) {
            resendToken?.let { builder.setForceResendingToken(it) }
        } else {
            resendToken = null
            resendTokenPhoneNumber = null
        }
        PhoneAuthProvider.verifyPhoneNumber(builder.build())
    }

    /** Sign in with the administrator's Firebase email/password account, then require a server-issued admin claim. */
    suspend fun signInAdmin(email: String, password: String): User {
        val cleanEmail = email.trim().lowercase()
        auth.signInWithEmailAndPassword(cleanEmail, password).await()
        return getAdminUser(cleanEmail)
            ?: run {
                auth.signOut()
                throw SecurityException("Admin access denied. This Firebase account does not have the required server-issued admin permission.")
            }
    }

    suspend fun signInWithCredential(credential: PhoneAuthCredential): String {
        val result = auth.signInWithCredential(credential).await()
        return result.user?.uid ?: throw IllegalStateException("Firebase UID is null")
    }

    suspend fun saveUserProfile(user: User) {
        val firebaseUser = auth.currentUser
            ?: throw SecurityException("Please verify your mobile number again.")
        val idToken = firebaseUser.getIdToken(true).await().token
            ?: throw SecurityException("Could not obtain a secure Firebase sign-in token.")
        val payload = JSONObject().apply {
            put("displayName", user.displayName.trim().ifBlank { "QuickFix Customer" })
            put("email", user.email.trim())
            put("address", user.address.trim())
            put("city", user.city.trim())
        }
        withContext(Dispatchers.IO) {
            val connection = (URL("https://quickfix-india.onrender.com/api/customers/register")
                .openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 20000
                doOutput = true
                setRequestProperty("Authorization", "Bearer $idToken")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
            }
            try {
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                val body = if (response.isNotBlank()) JSONObject(response) else JSONObject()
                if (status !in 200..299 || !body.optBoolean("success", false)) {
                    throw IllegalStateException(body.optString("error").ifBlank { "Secure Customer registration failed (HTTP $status)." })
                }
            } finally {
                connection.disconnect()
            }
        }
    }


    /**
     * Creates a basic Channel Partner profile through the authenticated server API.
     * Firebase verifies the phone number; the server derives the UID and phone from
     * the verified ID token. Sensitive KYC/payment details are deliberately excluded.
     */
    suspend fun registerChannelPartner(user: User) {
        val firebaseUser = auth.currentUser
            ?: throw SecurityException("Please verify your mobile number again.")
        val idToken = firebaseUser.getIdToken(true).await().token
            ?: throw SecurityException("Could not obtain a secure Firebase sign-in token.")

        val payload = JSONObject().apply {
            put("displayName", user.displayName.trim())
            put("email", user.email.trim())
            put("trades", JSONArray(user.trades))
            put("experienceYears", user.experienceYears)
            put("city", user.city.trim())
            put("address", user.address.trim())
        }

        withContext(Dispatchers.IO) {
            val connection = (URL("https://quickfix-india.onrender.com/api/partners/register")
                .openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 20000
                doOutput = true
                setRequestProperty("Authorization", "Bearer $idToken")
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Accept", "application/json")
            }
            try {
                connection.outputStream.use { output ->
                    output.write(payload.toString().toByteArray(Charsets.UTF_8))
                }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                val body = if (response.isNotBlank()) JSONObject(response) else JSONObject()
                if (status !in 200..299 || body.optBoolean("success", false).not()) {
                    throw IllegalStateException(
                        body.optString("error").ifBlank {
                            "Secure registration failed (HTTP $status). Please try again."
                        }
                    )
                }
            } finally {
                connection.disconnect()
            }
        }
    }

    suspend fun getUserProfile(uid: String): User? {
        val snapshot = firestore.collection("users")
            .document(uid)
            .get()
            .await()

        if (!snapshot.exists()) return null
        val data = snapshot.data ?: return null

        val roleStr = data["role"] as? String ?: "CUSTOMER"
        val roles = (data["roles"] as? List<*>)?.filterIsInstance<String>() ?: listOf(roleStr)
        val role = when (roleStr.uppercase()) {
            "CHANNEL_PARTNER", "TECHNICIAN" -> UserRole.TECHNICIAN
            "ADMIN" -> UserRole.ADMIN
            else -> UserRole.CUSTOMER
        }

        @Suppress("UNCHECKED_CAST")
        return User(
            uid = snapshot.id,
            quickFixId = if (role == UserRole.CHANNEL_PARTNER || role == UserRole.TECHNICIAN)
                data["partnerQuickFixId"] as? String ?: data["quickFixId"] as? String ?: ""
            else data["customerQuickFixId"] as? String ?: data["quickFixId"] as? String ?: "",
            phoneNumber = data["phoneNumber"] as? String ?: "",
            displayName = data["displayName"] as? String ?: "",
            email = data["email"] as? String ?: "",
            role = role,
            roles = roles,
            address = data["address"] as? String ?: "",
            city = data["city"] as? String ?: "Indore",
            pincode = data["pincode"] as? String ?: "452001",
            trades = (data["trades"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
            experienceYears = (data["experienceYears"] as? Long)?.toInt() ?: 0,
            kycDocType = data["kycDocType"] as? String ?: "",
            kycDocNumber = data["kycDocNumber"] as? String ?: "",
            isVerified = data["isVerified"] as? Boolean ?: false,
            upiId = data["upiId"] as? String ?: "",
            createdAt = (data["createdAt"] as? Timestamp)?.toDate()?.time
                ?: (data["createdAt"] as? Long)
                ?: System.currentTimeMillis()
        )
    }

    /**
     * Admin access is granted only by a Firebase Admin SDK custom claim.
     * A client-side passcode or email whitelist is never sufficient.
     */
    suspend fun getAdminUser(expectedEmail: String): User? {
        val firebaseUser = auth.currentUser ?: return null
        val token = firebaseUser.getIdToken(true).await()
        if (token.claims["admin"] != true) return null

        val tokenEmail = (token.claims["email"] as? String)
            ?: firebaseUser.email
            ?: return null
        if (!tokenEmail.equals(expectedEmail.trim(), ignoreCase = true)) return null

        return User(
            uid = firebaseUser.uid,
            phoneNumber = firebaseUser.phoneNumber ?: "",
            displayName = firebaseUser.displayName ?: tokenEmail.substringBefore("@"),
            email = tokenEmail,
            role = UserRole.ADMIN,
            city = "Bengaluru"
        )
    }

    fun signOut() {
        auth.signOut()
    }
}
