package com.quickfix.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.quickfix.app.data.model.AdminMasterPaymentConfig
import com.quickfix.app.data.model.Booking
import com.quickfix.app.data.model.CommissionSettings
import com.quickfix.app.data.model.PayoutRecord
import com.quickfix.app.data.model.ServiceItem
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class AdminMetrics(
    val totalCustomers: Int = 0,
    val totalElectricians: Int = 0,
    val totalPlumbers: Int = 0,
    val totalBookings: Int = 0,
    val totalRevenueGmv: Int = 0,
    val totalCommission: Int = 0,
    val totalDisbursed: Int = 0
)

class QuickFixViewModel : ViewModel() {

    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()

    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private var bookingsListener: ListenerRegistration? = null
    private var usersListener: ListenerRegistration? = null

    private val authStateListener = FirebaseAuth.AuthStateListener { firebaseAuth ->
        observeSignedInAccount(firebaseAuth)
    }

    init {
        auth.addAuthStateListener(authStateListener)
    }

    private fun observeSignedInAccount(firebaseAuth: FirebaseAuth) {
        bookingsListener?.remove()
        usersListener?.remove()
        bookingsListener = null
        usersListener = null

        val firebaseUser = firebaseAuth.currentUser
        _bookings.value = emptyList()
        _customers.value = emptyList()
        _technicians.value = emptyList()

        if (firebaseUser == null) {
            _firestoreSyncStatus.value = "Sign in to load account data."
            return
        }

        viewModelScope.launch {
            try {
                val token = firebaseUser.getIdToken(true).await()
                val isAdmin = token.claims["admin"] == true
                val ownProfile = firestore.collection("users").document(firebaseUser.uid).get().await()
                val isTechnician = ownProfile.getString("role") == "TECHNICIAN"
                val bookingQuery = when {
                    isAdmin -> firestore.collection("bookings")
                    isTechnician -> firestore.collection("bookings").whereEqualTo("technicianUid", firebaseUser.uid)
                    else -> firestore.collection("bookings").whereEqualTo("customerUid", firebaseUser.uid)
                }

                bookingsListener = bookingQuery.addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        _firestoreSyncStatus.value = "Booking load failed: " + (error.localizedMessage ?: "permission/network error")
                        return@addSnapshotListener
                    }
                    _bookings.value = snapshot?.documents?.mapNotNull { document ->
                        val data = document.data ?: return@mapNotNull null
                        Booking(
                            id = data["id"] as? String ?: document.id,
                            serviceTitle = data["serviceTitle"] as? String ?: "",
                            category = data["category"] as? String ?: "",
                            customerName = data["customerName"] as? String ?: "",
                            customerAddress = data["customerAddress"] as? String ?: "",
                            status = data["status"] as? String ?: "requested",
                            technicianName = data["technicianName"] as? String,
                            startOtp = data["startOtp"] as? String ?: "",
                            price = (data["price"] as? Number)?.toInt() ?: 0,
                            totalAmount = (data["totalAmount"] as? Number)?.toInt() ?: 0,
                            technicianPayout = (data["technicianPayout"] as? Number)?.toInt() ?: 0,
                            adminCommission = (data["adminCommission"] as? Number)?.toInt() ?: 0,
                            paymentStatus = data["paymentStatus"] as? String ?: "pending",
                            escrowStatus = data["escrowStatus"] as? String ?: "not_funded"
                        )
                    } ?: emptyList()
                    _firestoreSyncStatus.value = "Bookings loaded from Firestore."
                }

                if (isAdmin) {
                    usersListener = firestore.collection("users").addSnapshotListener { snapshot, error ->
                        if (error != null) {
                            _firestoreSyncStatus.value = "User list load failed: " + (error.localizedMessage ?: "permission/network error")
                            return@addSnapshotListener
                        }
                        val users = snapshot?.documents?.mapNotNull { document ->
                            val data = document.data ?: return@mapNotNull null
                            val role = if (data["role"] == "TECHNICIAN") UserRole.TECHNICIAN else UserRole.CUSTOMER
                            User(
                                uid = document.id,
                                phoneNumber = data["phoneNumber"] as? String ?: "",
                                displayName = data["displayName"] as? String ?: "",
                                email = data["email"] as? String ?: "",
                                role = role,
                                address = data["address"] as? String ?: "",
                                city = data["city"] as? String ?: "",
                                pincode = data["pincode"] as? String ?: "",
                                trades = (data["trades"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
                                experienceYears = (data["experienceYears"] as? Number)?.toInt() ?: 0,
                                kycDocType = data["kycDocType"] as? String ?: "",
                                kycDocNumber = data["kycDocNumber"] as? String ?: "",
                                isVerified = data["isVerified"] as? Boolean ?: false,
                                upiId = data["upiId"] as? String ?: ""
                            )
                        } ?: emptyList()
                        _customers.value = users.filter { it.role == UserRole.CUSTOMER }
                        _technicians.value = users.filter { it.role == UserRole.TECHNICIAN }
                    }
                }
                _firestoreSyncStatus.value = if (isAdmin) {
                    "Admin Firestore listeners active."
                } else {
                    "Customer booking listener active."
                }
            } catch (error: Exception) {
                _firestoreSyncStatus.value = "Firestore access failed: " + (error.localizedMessage ?: "unknown error")
            }
        }
    }

