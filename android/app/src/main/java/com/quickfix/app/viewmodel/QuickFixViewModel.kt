package com.quickfix.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
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

    private val _commissionSettings = MutableStateFlow(
        CommissionSettings(
            electricianCommissionPct = 12,
            plumberCommissionPct = 15,
            convenienceFee = 29,
            gstPct = 18
        )
    )
    val commissionSettings: StateFlow<CommissionSettings> = _commissionSettings.asStateFlow()

    private val _customers = MutableStateFlow<List<User>>(
        listOf(
            User(
                uid = "cust-1",
                displayName = "Ananya Deshmukh",
                phoneNumber = "+91 98451 99221",
                email = "ananya.d@gmail.com",
                role = UserRole.CUSTOMER,
                address = "Flat 402, Prestige Palms, Indiranagar, Bengaluru",
                city = "Bengaluru",
                pincode = "560038"
            ),
            User(
                uid = "cust-2",
                displayName = "Vikram Aditya",
                phoneNumber = "+91 97402 18833",
                email = "vikram.aditya@outlook.com",
                role = UserRole.CUSTOMER,
                address = "#18, 5th Cross, Koramangala 4th Block, Bengaluru",
                city = "Bengaluru",
                pincode = "560034"
            ),
            User(
                uid = "cust-3",
                displayName = "Pooja Hegde",
                phoneNumber = "+91 94481 02934",
                email = "pooja.h@yahoo.com",
                role = UserRole.CUSTOMER,
                address = "Villa 12, Green Glen Layout, Bellandur, Bengaluru",
                city = "Bengaluru",
                pincode = "560103"
            ),
            User(
                uid = "cust-4",
                displayName = "Rohit Patidar",
                phoneNumber = "+91 98260 41234",
                email = "rohit.patidar@gmail.com",
                role = UserRole.CUSTOMER,
                address = "102, Shrivardhan Complex, RNT Marg, Indore",
                city = "Indore",
                pincode = "452001"
            ),
            User(
                uid = "cust-5",
                displayName = "Priya Sharma",
                phoneNumber = "+91 98270 55432",
                email = "priya.sharma@bhopal.in",
                role = UserRole.CUSTOMER,
                address = "E-3/42, Arera Colony, Near 10 No. Market, Bhopal",
                city = "Bhopal",
                pincode = "462016"
            ),
            User(
                uid = "cust-6",
                displayName = "Shivam Joshi",
                phoneNumber = "+91 94250 88219",
                email = "shivam.joshi@ujjain.in",
                role = UserRole.CUSTOMER,
                address = "45, Freeganj Main Road, Near Tower Chowk, Ujjain",
                city = "Ujjain",
                pincode = "456010"
            ),
            User(
                uid = "cust-7",
                displayName = "Ankit Verma",
                phoneNumber = "+91 99260 33100",
                email = "ankit.verma@dewas.in",
                role = UserRole.CUSTOMER,
                address = "12, Chamunda Complex, AB Road, Dewas",
                city = "Dewas",
                pincode = "455001"
            )
        )
    )
    val customers: StateFlow<List<User>> = _customers.asStateFlow()

    private val _technicians = MutableStateFlow<List<User>>(
        listOf(
            User(
                uid = "tech-1",
                displayName = "Ramesh Kumar",
                phoneNumber = "+91 98765 43210",
                role = UserRole.TECHNICIAN,
                trades = listOf("electrician"),
                experienceYears = 8,
                city = "Bengaluru",
                kycDocType = "Aadhaar Card",
                kycDocNumber = "XXXX-XXXX-4921",
                isVerified = true,
                upiId = "ramesh.kumar@okhdfcbank"
            ),
            User(
                uid = "tech-2",
                displayName = "Suresh Patel",
                phoneNumber = "+91 98765 43211",
                role = UserRole.TECHNICIAN,
                trades = listOf("plumber"),
                experienceYears = 6,
                city = "Bengaluru",
                kycDocType = "PAN Card",
                kycDocNumber = "ABCDE1234F",
                isVerified = true,
                upiId = "suresh.plumber@paytm"
            ),
            User(
                uid = "tech-3",
                displayName = "Manoj Verma",
                phoneNumber = "+91 98765 43212",
                role = UserRole.TECHNICIAN,
                trades = listOf("electrician", "plumber"),
                experienceYears = 5,
                city = "Bengaluru",
                kycDocType = "Driving Licence",
                kycDocNumber = "KA0320190012",
                isVerified = false,
                upiId = "manoj.verma@upi"
            ),
            User(
                uid = "tech-4",
                displayName = "Deepak Solanki",
                phoneNumber = "+91 98261 11223",
                role = UserRole.TECHNICIAN,
                trades = listOf("electrician"),
                experienceYears = 7,
                city = "Indore",
                kycDocType = "Skill India Certificate",
                kycDocNumber = "MP-IND-EL-2020-410",
                isVerified = true,
                upiId = "deepak.solanki@okaxis"
            ),
            User(
                uid = "tech-5",
                displayName = "Kamlesh Rathore",
                phoneNumber = "+91 98272 33445",
                role = UserRole.TECHNICIAN,
                trades = listOf("plumber"),
                experienceYears = 9,
                city = "Bhopal",
                kycDocType = "Aadhaar Card",
                kycDocNumber = "XXXX-XXXX-9102",
                isVerified = true,
                upiId = "kamlesh.rathore@paytm"
            ),
            User(
                uid = "tech-6",
                displayName = "Mohanlal Malviya",
                phoneNumber = "+91 94251 77889",
                role = UserRole.TECHNICIAN,
                trades = listOf("electrician", "plumber"),
                experienceYears = 10,
                city = "Ujjain",
                kycDocType = "Skill India Certificate",
                kycDocNumber = "MP-UJJ-EL-2019-105",
                isVerified = true,
                upiId = "mohan.ujjain@upi"
            ),
            User(
                uid = "tech-7",
                displayName = "Govind Parmar",
                phoneNumber = "+91 99262 88123",
                role = UserRole.TECHNICIAN,
                trades = listOf("plumber"),
                experienceYears = 6,
                city = "Dewas",
                kycDocType = "Aadhaar Card",
                kycDocNumber = "XXXX-XXXX-4421",
                isVerified = true,
                upiId = "govind.dewas@ybl"
            )
        )
    )
    val technicians: StateFlow<List<User>> = _technicians.asStateFlow()

    private val _bookings = MutableStateFlow<List<Booking>>(
        listOf(
            Booking(
                id = "QF-84920",
                serviceTitle = "Complete Switchboard Repair",
                category = "electrician",
                customerName = "Ananya Deshmukh",
                customerAddress = "Flat 402, Prestige Palms, Indiranagar, Bengaluru",
                status = "technician_en_route",
                technicianName = "Ramesh Kumar",
                startOtp = "",
                price = 249,
                totalAmount = 316,
                technicianPayout = 278,
                adminCommission = 38
            ),
            Booking(
                id = "QF-84921",
                serviceTitle = "Kitchen Sink Trap & Pipe Leakage",
                category = "plumber",
                customerName = "Vikram Aditya",
                customerAddress = "#18, 5th Cross, Koramangala 4th Block, Bengaluru",
                status = "assigned",
                technicianName = "Suresh Patel",
                startOtp = "",
                price = 299,
                totalAmount = 375,
                technicianPayout = 328,
                adminCommission = 47
            ),
            Booking(
                id = "QF-84918",
                serviceTitle = "Bathroom Tap Ceramic Cartridge Replacement",
                category = "plumber",
                customerName = "Pooja Hegde",
                customerAddress = "Villa 12, Green Glen Layout, Bellandur, Bengaluru",
                status = "completed",
                technicianName = "Suresh Patel",
                startOtp = "3819",
                price = 349,
                totalAmount = 434,
                technicianPayout = 380,
                adminCommission = 54
            ),
            Booking(
                id = "QF-85010",
                serviceTitle = "Ceiling Fan Heavy Wiring & Regulator",
                category = "electrician",
                customerName = "Rohit Patidar",
                customerAddress = "102, Shrivardhan Complex, RNT Marg, Indore",
                status = "technician_en_route",
                technicianName = "Deepak Solanki",
                startOtp = "5190",
                price = 249,
                totalAmount = 316,
                technicianPayout = 278,
                adminCommission = 38
            ),
            Booking(
                id = "QF-85011",
                serviceTitle = "Overhead Tank Float Valve & Pipe Leakage",
                category = "plumber",
                customerName = "Priya Sharma",
                customerAddress = "E-3/42, Arera Colony, Near 10 No. Market, Bhopal",
                status = "assigned",
                technicianName = "Kamlesh Rathore",
                startOtp = "7231",
                price = 399,
                totalAmount = 494,
                technicianPayout = 425,
                adminCommission = 69
            ),
            Booking(
                id = "QF-85012",
                serviceTitle = "Main Line MCB & Power Sockets Repair",
                category = "electrician",
                customerName = "Shivam Joshi",
                customerAddress = "45, Freeganj Main Road, Near Tower Chowk, Ujjain",
                status = "completed",
                technicianName = "Mohanlal Malviya",
                startOtp = "4482",
                price = 299,
                totalAmount = 375,
                technicianPayout = 328,
                adminCommission = 47
            ),
            Booking(
                id = "QF-85013",
                serviceTitle = "Bathroom Mixer Tap Cartridge Replacement",
                category = "plumber",
                customerName = "Ankit Verma",
                customerAddress = "12, Chamunda Complex, AB Road, Dewas",
                status = "completed",
                technicianName = "Govind Parmar",
                startOtp = "6614",
                price = 349,
                totalAmount = 434,
                technicianPayout = 380,
                adminCommission = 54
            )
        )
    )
    val bookings: StateFlow<List<Booking>> = _bookings.asStateFlow()

    private val _adminPaymentConfig = MutableStateFlow(AdminMasterPaymentConfig())
    val adminPaymentConfig: StateFlow<AdminMasterPaymentConfig> = _adminPaymentConfig.asStateFlow()

    private val _payouts = MutableStateFlow<List<PayoutRecord>>(
        listOf(
            PayoutRecord(
                id = "PAY-9041",
                technicianId = "tech-1",
                technicianName = "Ramesh Kumar",
                amount = 1450,
                status = "pending_approval",
                requestedAt = "Today, 11:20 AM",
                adminApprovalStatus = "pending",
                adminNote = "Held in QuickFix Admin Escrow awaiting HQ release",
                upiId = "ramesh.electric@okaxis"
            ),
            PayoutRecord(
                id = "PAY-9042",
                technicianId = "tech-2",
                technicianName = "Suresh Patel",
                amount = 2100,
                status = "pending_approval",
                requestedAt = "Today, 09:45 AM",
                adminApprovalStatus = "pending",
                adminNote = "Awaiting Admin HQ verification",
                upiId = "suresh.plumb@oksbi"
            ),
            PayoutRecord(
                id = "PAY-9038",
                technicianId = "tech-3",
                technicianName = "Deepak Solanki",
                amount = 1820,
                status = "settled",
                requestedAt = "Yesterday",
                adminApprovalStatus = "approved",
                adminApprovedBy = "QuickFix Admin HQ",
                adminNote = "Disbursed via Admin HDFC Master Account",
                bankUtr = "HDFC0029188412",
                upiId = "deepak.indore@apl"
            )
        )
    )
    val payouts: StateFlow<List<PayoutRecord>> = _payouts.asStateFlow()

    private val _firestoreSyncStatus = MutableStateFlow("Connected (Firestore Live)")
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
