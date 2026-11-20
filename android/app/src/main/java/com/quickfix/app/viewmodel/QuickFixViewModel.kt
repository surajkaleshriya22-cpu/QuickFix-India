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

data class PartnerLiveLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double? = null,
    val updatedAt: String = "",
    val ageSeconds: Int = 0
)

data class PartnerJob(
    val id: String,
    val serviceTitle: String,
    val category: String,
    val customerName: String,
    val price: Int,
    val totalAmount: Int,
    val status: String = "requested"
)

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
        _customerStartOtps.value = emptyMap()
        _customerStartOtpStatus.value = emptyMap()

        if (firebaseUser == null) {
            _firestoreSyncStatus.value = "Sign in to load account data."
            return
        }

        viewModelScope.launch {
            try {
                val token = firebaseUser.getIdToken(true).await()
                val isAdmin = token.claims["admin"] == true
                val ownProfile = firestore.collection("users").document(firebaseUser.uid).get().await()
                val ownRole = ownProfile.getString("role")
                val isTechnician = ownRole == "CHANNEL_PARTNER" || ownRole == "TECHNICIAN"
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
                            escrowStatus = data["escrowStatus"] as? String ?: "not_funded",
                            customerLatitude = ((data["customerLocation"] as? Map<*, *>)?.get("latitude") as? Number)?.toDouble(),
                            customerLongitude = ((data["customerLocation"] as? Map<*, *>)?.get("longitude") as? Number)?.toDouble()
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
                            val role = if (data["role"] == "CHANNEL_PARTNER") UserRole.CHANNEL_PARTNER else if (data["role"] == "TECHNICIAN") UserRole.TECHNICIAN else UserRole.CUSTOMER
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
                        _technicians.value = users.filter { it.role == UserRole.CHANNEL_PARTNER || it.role == UserRole.TECHNICIAN }
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

    private val _customerStartOtps = MutableStateFlow<Map<String, String>>(emptyMap())
    val customerStartOtps: StateFlow<Map<String, String>> = _customerStartOtps.asStateFlow()
    private val _customerStartOtpStatus = MutableStateFlow<Map<String, String>>(emptyMap())
    val customerStartOtpStatus: StateFlow<Map<String, String>> = _customerStartOtpStatus.asStateFlow()

    private val _bookings = MutableStateFlow<List<Booking>>(emptyList())
    val bookings: StateFlow<List<Booking>> = _bookings.asStateFlow()

    private val _partnerJobs = MutableStateFlow<List<PartnerJob>>(emptyList())
    val partnerJobs: StateFlow<List<PartnerJob>> = _partnerJobs.asStateFlow()

    private val _partnerJobsStatus = MutableStateFlow("Available jobs have not been refreshed.")
    val partnerJobsStatus: StateFlow<String> = _partnerJobsStatus.asStateFlow()

    private val _partnerLocationStatus = MutableStateFlow("Live location sharing is off.")
    val partnerLocationStatus: StateFlow<String> = _partnerLocationStatus.asStateFlow()

    private val _partnerLiveLocations = MutableStateFlow<Map<String, PartnerLiveLocation>>(emptyMap())
    val partnerLiveLocations: StateFlow<Map<String, PartnerLiveLocation>> = _partnerLiveLocations.asStateFlow()

    private val _partnerJobsCursor = MutableStateFlow<String?>(null)
    private val _partnerJobsHasMore = MutableStateFlow(false)
    val partnerJobsHasMore: StateFlow<Boolean> = _partnerJobsHasMore.asStateFlow()

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

    // Android mirrors the canonical service catalogue in src/data/mockData.ts.
    // Keep service IDs identical so the booking API receives known catalogue IDs.
    private val _services = MutableStateFlow<List<ServiceItem>>(
        listOf(
            ServiceItem(id = "elec-fan", category = "electrician", title = "Ceiling Fan Repair & Installation", hindiTitle = "पंखा मरम्मत और फिटिंग", startingPrice = 199, rating = 4.88, warrantyDays = 30),
            ServiceItem(id = "elec-switch", category = "electrician", title = "Switch, Socket & Board Repair", hindiTitle = "स्विच और सॉकेट मरम्मत", startingPrice = 149, rating = 4.82, warrantyDays = 30),
            ServiceItem(id = "elec-mcb", category = "electrician", title = "MCB Tripping & Short Circuit Fix", hindiTitle = "एमसीबी ट्रिपिंग और शॉर्ट सर्किट", startingPrice = 349, rating = 4.93, warrantyDays = 60),
            ServiceItem(id = "elec-inverter", category = "electrician", title = "Inverter & Battery Wiring Setup", hindiTitle = "इन्वर्टर और बैटरी वायरिंग", startingPrice = 499, rating = 4.89, warrantyDays = 90),
            ServiceItem(id = "elec-light", category = "electrician", title = "LED Concealed Lights & Chandeliers", hindiTitle = "झूमर और फॉल्स सीलिंग लाइट फिटिंग", startingPrice = 299, rating = 4.79, warrantyDays = 30),
            ServiceItem(id = "plumb-tap", category = "plumber", title = "Tap, Faucet & Mixer Repair", hindiTitle = "नल और मिक्सर मरम्मत", startingPrice = 199, rating = 4.91, warrantyDays = 30),
            ServiceItem(id = "plumb-toilet", category = "plumber", title = "Toilet Cistern & Flush Valve Fix", hindiTitle = "टॉयलेट सिस्टर्न और फ्लश मरम्मत", startingPrice = 299, rating = 4.84, warrantyDays = 45),
            ServiceItem(id = "plumb-block", category = "plumber", title = "Drain & Kitchen Sink Unclogging", hindiTitle = "नाली और सिंक की रुकावट हटाना", startingPrice = 349, rating = 4.87, warrantyDays = 30),
            ServiceItem(id = "plumb-leak", category = "plumber", title = "Concealed Pipe Leakage Detection", hindiTitle = "दीवार में पाइप लीकेज की जांच", startingPrice = 599, rating = 4.94, warrantyDays = 90),
            ServiceItem(id = "plumb-tank", category = "plumber", title = "Overhead Water Tank & Motor Plumbing", hindiTitle = "पानी की टंकी और मोटर फिटिंग", startingPrice = 449, rating = 4.86, warrantyDays = 60),
            ServiceItem(id = "ac-jet-clean", category = "ac_repair", title = "Split / Window AC Deep Jet Service", hindiTitle = "एसी जेट वाश और केमिकल सर्विस", startingPrice = 499, rating = 4.92, warrantyDays = 30),
            ServiceItem(id = "ac-gas-charge", category = "ac_repair", title = "AC Gas Leak Check & Full Charge (R32/R410A)", hindiTitle = "एसी गैस लीकेज चेक व रीफिल", startingPrice = 1499, rating = 4.88, warrantyDays = 60),
            ServiceItem(id = "ac-pcb-repair", category = "ac_repair", title = "Inverter AC Motherboard & PCB Circuit Fix", hindiTitle = "इन्वर्टर एसी पीसीबी बोर्ड मरम्मत", startingPrice = 799, rating = 4.85, warrantyDays = 45),
            ServiceItem(id = "ac-install-shift", category = "ac_repair", title = "AC Uninstallation & Heavy Bracket Installation", hindiTitle = "एसी फिटिंग और शिफ्टिंग", startingPrice = 899, rating = 4.89, warrantyDays = 60),
            ServiceItem(id = "fridge-cooling-fix", category = "fridge_repair", title = "Refrigerator Not Cooling / Compressor Check", hindiTitle = "फ्रिज कूलिंग व कंप्रेसर जांच", startingPrice = 299, rating = 4.87, warrantyDays = 30),
            ServiceItem(id = "fridge-gas-charge", category = "fridge_repair", title = "Single/Double Door Refrigerator Gas Charging", hindiTitle = "फ्रिज गैस चार्जिंग (R134a/R600a)", startingPrice = 1199, rating = 4.91, warrantyDays = 90),
            ServiceItem(id = "fridge-defrost-timer", category = "fridge_repair", title = "Freezer Excessive Ice / Defrost Timer & Bi-metal Fix", hindiTitle = "फ्रीजर बर्फ जमना और डीफ्रॉस्ट हीटर ठीक करना", startingPrice = 449, rating = 4.83, warrantyDays = 60),
            ServiceItem(id = "fridge-inverter-board", category = "fridge_repair", title = "Inverter Refrigerator PCB Circuit Board Repair", hindiTitle = "इन्वर्टर फ्रिज पीसीबी बोर्ड रिपेयर", startingPrice = 699, rating = 4.86, warrantyDays = 45),
            ServiceItem(id = "ac-water-leak", category = "ac_repair", title = "AC water leakage repair", hindiTitle = "एसी से पानी टपकना", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "ac-fan-motor", category = "ac_repair", title = "AC fan motor and swing repair", hindiTitle = "एसी फैन मोटर और स्विंग रिपेयर", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "ac-compressor", category = "ac_repair", title = "AC compressor diagnosis and repair", hindiTitle = "एसी कंप्रेसर जांच और मरम्मत", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "ac-sensor", category = "ac_repair", title = "AC sensor and remote fault repair", hindiTitle = "एसी सेंसर और रिमोट समस्या", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "fridge-water-leak", category = "fridge_repair", title = "Fridge water leakage and drain repair", hindiTitle = "फ्रिज में पानी रिसाव", startingPrice = 249, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "fridge-fan-motor", category = "fridge_repair", title = "Fridge fan motor repair", hindiTitle = "फ्रिज फैन मोटर रिपेयर", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "fridge-thermostat", category = "fridge_repair", title = "Fridge thermostat and sensor repair", hindiTitle = "फ्रिज थर्मोस्टेट और सेंसर", startingPrice = 349, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "fridge-door-seal", category = "fridge_repair", title = "Fridge door gasket replacement", hindiTitle = "फ्रिज डोर रबर बदलना", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "washing-machine", category = "appliance_repair", title = "Washing machine repair", hindiTitle = "वॉशिंग मशीन रिपेयर", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "microwave-repair", category = "appliance_repair", title = "Microwave and oven repair", hindiTitle = "माइक्रोवेव और ओवन रिपेयर", startingPrice = 349, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "geyser-repair", category = "appliance_repair", title = "Geyser and water heater repair", hindiTitle = "गीजर और वॉटर हीटर रिपेयर", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "ro-repair", category = "appliance_repair", title = "RO water purifier service and repair", hindiTitle = "आरओ वाटर प्यूरिफायर सर्विस", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "chimney-repair", category = "appliance_repair", title = "Kitchen chimney service and repair", hindiTitle = "किचन चिमनी सर्विस", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "dishwasher-repair", category = "appliance_repair", title = "Dishwasher repair", hindiTitle = "डिशवॉशर रिपेयर", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "tv-repair", category = "appliance_repair", title = "LED / Smart TV diagnosis and repair", hindiTitle = "एलईडी और स्मार्ट टीवी रिपेयर", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "mixer-repair", category = "appliance_repair", title = "Mixer grinder and small appliance repair", hindiTitle = "मिक्सर ग्राइंडर रिपेयर", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "elec-house-wiring", category = "electrician", title = "House wiring and rewiring", hindiTitle = "घर की वायरिंग और री-वायरिंग", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "elec-inverter-repair", category = "electrician", title = "Inverter repair and battery replacement", hindiTitle = "इन्वर्टर रिपेयर और बैटरी", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "elec-meter", category = "electrician", title = "Electrical meter and main supply fault", hindiTitle = "बिजली मीटर और मेन सप्लाई समस्या", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "elec-earthing", category = "electrician", title = "Earthing and electrical safety check", hindiTitle = "अर्थिंग और बिजली सुरक्षा जांच", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "elec-water-pump", category = "electrician", title = "Water pump motor electrical repair", hindiTitle = "पानी की मोटर की इलेक्ट्रिकल मरम्मत", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "plumb-bathroom", category = "plumber", title = "Bathroom fittings installation and repair", hindiTitle = "बाथरूम फिटिंग लगाना और मरम्मत", startingPrice = 249, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "plumb-pipeline", category = "plumber", title = "New pipeline installation and repair", hindiTitle = "नई पाइपलाइन लगाना और मरम्मत", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "plumb-motor", category = "plumber", title = "Water pump installation and repair", hindiTitle = "पानी की मोटर लगाना और मरम्मत", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "plumb-tank-clean", category = "plumber", title = "Water tank cleaning", hindiTitle = "पानी की टंकी की सफाई", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "welder-gate", category = "welder", title = "Gate, grill and railing fabrication", hindiTitle = "गेट, ग्रिल और रेलिंग बनवाना", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "welder-repair", category = "welder", title = "Metal gate and shutter repair", hindiTitle = "लोहे के गेट और शटर की मरम्मत", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "welder-shed", category = "welder", title = "Shed and staircase fabrication", hindiTitle = "शेड और सीढ़ी फैब्रिकेशन", startingPrice = 999, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "mechanic-bike", category = "mechanic", title = "Two-wheeler servicing and repair", hindiTitle = "बाइक और स्कूटर सर्विसिंग", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "mechanic-car", category = "mechanic", title = "Car breakdown and repair", hindiTitle = "कार खराबी और मरम्मत", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "mechanic-puncture", category = "mechanic", title = "Tyre puncture and replacement", hindiTitle = "टायर पंचर और बदलना", startingPrice = 149, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "mechanic-battery", category = "mechanic", title = "Vehicle battery and electrical repair", hindiTitle = "वाहन बैटरी और इलेक्ट्रिकल रिपेयर", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "driver-local", category = "driver", title = "Local driver by hour", hindiTitle = "स्थानीय ड्राइवर प्रति घंटा", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "driver-full-day", category = "driver", title = "Full-day driver booking", hindiTitle = "पूरे दिन के लिए ड्राइवर", startingPrice = 999, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "driver-outstation", category = "driver", title = "Outstation driver booking", hindiTitle = "शहर से बाहर ड्राइवर", startingPrice = 1499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "guide-city", category = "tourist_guide", title = "City sightseeing guide", hindiTitle = "शहर घूमने के लिए गाइड", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "guide-language", category = "tourist_guide", title = "Language-specific private guide", hindiTitle = "भाषा के अनुसार निजी गाइड", startingPrice = 599, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "contractor-renovation", category = "contractor", title = "Home renovation and repair contract", hindiTitle = "घर का रिनोवेशन और मरम्मत", startingPrice = 999, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "contractor-civil", category = "contractor", title = "Civil construction and masonry", hindiTitle = "सिविल निर्माण और राजमिस्त्री काम", startingPrice = 999, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "contractor-waterproof", category = "contractor", title = "Roof and bathroom waterproofing", hindiTitle = "छत और बाथरूम वॉटरप्रूफिंग", startingPrice = 699, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "bike-local", category = "bike_taxi", title = "Local bike taxi ride", hindiTitle = "स्थानीय बाइक टैक्सी यात्रा", startingPrice = 49, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "bike-parcel", category = "bike_taxi", title = "Bike parcel pickup and drop", hindiTitle = "बाइक से पार्सल पिकअप और डिलीवरी", startingPrice = 49, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-dusting", category = "kaamkaaj_partner", title = "Dusting and home cleaning", hindiTitle = "डस्टिंग और घर की सफाई", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-utensils", category = "kaamkaaj_partner", title = "Utensil washing", hindiTitle = "बर्तन धोना", startingPrice = 149, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-cooking", category = "kaamkaaj_partner", title = "Daily cooking and meal preparation", hindiTitle = "रोज खाना बनाना", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-laundry", category = "kaamkaaj_partner", title = "Laundry, folding and ironing", hindiTitle = "कपड़े धोना, तह और इस्त्री", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-bathroom", category = "kaamkaaj_partner", title = "Bathroom and toilet cleaning", hindiTitle = "बाथरूम और टॉयलेट सफाई", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-kitchen", category = "kaamkaaj_partner", title = "Kitchen cleaning", hindiTitle = "किचन की सफाई", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-elder", category = "kaamkaaj_partner", title = "Non-medical daily assistance for elders", hindiTitle = "बुजुर्गों के रोजमर्रा कामों में मदद", startingPrice = 249, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "kaam-child", category = "kaamkaaj_partner", title = "Supervised child-minding assistance", hindiTitle = "बच्चों की सामान्य देखरेख में मदद", startingPrice = 249, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "carpenter-door", category = "carpenter", title = "Door, lock and hinge repair", hindiTitle = "दरवाजा, ताला और कब्जे की मरम्मत", startingPrice = 249, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "carpenter-furniture", category = "carpenter", title = "Furniture repair and assembly", hindiTitle = "फर्नीचर मरम्मत और फिटिंग", startingPrice = 299, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "carpenter-kitchen", category = "carpenter", title = "Modular kitchen and cabinet work", hindiTitle = "मॉड्यूलर किचन और कैबिनेट काम", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "painter-interior", category = "painter", title = "Interior wall painting", hindiTitle = "घर के अंदर पेंटिंग", startingPrice = 599, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "painter-exterior", category = "painter", title = "Exterior wall painting", hindiTitle = "बाहरी दीवारों की पेंटिंग", startingPrice = 699, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "painter-polish", category = "painter", title = "Wood and metal painting / polish", hindiTitle = "लकड़ी और लोहे की पेंटिंग / पॉलिश", startingPrice = 399, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "gardener-lawn", category = "gardener", title = "Lawn mowing and garden maintenance", hindiTitle = "लॉन और बगीचे की देखभाल", startingPrice = 249, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "gardener-prune", category = "gardener", title = "Plant pruning and repotting", hindiTitle = "पौधों की कटाई और गमला बदलना", startingPrice = 199, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "pest-cockroach", category = "pest_control", title = "Cockroach and general pest treatment", hindiTitle = "कॉकरोच और सामान्य कीट नियंत्रण", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "pest-termite", category = "pest_control", title = "Termite inspection and treatment", hindiTitle = "दीमक जांच और उपचार", startingPrice = 999, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "pest-mosquito", category = "pest_control", title = "Mosquito and bedbug treatment", hindiTitle = "मच्छर और खटमल नियंत्रण", startingPrice = 599, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "shift-local", category = "house_shifting", title = "Local home shifting", hindiTitle = "स्थानीय घर शिफ्टिंग", startingPrice = 999, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "shift-packing", category = "house_shifting", title = "Packing and unpacking", hindiTitle = "सामान पैकिंग और खोलना", startingPrice = 499, rating = 4.8, warrantyDays = 7),
            ServiceItem(id = "shift-office", category = "house_shifting", title = "Office and shop shifting", hindiTitle = "ऑफिस और दुकान शिफ्टिंग", startingPrice = 1499, rating = 4.8, warrantyDays = 7)
        )
    )
    val services: StateFlow<List<ServiceItem>> = _services.asStateFlow()

    suspend fun createBooking(
        serviceId: String,
        serviceTitle: String,
        category: String,
        customerAddress: String,
        scheduledDate: String,
        scheduledTimeSlot: String,
        state: String,
        district: String,
        tehsil: String,
        notes: String = "",
        quantity: Double = 1.0,
        customerLatitude: Double? = null,
        customerLongitude: Double? = null
    ): Booking {
        val firebaseUser = auth.currentUser
            ?: throw SecurityException("Please sign in with your mobile number before creating a booking.")
        require(customerAddress.isNotBlank()) { "Please enter your complete service address." }
        require(scheduledDate.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) { "Date must be in YYYY-MM-DD format." }
        require(scheduledTimeSlot.isNotBlank()) { "Please select a service time slot." }
        require(quantity.isFinite() && quantity > 0.0 && quantity <= 100000.0) { "Please enter a valid service quantity." }

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
                    .put("quantity", quantity)
                    .put("paymentMethod", "cash")
                    .put("address", customerAddress.trim())
                    .put("serviceArea", org.json.JSONObject()
                        .put("state", state.trim())
                        .put("district", district.trim())
                        .put("tehsil", tehsil.trim()))
                    .put("notes", notes.trim())
                if (customerLatitude != null && customerLongitude != null) {
                    payload.put("customerLocation", org.json.JSONObject()
                        .put("latitude", customerLatitude)
                        .put("longitude", customerLongitude))
                }
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

    private val _partnerDispatchRadiusKm = MutableStateFlow(5)
    val partnerDispatchRadiusKm: StateFlow<Int> = _partnerDispatchRadiusKm.asStateFlow()

    fun loadPartnerDispatchSettings() {
        val user = auth.currentUser ?: return
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/dispatch-settings")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "GET"
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        if (status !in 200..299) error("Partner settings load failed (HTTP $status).")
                        org.json.JSONObject(body).optInt("dispatchRadiusKm", 5)
                    } finally {
                        connection.disconnect()
                    }
                }
            }.onSuccess { radius ->
                if (radius in listOf(1, 3, 5, 10, 15)) _partnerDispatchRadiusKm.value = radius
            }
        }
    }

    fun savePartnerDispatchSettings(radiusKm: Int, latitude: Double, longitude: Double) {
        val user = auth.currentUser ?: run {
            _partnerJobsStatus.value = "पहले sign in करें."
            return
        }
        if (radiusKm !in listOf(1, 3, 5, 10, 15) ||
            !latitude.isFinite() || latitude !in -90.0..90.0 ||
            !longitude.isFinite() || longitude !in -180.0..180.0) {
            _partnerJobsStatus.value = "दूरी या GPS location सही नहीं है."
            return
        }
        viewModelScope.launch {
            try {
                val token = user.getIdToken(true).await().token
                    ?: error("Secure sign-in token unavailable.")
                val payload = org.json.JSONObject()
                    .put("dispatchRadiusKm", radiusKm)
                    .put("dispatchLocation", org.json.JSONObject()
                        .put("latitude", latitude)
                        .put("longitude", longitude))
                val message = withContext(Dispatchers.IO) {
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/dispatch-settings")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "PUT"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.doOutput = true
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.outputStream.use {
                            it.write(payload.toString().toByteArray(Charsets.UTF_8))
                        }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val result = org.json.JSONObject(body)
                        if (status !in 200..299 || !result.optBoolean("success")) {
                            error(result.optString("error").ifBlank { "Settings save failed (HTTP $status)." })
                        }
                        "आपकी $radiusKm km booking distance और GPS location सेव हो गई."
                    } finally {
                        connection.disconnect()
                    }
                }
                _partnerDispatchRadiusKm.value = radiusKm
                _partnerJobsStatus.value = message
                refreshPartnerJobs()
            } catch (error: Exception) {
                _partnerJobsStatus.value = error.localizedMessage ?: "दूरी सेटिंग सेव नहीं हुई."
            }
        }
    }

    fun refreshPartnerJobs(loadMore: Boolean = false) {
        val user = auth.currentUser
        if (user == null) {
            _partnerJobs.value = emptyList()
            _partnerJobsStatus.value = "Available jobs देखने के लिए पहले sign in करें."
            return
        }
        val cursor = if (loadMore) _partnerJobsCursor.value else null
        if (!loadMore) {
            _partnerJobs.value = emptyList()
            _partnerJobsCursor.value = null
            _partnerJobsHasMore.value = false
        }
        _partnerJobsStatus.value = if (loadMore) "और काम लोड हो रहे हैं..." else "Available jobs लोड हो रहे हैं..."
        viewModelScope.launch {
            try {
                val token = user.getIdToken(true).await().token
                    ?: throw SecurityException("Secure sign-in token unavailable.")
                val body = withContext(Dispatchers.IO) {
                    val cursorQuery = cursor?.let { "?cursor=" + java.net.URLEncoder.encode(it, "UTF-8") }.orEmpty()
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/bookings$cursorQuery")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "GET"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Accept", "application/json")
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val response = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        if (status !in 200..299) {
                            val message = runCatching { org.json.JSONObject(response).optString("error") }.getOrNull()
                            throw IllegalStateException(message?.takeIf { it.isNotBlank() } ?: "Job feed returned HTTP $status.")
                        }
                        response
                    } finally {
                        connection.disconnect()
                    }
                }
                val json = org.json.JSONObject(body)
                if (!json.optBoolean("success")) throw IllegalStateException("Server did not confirm the job feed.")
                _partnerJobsCursor.value = json.optString("nextCursor").takeIf { it.isNotBlank() && it != "null" }
                _partnerJobsHasMore.value = json.optBoolean("hasMore")
                val items = json.optJSONArray("bookings")
                val assignedItems = json.optJSONArray("assignedBookings")
                val jobs = buildList {
                    if (items != null) for (index in 0 until items.length()) {
                        val item = items.optJSONObject(index) ?: continue
                        val id = item.optString("id")
                        if (id.isBlank()) continue
                        add(PartnerJob(
                            id = id,
                            serviceTitle = item.optString("serviceTitle", "Service request"),
                            category = item.optString("category", ""),
                            customerName = item.optString("customerName", "Customer"),
                            price = item.optInt("price", 0),
                            totalAmount = item.optInt("totalAmount", 0),
                            status = "requested"
                        ))
                    }
                    if (assignedItems != null) for (index in 0 until assignedItems.length()) {
                        val item = assignedItems.optJSONObject(index) ?: continue
                        val id = item.optString("id")
                        if (id.isBlank()) continue
                        add(PartnerJob(
                            id = id,
                            serviceTitle = item.optString("serviceTitle", "Service request"),
                            category = item.optString("category", ""),
                            customerName = item.optString("customerName", "Customer"),
                            price = item.optInt("price", 0),
                            totalAmount = item.optInt("totalAmount", 0),
                            status = item.optString("status", "assigned")
                        ))
                    }
                }
                _partnerJobs.value = if (loadMore) {
                    (_partnerJobs.value + jobs).distinctBy { it.id }
                } else {
                    jobs.distinctBy { it.id }
                }
                val availableCount = _partnerJobs.value.count { it.status == "requested" }
                val assignedCount = _partnerJobs.value.size - availableCount
                _partnerJobsStatus.value = "$availableCount नए काम · $assignedCount पहले से assigned काम."
            } catch (error: Exception) {
                if (!loadMore) _partnerJobs.value = emptyList()
                _partnerJobsStatus.value = error.localizedMessage ?: "Available jobs लोड नहीं हो सके."
            }
        }
    }

    fun loadMorePartnerJobs() {
        if (_partnerJobsHasMore.value) refreshPartnerJobs(loadMore = true)
    }

    /** Accepts a requested job through the authenticated, server-side atomic claim endpoint. */
    fun acceptPartnerJob(bookingId: String, onFinished: () -> Unit = {}) {
        val user = auth.currentUser
        if (user == null) {
            _partnerJobsStatus.value = "Booking accept karne ke liye pehle sign in karein."
            onFinished()
            return
        }
        viewModelScope.launch {
            try {
                val token = user.getIdToken(true).await().token
                    ?: throw SecurityException("Secure sign-in token unavailable.")
                val responseBody = withContext(Dispatchers.IO) {
                    val encodedId = java.net.URLEncoder.encode(bookingId, "UTF-8")
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/bookings/$encodedId/accept")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.doOutput = true
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.outputStream.use { it.write("{}".toByteArray(Charsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        if (status !in 200..299) {
                            val message = runCatching { org.json.JSONObject(body).optString("error") }.getOrNull()
                            throw IllegalStateException(message?.takeIf { it.isNotBlank() }
                                ?: "Job acceptance failed (HTTP $status).")
                        }
                        body
                    } finally {
                        connection.disconnect()
                    }
                }
                val result = org.json.JSONObject(responseBody)
                if (!result.optBoolean("success") || result.optString("status") != "assigned") {
                    throw IllegalStateException("Server did not confirm job assignment.")
                }
                _partnerJobsStatus.value = "काम स्वीकार हो गया। 1 घंटे की service SLA शुरू हो गई है."
                refreshPartnerJobs()
            } catch (error: Exception) {
                _partnerJobsStatus.value = error.localizedMessage ?: "काम स्वीकार नहीं हो सका. दोबारा कोशिश करें."
                refreshPartnerJobs()
            } finally {
                onFinished()
            }
        }
    }

    fun loadCustomerStartOtp(bookingId: String) {
        val user = auth.currentUser
        if (user == null) {
            _customerStartOtpStatus.value = _customerStartOtpStatus.value + (bookingId to "पहले sign in करें.")
            return
        }
        _customerStartOtpStatus.value = _customerStartOtpStatus.value + (bookingId to "OTP लोड हो रहा है...")
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val encodedId = java.net.URLEncoder.encode(bookingId, "UTF-8")
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/customer/bookings/$encodedId/start-otp")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "GET"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) error(json.optString("error").ifBlank { "OTP अभी उपलब्ध नहीं है." })
                        json.optString("startOtp")
                    } finally { connection.disconnect() }
                }
            }.onSuccess { otp ->
                if (otp.length == 6 && otp.all { it.isDigit() }) {
                    _customerStartOtps.value = _customerStartOtps.value + (bookingId to otp)
                    _customerStartOtpStatus.value = _customerStartOtpStatus.value + (bookingId to "OTP उपलब्ध है")
                } else {
                    _customerStartOtps.value = _customerStartOtps.value - bookingId
                    _customerStartOtpStatus.value = _customerStartOtpStatus.value + (bookingId to "सर्वर से सही 6-digit OTP नहीं मिला.")
                }
            }.onFailure { error ->
                _customerStartOtps.value = _customerStartOtps.value - bookingId
                _customerStartOtpStatus.value = _customerStartOtpStatus.value + (bookingId to (error.localizedMessage ?: "OTP लोड नहीं हो सका."))
            }
        }
    }

    fun verifyStartOtp(bookingId: String, enteredOtp: String, onResult: (Boolean, String) -> Unit) {
        if (enteredOtp.length != 6 || !enteredOtp.all { it.isDigit() }) {
            onResult(false, "कृपया ग्राहक से मिला 6 अंकों का OTP दर्ज करें.")
            return
        }
        val user = auth.currentUser
        if (user == null) { onResult(false, "पहले sign in करें."); return }
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val encodedId = java.net.URLEncoder.encode(bookingId, "UTF-8")
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/bookings/$encodedId/start")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.doOutput = true
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.outputStream.use { it.write(org.json.JSONObject().put("otp", enteredOtp).toString().toByteArray(Charsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) error(json.optString("error").ifBlank { "OTP verification failed." })
                        true
                    } finally { connection.disconnect() }
                }
            }.onSuccess {
                _firestoreSyncStatus.value = "OTP verified. Service started."
                refreshPartnerJobs()
                onResult(true, "OTP सही है। काम शुरू हो गया.")
            }.onFailure { error ->
                _firestoreSyncStatus.value = error.localizedMessage ?: "OTP verification failed."
                onResult(false, error.localizedMessage ?: "OTP verification failed.")
            }
        }
    }

    fun completeJob(bookingId: String, onResult: (Boolean, String) -> Unit = { _, _ -> }) {
        val user = auth.currentUser
        if (user == null) { onResult(false, "पहले sign in करें."); return }
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val encodedId = java.net.URLEncoder.encode(bookingId, "UTF-8")
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/bookings/$encodedId/complete")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.doOutput = true
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.outputStream.use { it.write("{}".toByteArray(Charsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) error(json.optString("error").ifBlank { "Completion failed." })
                        json.optString("message", "Service completion recorded.")
                    } finally { connection.disconnect() }
                }
            }.onSuccess { message ->
                _firestoreSyncStatus.value = message
                refreshPartnerJobs()
                onResult(true, message)
            }.onFailure { error ->
                _firestoreSyncStatus.value = error.localizedMessage ?: "Completion failed."
                onResult(false, error.localizedMessage ?: "Completion failed.")
            }
        }
    }

    fun updatePartnerLiveLocation(latitude: Double, longitude: Double, accuracyMeters: Float? = null) {
        val user = auth.currentUser ?: run {
            _partnerLocationStatus.value = "Live location भेजने के लिए पहले sign in करें."
            return
        }
        if (!latitude.isFinite() || latitude !in -90.0..90.0 || !longitude.isFinite() || longitude !in -180.0..180.0 ||
            (accuracyMeters != null && (!accuracyMeters.isFinite() || accuracyMeters < 0f || accuracyMeters > 1000f))) {
            _partnerLocationStatus.value = "GPS coordinates सही नहीं हैं."
            return
        }
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val payload = org.json.JSONObject()
                        .put("shareLocation", true)
                        .put("latitude", latitude)
                        .put("longitude", longitude)
                    if (accuracyMeters != null) payload.put("accuracyMeters", accuracyMeters.toDouble())
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/location")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.doOutput = true
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) {
                            error(json.optString("error").ifBlank { "Live location update failed (HTTP $status)." })
                        }
                        json.optInt("updatedBookings", 0)
                    } finally { connection.disconnect() }
                }
            }.onSuccess { count ->
                _partnerLocationStatus.value = "Live location customer के साथ साझा है ($count active booking)."
            }.onFailure { error ->
                _partnerLocationStatus.value = error.localizedMessage ?: "Live location update नहीं हो सका."
            }
        }
    }

    fun refreshCustomerPartnerLocation(bookingId: String) {
        val user = auth.currentUser ?: return
        if (!bookingId.matches(Regex("[A-Za-z0-9_-]{1,150}"))) return
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val encodedId = java.net.URLEncoder.encode(bookingId, "UTF-8")
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/customer/bookings/$encodedId/partner-location")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "GET"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) {
                            error(json.optString("error").ifBlank { "Partner location unavailable (HTTP $status)." })
                        }
                        if (!json.optBoolean("available")) return@withContext null
                        val point = json.optJSONObject("location") ?: return@withContext null
                        PartnerLiveLocation(
                            latitude = point.getDouble("latitude"),
                            longitude = point.getDouble("longitude"),
                            accuracyMeters = if (point.has("accuracyMeters")) point.optDouble("accuracyMeters") else null,
                            updatedAt = point.optString("updatedAt"),
                            ageSeconds = json.optInt("ageSeconds", 0)
                        )
                    } finally { connection.disconnect() }
                }
            }.onSuccess { location ->
                _partnerLiveLocations.value = if (location == null) _partnerLiveLocations.value - bookingId
                    else _partnerLiveLocations.value + (bookingId to location)
            }.onFailure {
                _partnerLiveLocations.value = _partnerLiveLocations.value - bookingId
            }
        }
    }

    fun stopPartnerLiveLocation() {
        val user = auth.currentUser ?: run {
            _partnerLocationStatus.value = "पहले sign in करें."
            return
        }
        viewModelScope.launch {
            runCatching {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                withContext(Dispatchers.IO) {
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/location")
                        .openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "POST"
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        connection.doOutput = true
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.setRequestProperty("Content-Type", "application/json")
                        connection.outputStream.use { it.write(org.json.JSONObject().put("shareLocation", false).toString().toByteArray(Charsets.UTF_8)) }
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) error(json.optString("error").ifBlank { "Stop sharing failed." })
                    } finally { connection.disconnect() }
                }
            }.onSuccess {
                _partnerLocationStatus.value = "Live location sharing बंद है; saved live pins साफ कर दिए गए."
            }.onFailure { error ->
                _partnerLocationStatus.value = error.localizedMessage ?: "Location sharing बंद नहीं हो सका."
            }
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
