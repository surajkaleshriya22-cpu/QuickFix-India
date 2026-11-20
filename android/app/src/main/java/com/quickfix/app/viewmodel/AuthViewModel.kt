package com.quickfix.app.viewmodel

import android.app.Activity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
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
        _authState.value = AuthState.Loading
        repository.sendPhoneOtp(
            phoneNumber = phoneNumber,
            activity = activity,
            onCodeSent = { verificationId ->
                currentVerificationId = verificationId
                _authState.value = AuthState.OtpSent(verificationId, phoneNumber)
            },
            onVerificationFailed = { exception ->
                val rawMsg = exception.localizedMessage ?: ""
                val errorMsg = when {
                    rawMsg.contains("17010") || rawMsg.contains("app is not authorized") ->
                        "Firebase Config Required: Add your Android SHA-1 fingerprint to Firebase Console (Project Settings > Android App)."
                    rawMsg.contains("39") || rawMsg.contains("Play Integrity") || rawMsg.contains("reCAPTCHA") ->
                        "Play Integrity / SafetyNet check failed. Ensure SHA-256 fingerprint is added to Firebase Console."
                    rawMsg.contains("BILLING") || rawMsg.contains("quota", ignoreCase = true) ||
                        rawMsg.contains("too many requests", ignoreCase = true) ->
                        "Firebase SMS limit reached or SMS billing is not enabled. For real OTP, link a Cloud Billing account and use the Blaze plan in Firebase Console. For app testing, add a Firebase test phone number and its fixed test code; no SMS will be sent."
                    else ->
                        if (rawMsg.isNotEmpty()) rawMsg else "Failed to send SMS OTP. Please check mobile network or Firebase Phone Auth settings."
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
                            existing != null -> existing
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
        viewModelScope.launch {
            try {
                _authState.value = AuthState.Loading
                val credential = PhoneAuthProvider.getCredential(currentVerificationId, otpCode)
                val uid = repository.signInWithCredential(credential)

                // Check if profile exists, otherwise save new profile
                val existingProfile = repository.getUserProfile(uid)
                val userToPersist = when {
                    existingProfile != null -> existingProfile
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