    override fun onCleared() {
        bookingsListener?.remove()
        usersListener?.remove()
        auth.removeAuthStateListener(authStateListener)
        super.onCleared()
    }


    private val _commissionSettings = MutableStateFlow(
        CommissionSettings(
            electricianCommissionPct = 12,
            plumberCommissionPct = 15,
            convenienceFee = 29,
            gstPct = 18
        )
    )
    val commissionSettings: StateFlow<CommissionSettings> = _commissionSettings.asStateFlow()

    // Admin and customer lists start empty and are populated from authenticated Firestore listeners.
    private val _customers = MutableStateFlow<List<User>>(emptyList())
    val customers: StateFlow<List<User>> = _customers.asStateFlow()

    private val _technicians = MutableStateFlow<List<User>>(emptyList())
    val technicians: StateFlow<List<User>> = _technicians.asStateFlow()

    private val _bookings = MutableStateFlow<List<Booking>>(emptyList())
    val bookings: StateFlow<List<Booking>> = _bookings.asStateFlow()

    private val _adminPaymentConfig = MutableStateFlow(AdminMasterPaymentConfig())
    val adminPaymentConfig: StateFlow<AdminMasterPaymentConfig> = _adminPaymentConfig.asStateFlow()

    // Payout records remain unavailable until a server-owned ledger is deployed.
    private val _payouts = MutableStateFlow<List<PayoutRecord>>(emptyList())
    val payouts: StateFlow<List<PayoutRecord>> = _payouts.asStateFlow()


    private val _firestoreSyncStatus = MutableStateFlow("Not checked")
    val firestoreSyncStatus: StateFlow<String> = _firestoreSyncStatus.asStateFlow()

    fun updateAdminPaymentConfig(updated: AdminMasterPaymentConfig) {
        _adminPaymentConfig.value = updated
        viewModelScope.launch {
            try {
                firestore.collection("system").document("admin_payment_gateway").set(updated)
            } catch (_: Exception) {}
        }
    }

    fun adminApprovePayout(payoutId: String) {
        // Never manufacture a UTR or mark a payout settled from the Android client.
        _payouts.value = _payouts.value.map { payout ->
            if (payout.id == payoutId) {
                payout.copy(
                    status = "held_in_escrow",
                    adminApprovalStatus = "pending",
                    adminNote = "Not released: secure server-side payment integration and verified provider response are required. No money was transferred."
                )
            } else payout
        }
    }

    fun adminHoldPayout(payoutId: String, reason: String) {
        _payouts.value = _payouts.value.map { p ->
            if (p.id == payoutId) {
                p.copy(
                    status = "held_in_escrow",
                    adminApprovalStatus = "held",
                    adminApprovedBy = "QuickFix HQ Admin",
                    adminNote = "FUNDS ON HOLD BY ADMIN: $reason"
                )
            } else p
        }
    }

