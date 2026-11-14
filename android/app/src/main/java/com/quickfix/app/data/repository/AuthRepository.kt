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
import kotlinx.coroutines.tasks.await
import java.util.concurrent.TimeUnit

class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()
) {
    val currentUserUid: String?
        get() = auth.currentUser?.uid

    val currentUserEmail: String?
        get() = auth.currentUser?.email

    val isUserLoggedIn: Boolean
        get() = auth.currentUser != null

    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null

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
                    onCodeSent(verificationId)
                }
            })

        resendToken?.let { builder.setForceResendingToken(it) }
        PhoneAuthProvider.verifyPhoneNumber(builder.build())
    }

    suspend fun signInWithCredential(credential: PhoneAuthCredential): String {
        val result = auth.signInWithCredential(credential).await()
        return result.user?.uid ?: throw IllegalStateException("Firebase UID is null")
    }

    suspend fun saveUserProfile(user: User) {
        val userMap = hashMapOf<String, Any>(
            "uid" to user.uid,
            "phoneNumber" to user.phoneNumber,
            "displayName" to user.displayName,
            "email" to user.email,
            "role" to user.role.name,
            "address" to user.address,
            "city" to user.city,
            "pincode" to user.pincode,
            "trades" to user.trades,
            "experienceYears" to user.experienceYears,
            "kycDocType" to user.kycDocType,
            "kycDocNumber" to user.kycDocNumber,
            "isVerified" to user.isVerified,
            "upiId" to user.upiId,
            "createdAt" to FieldValue.serverTimestamp()
        )
        firestore.collection("users")
            .document(user.uid)
            .set(userMap)
            .await()
    }

    suspend fun getUserProfile(uid: String): User? {
        val snapshot = firestore.collection("users")
            .document(uid)
            .get()
            .await()

        if (!snapshot.exists()) return null
        val data = snapshot.data ?: return null

        val roleStr = data["role"] as? String ?: "CUSTOMER"
        val role = try {
            UserRole.valueOf(roleStr)
        } catch (e: Exception) {
            UserRole.CUSTOMER
        }

        @Suppress("UNCHECKED_CAST")
        return User(
            uid = snapshot.id,
            phoneNumber = data["phoneNumber"] as? String ?: "",
            displayName = data["displayName"] as? String ?: "",
            email = data["email"] as? String ?: "",
            role = role,
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

    suspend fun signInAdminWithEmailPassword(email: String, password: String): User {
        require(email.isNotBlank() && password.isNotBlank()) {
            "Enter the administrator email and password."
        }
        auth.signInWithEmailAndPassword(email.trim(), password).await()
        return try {
            getAdminUser(email)
                ?: throw SecurityException("Admin access denied. This Firebase account does not have the server-issued admin claim.")
        } catch (error: Exception) {
            auth.signOut()
            throw error
        }
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
