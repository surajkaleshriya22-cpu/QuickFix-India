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
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
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

    init {
        auth.addAuthStateListener(authStateListener)
    }

    fun updateAdminPaymentConfig(updated: AdminMasterPaymentConfig) {
        _firestoreSyncStatus.value = "Payment settings not saved: trusted admin backend is not configured."
    }

    fun adminApprovePayout(payoutId: String) {
        _firestoreSyncStatus.value = "Payout not approved or released: trusted ledger and verified payment-provider backend are not configured. No money moved."
    }

    fun adminHoldPayout(payoutId: String, reason: String) {
        _firestoreSyncStatus.value = "Payout hold not recorded: trusted server ledger is not configured. No funds were changed."
    }

    fun adminIssueCustomerRefund(bookingId: String, amount: Int, reason: String) {
        _firestoreSyncStatus.value = "Refund not issued: trusted payment-provider backend is not configured. No money was refunded."
    }

    fun updateCommissionSettings(electricianPct: Int, plumberPct: Int, convenienceFee: Int) {
        _firestoreSyncStatus.value = "Commission settings not saved: trusted admin backend is not configured."
    }

    fun approveTechnicianKyc(techUid: String) {
        _firestoreSyncStatus.value = "KYC approval not applied: trusted admin backend is not configured."
    }

    fun rejectTechnicianKyc(techUid: String) {
        _firestoreSyncStatus.value = "KYC decision not applied: trusted admin backend is not configured."
    }

    fun reassignBooking(bookingId: String, newTechnicianName: String) {
        _firestoreSyncStatus.value = "Booking not reassigned: trusted dispatch backend is not configured."
    }

    fun updateBookingStatus(bookingId: String, newStatus: String) {
        _firestoreSyncStatus.value = "Booking status not changed: trusted server workflow is not configured."
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
            ,
            ServiceItem(
                id = "ac-jet-clean",
                category = "ac_repair",
                title = "Split / Window AC Deep Jet Service",
                hindiTitle = "एसी जेट वाश और केमिकल सर्विस",
                startingPrice = 499,
                rating = 4.92,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "fridge-cooling-fix",
                category = "fridge_repair",
                title = "Refrigerator Not Cooling / Compressor Check",
                hindiTitle = "फ्रिज कूलिंग व कंप्रेसर जांच",
                startingPrice = 299,
                rating = 4.87,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "weld-gate",
                category = "welder",
                title = "Gate, Grill & Railing Welding",
                hindiTitle = "गेट, ग्रिल और रेलिंग वेल्डिंग",
                startingPrice = 399,
                rating = 4.80,
                warrantyDays = 30
            ),
            ServiceItem(
                id = "mech-bike",
                category = "mechanic",
                title = "Two-Wheeler Breakdown & Basic Repair",
                hindiTitle = "बाइक और स्कूटर की बेसिक मरम्मत",
                startingPrice = 249,
                rating = 4.82,
                warrantyDays = 7
            ),
            ServiceItem(
                id = "driver-local",
                category = "driver",
                title = "Local Hourly Driver",
                hindiTitle = "लोकल घंटे के हिसाब से ड्राइवर",
                startingPrice = 399,
                rating = 4.86,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "guide-city",
                category = "tourist_guide",
                title = "Local City Sightseeing Guide",
                hindiTitle = "शहर घूमने के लिए लोकल गाइड",
                startingPrice = 599,
                rating = 4.88,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "contractor-inspection",
                category = "contractor",
                title = "Home Repair & Renovation Site Visit",
                hindiTitle = "घर की मरम्मत और रिनोवेशन साइट विजिट",
                startingPrice = 499,
                rating = 4.83,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "labour-helper",
                category = "labour",
                title = "General Helper / Daily Labour",
                hindiTitle = "सामान्य मजदूर / रोज़ाना लेबर",
                startingPrice = 499,
                rating = 4.80,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "labour-construction",
                category = "labour",
                title = "Construction & Site Labour",
                hindiTitle = "निर्माण कार्य और साइट मजदूर",
                startingPrice = 599,
                rating = 4.82,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-cooking",
                category = "home_care",
                title = "Home Cooking & Meal Preparation",
                hindiTitle = "घर का खाना बनाना",
                startingPrice = 299,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-laundry",
                category = "home_care",
                title = "Laundry Washing & Folding",
                hindiTitle = "कपड़े धोना और तह करना",
                startingPrice = 199,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-ironing",
                category = "home_care",
                title = "Clothes Ironing",
                hindiTitle = "कपड़ों पर प्रेस करना",
                startingPrice = 149,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-dishes",
                category = "home_care",
                title = "Utensil & Dish Washing",
                hindiTitle = "बर्तन धोना",
                startingPrice = 149,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-sweep-mop",
                category = "home_care",
                title = "Sweeping & Floor Mopping",
                hindiTitle = "झाड़ू और पोछा",
                startingPrice = 199,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-bathroom",
                category = "home_care",
                title = "Bathroom & Toilet Cleaning",
                hindiTitle = "बाथरूम और टॉयलेट की सफाई",
                startingPrice = 249,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-dusting",
                category = "home_care",
                title = "Dusting & Room Tidying",
                hindiTitle = "धूल साफ करना और कमरा व्यवस्थित करना",
                startingPrice = 199,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-kitchen",
                category = "home_care",
                title = "Kitchen & Platform Cleaning",
                hindiTitle = "किचन और स्लैब की सफाई",
                startingPrice = 249,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-full-clean",
                category = "home_care",
                title = "Full Home Routine Cleaning",
                hindiTitle = "पूरे घर की सामान्य सफाई",
                startingPrice = 699,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "home-elder-assist",
                category = "home_care",
                title = "Household Help & Daily Chores",
                hindiTitle = "घर के रोज़मर्रा के कामों में मदद",
                startingPrice = 249,
                rating = 0.0,
                warrantyDays = 0
            ),
            ServiceItem(
                id = "bike-pickup",
                category = "bike_rider",
                title = "Bike Pickup & Local Delivery",
                hindiTitle = "बाइक से पिकअप और लोकल डिलीवरी",
                startingPrice = 99,
                rating = 4.85,
                warrantyDays = 0
            )
        )
    )
    val services: StateFlow<List<ServiceItem>> = _services.asStateFlow()

    suspend fun createBooking(
        serviceId: String,
        serviceTitle: String,
        category: String,
        customerAddress: String,
        serviceState: String,
        serviceDistrict: String,
        serviceTehsil: String,
        scheduledDate: String,
        scheduledTimeSlot: String,
        notes: String = ""
    ): Booking {
        val firebaseUser = auth.currentUser
            ?: throw SecurityException("Please sign in with your mobile number before creating a booking.")
        require(customerAddress.isNotBlank()) { "Please enter your complete service address." }
        require(serviceState.isNotBlank() && serviceDistrict.isNotBlank() && serviceTehsil.isNotBlank()) { "Please select State, District and Tehsil." }
        require(serviceState.length <= 100 && serviceDistrict.length <= 100 && serviceTehsil.length <= 100) { "Service area details are too long." }
        require(scheduledDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) { "Date must be in YYYY-MM-DD format." }
        require(scheduledTimeSlot.isNotBlank()) { "Please select a service time slot." }

        // Keep Android's legacy service IDs compatible with the trusted server catalogue.
        val serverServiceId = when (serviceId) {
            "plumb-drain" -> "plumb-block"
            "plumb-flush" -> "plumb-toilet"
            else -> serviceId
        }
        val idToken = firebaseUser.getIdToken(true).await().token
            ?: throw SecurityException("Could not obtain a secure sign-in token.")

        val responseBody = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            val connection = java.net.URL("https://quickfix-india.onrender.com/api/bookings")
                .openConnection() as java.net.HttpURLConnection
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $idToken")
                val payload = org.json.JSONObject()
                    .put("serviceId", serverServiceId)
                    .put("scheduledDate", scheduledDate)
                    .put("scheduledTimeSlot", scheduledTimeSlot)
                    .put("paymentMethod", "cash")
                    .put("address", customerAddress.trim())
                    .put("serviceArea", org.json.JSONObject()
                        .put("state", serviceState.trim())
                        .put("district", serviceDistrict.trim())
                        .put("tehsil", serviceTehsil.trim()))
                    .put("notes", notes.trim())
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                if (status !in 200..299) {
                    val message = runCatching { org.json.JSONObject(body).optString("error") }.getOrNull()
                    throw IllegalStateException(message?.takeIf { it.isNotBlank() }
                        ?: "Secure booking service returned HTTP $status.")
                }
                body
            } finally {
                connection.disconnect()
            }
        }

        val result = org.json.JSONObject(responseBody)
        val bookingId = result.optString("bookingId")
        if (!result.optBoolean("success") || bookingId.isBlank()) {
            throw IllegalStateException("Server did not confirm the booking. Please retry.")
        }

        // Do not perform a second Firestore read after the server has created the booking:
        // a profile-read failure must not make the customer retry and create a duplicate booking.
        val newBooking = Booking(
            id = bookingId,
            serviceTitle = serviceTitle,
            category = category,
            customerName = firebaseUser.displayName ?: "QuickFix Customer",
            customerAddress = customerAddress.trim(),
            status = "requested",
            technicianName = null,
            startOtp = "",
            price = 0,
            totalAmount = 0,
            technicianPayout = 0,
            adminCommission = 0,
            paymentStatus = "pending",
            escrowStatus = "not_funded"
        )
        // The Firestore listener remains the source of the server-calculated price and booking state.
        _bookings.value = listOf(newBooking) + _bookings.value
        return newBooking
    }

    fun verifyStartOtp(bookingId: String, enteredOtp: String): Boolean {
        _firestoreSyncStatus.value = "OTP not verified: secure server-side OTP workflow is not configured. No booking status changed."
        return false
    }

    fun completeJob(bookingId: String) {
        _firestoreSyncStatus.value = "Job not marked complete: trusted server workflow is not configured. No booking status changed."
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