    fun adminIssueCustomerRefund(bookingId: String, amount: Int, reason: String) {
        // A refund is not a local status change. Keep the payment state unchanged
        // until a trusted payment provider confirms the refund server-side.
        _bookings.value = _bookings.value.map { booking ->
            if (booking.id == bookingId) {
                booking.copy(
                    refundReason = "Refund not issued. Payment provider integration is not configured. " + reason
                )
            } else booking
        }
    }

    fun updateCommissionSettings(electricianPct: Int, plumberPct: Int, convenienceFee: Int) {
        val updated = _commissionSettings.value.copy(
            electricianCommissionPct = electricianPct,
            plumberCommissionPct = plumberPct,
            convenienceFee = convenienceFee
        )
        _commissionSettings.value = updated
        viewModelScope.launch {
            try {
                firestore.collection("system").document("commission_rules").set(updated)
            } catch (_: Exception) {}
        }
    }

    fun approveTechnicianKyc(techUid: String) {
        _technicians.value = _technicians.value.map { tech ->
            if (tech.uid == techUid) tech.copy(isVerified = true) else tech
        }
    }

    fun rejectTechnicianKyc(techUid: String) {
        _technicians.value = _technicians.value.map { tech ->
            if (tech.uid == techUid) tech.copy(isVerified = false) else tech
        }
    }

    fun reassignBooking(bookingId: String, newTechnicianName: String) {
        _bookings.value = _bookings.value.map { b ->
            if (b.id == bookingId) b.copy(technicianName = newTechnicianName, status = "assigned") else b
        }
    }

    fun updateBookingStatus(bookingId: String, newStatus: String) {
        _bookings.value = _bookings.value.map { b ->
            if (b.id == bookingId) b.copy(status = newStatus) else b
        }
    }

    private val _currentCity = MutableStateFlow("Indore")
    val currentCity: StateFlow<String> = _currentCity.asStateFlow()

    fun setCity(city: String) {
        _currentCity.value = city
    }

    private val _services = MutableStateFlow<List<ServiceItem>>(
        listOf(
            ServiceItem(
                id = "elec-fan",
                category = "electrician",
                title = "Ceiling Fan Repair & Fitting",
                hindiTitle = "पंखा मरम्मत और फिटिंग",
                startingPrice = 199,
                rating = 4.88,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "elec-switch",
                category = "electrician",
                title = "Switchboard & Socket Replacement",
                hindiTitle = "स्विचबोर्ड व सॉकेट रिपेयर",
                startingPrice = 149,
                rating = 4.85,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "elec-mcb",
                category = "electrician",
                title = "MCB Tripping & Fuse Repair",
                hindiTitle = "एमसीबी ट्रिपिंग और शॉर्ट सर्किट",
                startingPrice = 299,
                rating = 4.92,
                warrantyDays = 45
            ),
            ServiceItem(
                id = "elec-inverter",
                category = "electrician",
                title = "Inverter & Battery Wiring",
                hindiTitle = "इन्वर्टर और बैटरी वायरिंग",
                startingPrice = 349,
                rating = 4.89,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "plumb-tap",
                category = "plumber",
                title = "Tap Leakage & Spindle Replacement",
                hindiTitle = "नल लीकेज और स्पिंडल चेंज",
                startingPrice = 149,
                rating = 4.86,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "plumb-drain",
                category = "plumber",
                title = "Kitchen Sink & Waste Pipe Blockage",
                hindiTitle = "किचन सिंक व ड्रेन पाइप चोक रिपेयर",
                startingPrice = 249,
                rating = 4.90,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "plumb-flush",
                category = "plumber",
                title = "Flush Tank & Cistern Repair",
                hindiTitle = "फ्लश टैंक और सिस्टर्न रिपेयर",
                startingPrice = 299,
                rating = 4.82,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "plumb-tank",
                category = "plumber",
                title = "Overhead Tank Float Valve Repair",
                hindiTitle = "पानी की टंकी फ्लोट वाल्व फिटिंग",
                startingPrice = 349,
                rating = 4.91,
                warrantyDays = 45
            )
        )
    )
    val services: StateFlow<List<ServiceItem>> = _services.asStateFlow()

