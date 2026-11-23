package com.quickfix.app.viewmodel

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.PhoneAuthProvider
import com.quickfix.app.data.model.AuthState
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import com.quickfix.app.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val repository: AuthRepository = AuthRepository()
) : ViewModel() {

    private val _authState = MutableStateFlow<AuthState>(AuthState.Idle)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    private var currentVerificationId: String = ""

    private fun requireMatchingLoginRole(existing: User, requestedRole: UserRole): User {
        val requestedPartner = requestedRole == UserRole.CHANNEL_PARTNER
        val existingPartner = existing.role == UserRole.CHANNEL_PARTNER ||
            existing.role == UserRole.TECHNICIAN
        if (requestedPartner != existingPartner) {
            throw SecurityException(
                if (existingPartner) {
                    "यह मोबाइल नंबर Channel Partner खाते से जुड़ा है। Partner विकल्प से लॉगिन करें।"
                } else {
                    "यह मोबाइल नंबर Customer खाते से जुड़ा है, Channel Partner खाते से नहीं। सही खाते से लॉगिन करें।"
                }
            )
        }
        return existing
    }

    init {
        checkExistingSession()
    }

    private fun checkExistingSession() {
        if (repository.isUserLoggedIn) {
            val uid = repository.currentUserUid ?: return
            viewModelScope.launch {
                try {
                    _authState.value = AuthState.Loading
                    val adminProfile = repository.getAdminUser(repository.currentUserEmail.orEmpty())
                    val profile = if (adminProfile != null) adminProfile else repository.getUserProfile(uid)
                    if (profile != null) {
                        _authState.value = AuthState.Authenticated(profile)
                    } else {
                        _authState.value = AuthState.Idle
                    }
                } catch (e: Exception) {
                    _authState.value = AuthState.Idle
                }
            }
        }
    }

    fun sendOtp(phoneNumber: String, activity: Activity, pendingUser: User) {
        // Invalidate the previous session before requesting a fresh SMS code.
        currentVerificationId = ""
        _authState.value = AuthState.Loading
        repository.sendPhoneOtp(
            phoneNumber = phoneNumber,
            activity = activity,
            onCodeSent = { verificationId ->
                currentVerificationId = verificationId
                _authState.value = AuthState.OtpSent(verificationId, phoneNumber)
            },
            onVerificationFailed = { exception ->
                // Use Firebase's stable error code, not substring guesses against
                // localized messages (for example, matching "39" can misclassify errors).
                val firebaseCode = (exception as? FirebaseAuthException)
                    ?.errorCode
                    ?.uppercase()
                    .orEmpty()
                val rawMsg = exception.localizedMessage.orEmpty()
                val errorMsg = when (firebaseCode) {
                    "ERROR_INVALID_PHONE_NUMBER", "ERROR_MISSING_PHONE_NUMBER" ->
                        "मोबाइल नंबर सही नहीं है। देश कोड +91 के साथ 10 अंकों का नंबर जाँचें।"
                    "ERROR_APP_NOT_AUTHORIZED" ->
                        "Firebase ने इस Android ऐप को अनुमति नहीं दी। Firebase Console में com.quickfix.app का package name और SHA-1/SHA-256 fingerprints जाँचें।"
                    "ERROR_CAPTCHA_CHECK_FAILED" ->
                        "Firebase की ऐप-सत्यापन जाँच पूरी नहीं हुई। Google Play services, इंटरनेट और Firebase App Verification configuration जाँचें।"
                    "ERROR_QUOTA_EXCEEDED" ->
                        "Firebase SMS quota पूरा हो गया है। Firebase Authentication की SMS quota/region policy जाँचें; यह जरूरी नहीं कि billing ही कारण हो।"
                    "ERROR_TOO_MANY_REQUESTS" ->
                        "बहुत अधिक OTP अनुरोध हुए हैं। सुरक्षा सीमा के कारण कुछ समय बाद दोबारा प्रयास करें।"
                    else ->
                        rawMsg.ifBlank { "SMS OTP नहीं भेजा जा सका। Firebase Phone Authentication configuration और नेटवर्क जाँचें।" }
                }
                _authState.value = AuthState.Error(errorMsg)
            },
            onAutoVerified = { credential ->
                // Instant SMS auto-retrieval follows the same profile-creation path as manual OTP entry.
                viewModelScope.launch {
                    try {
                        val uid = repository.signInWithCredential(credential)
                        val existing = repository.getUserProfile(uid)
                        val verifiedUser = when {
                            existing != null -> requireMatchingLoginRole(existing, pendingUser.role)
                            pendingUser.role == UserRole.CHANNEL_PARTNER -> {
                                repository.registerChannelPartner(pendingUser.copy(uid = uid))
                                repository.getUserProfile(uid)
                                    ?: throw IllegalStateException("Partner registration succeeded, but the profile could not be loaded.")
                            }
                            pendingUser.role == UserRole.CUSTOMER -> {
                                pendingUser.copy(uid = uid).also { repository.saveUserProfile(it) }
                            }
                            else -> throw SecurityException("This account type cannot be registered from this screen.")
                        }
                        _authState.value = AuthState.Authenticated(verifiedUser)
                    } catch (e: Exception) {
                        _authState.value = AuthState.Error(e.localizedMessage ?: "Verification error")
                    }
                }
            }
        )
    }

    fun verifyOtp(
        otpCode: String,
        pendingUser: User,
        onSuccess: (User) -> Unit
    ) {
        val cleanOtp = otpCode.filter { it.isDigit() }
        if (currentVerificationId.isBlank()) {
            _authState.value = AuthState.Error("OTP session expired. Please request a new SMS code.")
            return
        }
        if (cleanOtp.length != 6) {
            _authState.value = AuthState.Error("Enter the complete 6-digit SMS OTP.")
            return
        }
        viewModelScope.launch {
            try {
                _authState.value = AuthState.Loading
                val credential = PhoneAuthProvider.getCredential(currentVerificationId, cleanOtp)
                val uid = repository.signInWithCredential(credential)

                // Check if profile exists, otherwise save new profile
                val existingProfile = repository.getUserProfile(uid)
                val userToPersist = when {
                    existingProfile != null -> requireMatchingLoginRole(existingProfile, pendingUser.role)
                    pendingUser.role == UserRole.CHANNEL_PARTNER -> {
                        repository.registerChannelPartner(pendingUser)
                        repository.getUserProfile(uid)
                            ?: throw IllegalStateException("Registration was accepted, but the partner profile could not be loaded. Please sign in again.")
                    }
                    pendingUser.role == UserRole.CUSTOMER -> {
                        val newProfile = pendingUser.copy(uid = uid)
                        repository.saveUserProfile(newProfile)
                        newProfile
                    }
                    else -> throw SecurityException("This account type cannot be registered from this screen.")
                }

                _authState.value = AuthState.Authenticated(userToPersist)
                onSuccess(userToPersist)
            } catch (e: Exception) {
                _authState.value = AuthState.Error(e.localizedMessage ?: "Invalid OTP verification code")
            }
        }
    }

    fun signInAdmin(
        email: String,
        password: String,
        onSuccess: (User) -> Unit,
        onError: (String) -> Unit
    ) {
        _authState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                val adminUser = repository.signInAdmin(email, password)
                _authState.value = AuthState.Authenticated(adminUser)
                onSuccess(adminUser)
            } catch (e: Exception) {
                val message = e.localizedMessage ?: "Firebase admin sign-in failed."
                _authState.value = AuthState.Error(message)
                onError(message)
            }
        }
    }

    @Suppress("UNUSED_PARAMETER")
    fun verifyAdminPasscode(
        email: String,
        passcode: String,
        phone: String,
        onSuccess: (User) -> Unit,
        onError: (String) -> Unit = {}
    ) {
        // Legacy passcodes are deliberately ignored. The account must already
        // be signed in to Firebase and carry an Admin SDK-issued { admin: true } claim.
        _authState.value = AuthState.Loading
        viewModelScope.launch {
            try {
                val adminUser = repository.getAdminUser(email)
                    ?: throw SecurityException(
                        "Admin access denied. Sign in with the authorized Firebase account and have an administrator assign the admin custom claim."
                    )
                _authState.value = AuthState.Authenticated(adminUser)
                onSuccess(adminUser)
            } catch (e: Exception) {
                val message = e.localizedMessage ?: "Firebase admin verification failed."
                _authState.value = AuthState.Error(message)
                onError(message)
            }
        }
    }

    @Suppress("UNUSED_PARAMETER")
    fun verifyAdminPasscode(passcode: String, phone: String, onSuccess: (User) -> Unit) {
        verifyAdminPasscode(
            email = repository.currentUserEmail.orEmpty(),
            passcode = passcode,
            phone = phone,
            onSuccess = onSuccess
        )
    }

    fun logout() {
        repository.signOut()
        _authState.value = AuthState.Idle
    }
}