    suspend fun createBooking(
        serviceTitle: String,
        category: String,
        customerAddress: String,
        price: Int,
        notes: String = ""
    ): Booking {
        val firebaseUser = FirebaseAuth.getInstance().currentUser
            ?: throw SecurityException("Please sign in with your mobile number before creating a booking.")
        require(customerAddress.isNotBlank()) { "Please enter your complete service address." }
        require(price > 0) { "Invalid service price." }

        val profile = firestore.collection("users").document(firebaseUser.uid).get().await()
        val customerName = profile.getString("displayName")
            ?: firebaseUser.displayName
            ?: "QuickFix Customer"
        val customerPhone = profile.getString("phoneNumber")
            ?: firebaseUser.phoneNumber
            ?: ""

        val settings = _commissionSettings.value
        val convenience = settings.convenienceFee
        val gst = (price * settings.gstPct) / 100
        val discount = 20
        val total = (price + convenience + gst - discount).coerceAtLeast(0)
        val bookingId = "QF-" + java.util.UUID.randomUUID().toString().take(8).uppercase()

        // New requests are not assigned, paid, or OTP-enabled on the client.
        // Assignment, start OTP and payment state must be set by trusted backend workflows.
        val newBooking = Booking(
            id = bookingId,
            serviceTitle = serviceTitle,
            category = category,
            customerName = customerName,
            customerAddress = customerAddress.trim(),
            status = "requested",
            technicianName = null,
            startOtp = "",
            price = price,
            totalAmount = total,
            technicianPayout = 0,
            adminCommission = 0,
            paymentStatus = "pending",
            escrowStatus = "not_funded"
        )

        val bookingData = hashMapOf(
            "id" to bookingId,
            "customerUid" to firebaseUser.uid,
            "customerName" to customerName,
            "customerPhone" to customerPhone,
            "customerAddress" to customerAddress.trim(),
            "serviceTitle" to serviceTitle,
            "category" to category,
            "notes" to notes.trim(),
            "status" to "requested",
            "startOtp" to "",
            "price" to price,
            "convenienceFee" to convenience,
            "discount" to discount,
            "taxes" to gst,
            "totalAmount" to total,
            "paymentStatus" to "pending",
            "escrowStatus" to "not_funded",
            "createdAt" to FieldValue.serverTimestamp()
        )

        firestore.collection("bookings").document(bookingId).set(bookingData).await()
        _bookings.value = listOf(newBooking) + _bookings.value
        return newBooking
    }

    fun verifyStartOtp(bookingId: String, enteredOtp: String): Boolean {
        val target = _bookings.value.find { it.id == bookingId } ?: return false
        if (target.startOtp.isBlank()) return false
        return if (target.startOtp == enteredOtp.trim()) {
            _bookings.value = _bookings.value.map { b ->
                if (b.id == bookingId) b.copy(status = "in_progress") else b
            }
            true
        } else false
    }

    fun completeJob(bookingId: String) {
        _bookings.value = _bookings.value.map { b ->
            if (b.id == bookingId) b.copy(status = "completed") else b
        }
    }

    fun requestTechnicianPayout(techId: String, techName: String, amount: Int, upiId: String) {
        // Deliberately fail closed: a client must not create a payout or debit a
        // wallet without the trusted backend ledger and payment-provider workflow.
        _firestoreSyncStatus.value = "Payouts unavailable: secure payment backend is not configured."
    }

    fun triggerFirestoreSync() {
        _firestoreSyncStatus.value = "Checking Firestore connection..."
        viewModelScope.launch {
            val startedAt = System.nanoTime()
            try {
                firestore.collection("_quickfix_health").document("ping").get().await()
                val elapsedMs = (System.nanoTime() - startedAt) / 1_000_000
                _firestoreSyncStatus.value = "Firestore reachable (" + elapsedMs + "ms)."
            } catch (error: Exception) {
                val reason = error.localizedMessage ?: "Unknown connection or permission error"
                _firestoreSyncStatus.value = "Firestore check failed: " + reason
            }
        }
    }
}
