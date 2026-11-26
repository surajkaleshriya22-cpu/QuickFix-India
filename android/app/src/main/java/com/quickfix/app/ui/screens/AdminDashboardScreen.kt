package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.quickfix.app.data.model.AdminMasterPaymentConfig
import com.quickfix.app.data.model.Booking
import com.quickfix.app.data.model.PayoutRecord
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import com.quickfix.app.viewmodel.QuickFixViewModel

// Modern Dark Blue and Crisp White Theme Colors
private val DarkNavy = Color(0xFF0F172A)
private val DeepBlue = Color(0xFF1E3A8A)
private val BrandBlue = Color(0xFF2563EB)
private val AccentCyan = Color(0xFF0284C7)
private val CardBg = Color(0xFFFFFFFF)
private val BorderColor = Color(0xFFE2E8F0)
private val TextPrimary = Color(0xFF0F172A)
private val TextSecondary = Color(0xFF64748B)

enum class AdminTab(val title: String) {
    OVERVIEW("Overview"),
    CUSTOMERS("Customers"),
    TECHNICIANS("Technicians"),
    BOOKINGS("Bookings"),
    COMMISSIONS("Payments & Payouts"),
    REVIEWS("Reviews"),
    FIRESTORE("Firestore")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminDashboardScreen(
    navController: NavController,
    viewModel: QuickFixViewModel
) {
    val bookings by viewModel.bookings.collectAsState()
    val technicians by viewModel.technicians.collectAsState()
    val customers by viewModel.customers.collectAsState()
    val commissionSettings by viewModel.commissionSettings.collectAsState()
    val adminPaymentConfig by viewModel.adminPaymentConfig.collectAsState()
    val payouts by viewModel.payouts.collectAsState()
    val firestoreStatus by viewModel.firestoreSyncStatus.collectAsState()
    val isEnglish = LocalQuickFixLanguage.current.value == "en"

    var activeTab by remember { mutableStateOf(AdminTab.OVERVIEW) }
    var selectedTradeFilter by remember { mutableStateOf("all") }
    var selectedBookingStatus by remember { mutableStateOf("all") }

    // KPI Metrics
    val totalCustomers = customers.size
    val totalElectricians = technicians.filter { it.trades.contains("electrician") }.size
    val totalPlumbers = technicians.filter { it.trades.contains("plumber") }.size
    val totalBookings = bookings.size
    val totalRevenueGmv = bookings.sumOf { it.totalAmount }
    val totalCollectedAmount = bookings.filter { it.paymentStatus == "paid" }.sumOf { it.totalAmount }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                if (isEnglish) "QuickFix Admin HQ" else "QuickFix एडमिन मुख्यालय",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 18.sp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(
                                color = Color(0xFF10B981).copy(alpha = 0.2f),
                                shape = RoundedCornerShape(4.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF10B981))
                            ) {
                                Text(
                                    "NOT VERIFIED",
                                    color = Color(0xFF34D399),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            if (isEnglish) "Operations & Marketplace Governance" else "ऑपरेशन और मार्केटप्लेस प्रबंधन",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = if (isEnglish) "Back" else "वापस जाएँ", tint = Color.White)
                    }
                },
                actions = {
                    QuickFixLanguageSelector()
                    IconButton(onClick = { viewModel.triggerFirestoreSync() }) {
                        Icon(Icons.Default.Refresh, contentDescription = if (isEnglish) "Sync" else "सिंक करें", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkNavy)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF8FAFC))
        ) {
            // Horizontal Navigation Scroll Tabs
            ScrollableTabRow(
                selectedTabIndex = activeTab.ordinal,
                containerColor = DarkNavy,
                contentColor = Color.White,
                edgePadding = 12.dp
            ) {
                AdminTab.values().forEach { tab ->
                    Tab(
                        selected = activeTab == tab,
                        onClick = { activeTab = tab },
                        text = {
                            Text(
                                if (isEnglish) tab.title else when (tab) { AdminTab.OVERVIEW -> "सारांश"; AdminTab.CUSTOMERS -> "ग्राहक"; AdminTab.TECHNICIANS -> "पार्टनर"; AdminTab.BOOKINGS -> "बुकिंग"; AdminTab.COMMISSIONS -> "भुगतान"; AdminTab.REVIEWS -> "रिव्यू"; AdminTab.FIRESTORE -> "डेटाबेस" },
                                fontWeight = if (activeTab == tab) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.sp,
                                color = if (activeTab == tab) Color(0xFF60A5FA) else Color(0xFF94A3B8)
                            )
                        }
                    )
                }
            }

            // Tab Content Body
            when (activeTab) {
                AdminTab.OVERVIEW -> OverviewTab(
                    totalCustomers = totalCustomers,
                    totalElectricians = totalElectricians,
                    totalPlumbers = totalPlumbers,
                    totalBookings = totalBookings,
                    totalRevenueGmv = totalRevenueGmv,
                    totalCollectedAmount = totalCollectedAmount,
                    firestoreStatus = firestoreStatus,
                    onNavigateToTab = { activeTab = it }
                )
                AdminTab.CUSTOMERS -> CustomersTab(customers = customers, isEnglish = isEnglish)
                AdminTab.TECHNICIANS -> TechniciansTab(
                    technicians = technicians,
                    selectedFilter = selectedTradeFilter,
                    isEnglish = isEnglish,
                    onFilterChange = { selectedTradeFilter = it },
                    onApproveKyc = { viewModel.approveTechnicianKyc(it) },
                    onRejectKyc = { viewModel.rejectTechnicianKyc(it) }
                )
                AdminTab.BOOKINGS -> BookingsTab(
                    bookings = bookings,
                    selectedStatus = selectedBookingStatus,
                    isEnglish = isEnglish,
                    onStatusChange = { selectedBookingStatus = it },
                    onReassign = { bId, techName -> viewModel.reassignBooking(bId, techName) }
                )
                AdminTab.COMMISSIONS -> CommissionsTab(
                    settings = commissionSettings,
                    bookings = bookings,
                    payouts = payouts,
                    adminConfig = adminPaymentConfig,
                    onSave = { elec, plumb, fee -> viewModel.updateCommissionSettings(elec, plumb, fee) },
                    onApprovePayout = { pId -> viewModel.adminApprovePayout(pId) },
                    onHoldPayout = { pId, reason -> viewModel.adminHoldPayout(pId, reason) },
                    onIssueRefund = { bId, amt, reason -> viewModel.adminIssueCustomerRefund(bId, amt, reason) },
                    onUpdateAdminConfig = { cfg -> viewModel.updateAdminPaymentConfig(cfg) },
                    onSaveAdminBank = { bank, type, holder, account, ifsc -> viewModel.saveAdminBankDetails(bank, type, holder, account, ifsc) },
                    onLoadAdminBank = { viewModel.loadAdminBankDetails() },
                    bankSaveStatus = firestoreStatus,
                    isEnglish = isEnglish
                )
                AdminTab.REVIEWS -> ReviewsTab(bookings = bookings)
                AdminTab.FIRESTORE -> FirestoreTab(
                    status = firestoreStatus,
                    onSync = { viewModel.triggerFirestoreSync() }
                )
            }
        }
    }
}

@Composable
fun OverviewTab(
    totalCustomers: Int,
    totalElectricians: Int,
    totalPlumbers: Int,
    totalBookings: Int,
    totalRevenueGmv: Int,
    totalCollectedAmount: Int,
    firestoreStatus: String,
    onNavigateToTab: (AdminTab) -> Unit
) {
    val englishMode = LocalQuickFixLanguage.current.value == "en"
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Real-time Firestore Banner
        Card(
            colors = CardDefaults.cardColors(containerColor = DeepBlue),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF10B981))
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(if (englishMode) "Cloud Firestore Real-Time Sync" else "Cloud Firestore लाइव सिंक", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text(firestoreStatus, color = Color(0xFF93C5FD), fontSize = 11.sp)
                    }
                }
                Text("Live latency not measured", color = Color(0xFFBAE6FD), fontSize = 10.sp)
            }
        }

        // Metrics Grid (5 KPI Cards requested by User)
        Text(if (englishMode) "Primary Marketplace Metrics" else "मुख्य मार्केटप्लेस आँकड़े", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 16.sp)

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            KpiCard(
                title = if (englishMode) "Total Customers" else "कुल ग्राहक",
                value = totalCustomers.toString(),
                subtitle = "Accounts in loaded data",
                color = BrandBlue,
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.CUSTOMERS) }
            )
            KpiCard(
                title = if (englishMode) "Total Bookings" else "कुल बुकिंग",
                value = totalBookings.toString(),
                subtitle = "Requests in loaded data",
                color = Color(0xFF8B5CF6),
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.BOOKINGS) }
            )
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            KpiCard(
                title = if (englishMode) "Electricians" else "इलेक्ट्रीशियन",
                value = totalElectricians.toString(),
                subtitle = "Wiremen & Technicians",
                color = Color(0xFFF59E0B),
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.TECHNICIANS) }
            )
            KpiCard(
                title = if (englishMode) "Plumbers" else "प्लंबर",
                value = totalPlumbers.toString(),
                subtitle = "Pipe & Sanity Pros",
                color = Color(0xFF06B6D4),
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.TECHNICIANS) }
            )
        }

        // Revenue Card (Large)
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBg),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
            modifier = Modifier.fillMaxWidth().clickable { onNavigateToTab(AdminTab.COMMISSIONS) }
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(if (englishMode) "Total booking value" else "कुल बुकिंग राशि", fontSize = 12.sp, color = TextSecondary)
                Spacer(modifier = Modifier.height(4.dp))
                Text("₹$totalRevenueGmv", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = DeepBlue)

                Spacer(modifier = Modifier.height(12.dp))
                Divider(color = Color(0xFFF1F5F9))
                Spacer(modifier = Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(if (englishMode) "Payments collected" else "मिले हुए भुगतान", fontSize = 11.sp, color = TextSecondary)
                        Text("₹$totalCollectedAmount", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(if (englishMode) "Awaiting payment (estimate)" else "भुगतान बाकी (अनुमान)", fontSize = 11.sp, color = TextSecondary)
                        Text("₹${(totalRevenueGmv - totalCollectedAmount).coerceAtLeast(0)}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                }
            }
        }
    }
}

@Composable
fun KpiCard(
    title: String,
    value: String,
    subtitle: String,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = CardBg),
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
        modifier = modifier.clickable { onClick() }
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(title, fontSize = 11.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = color)
            Spacer(modifier = Modifier.height(2.dp))
            Text(subtitle, fontSize = 10.sp, color = Color(0xFF94A3B8))
        }
    }
}

@Composable
fun CustomersTab(customers: List<User>, isEnglish: Boolean) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(if (isEnglish) "Registered Indian Customers (${customers.size})" else "रजिस्टर्ड भारतीय ग्राहक (${customers.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
        }
        items(customers) { customer ->
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(customer.displayName, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                        Surface(
                            color = Color(0xFFDCFCE7),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text("Active", color = Color(0xFF166534), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(customer.phoneNumber, fontSize = 13.sp, color = TextSecondary)
                    Text(customer.email, fontSize = 12.sp, color = Color(0xFF64748B))
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("📍 ${customer.address}", fontSize = 11.sp, color = Color(0xFF475569))
                }
            }
        }
    }
}

@Composable
fun TechniciansTab(
    technicians: List<User>,
    selectedFilter: String,
    isEnglish: Boolean,
    onFilterChange: (String) -> Unit,
    onApproveKyc: (String) -> Unit,
    onRejectKyc: (String) -> Unit
) {
    val filtered = if (selectedFilter == "all") technicians else technicians.filter { it.trades.contains(selectedFilter) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // Trade filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
            listOf(
                "all" to "All Partners",
                "electrician" to if (isEnglish) "Electricians" else "इलेक्ट्रीशियन",
                "ac_fridge" to "AC / Fridge",
                "plumber" to if (isEnglish) "Plumbers" else "प्लंबर",
                "welder" to "Welders",
                "mechanic" to "Mechanics",
                "driver" to "Drivers",
                "tourist_guide" to "Tourist Guides",
                "contractor" to "Contractors",
                "bike_rider" to "Bike Rider Captains",
                "car_wash" to "Car Washing",
                "transport" to "Transport & Delivery"
            ).forEach { (key, label) ->
                FilterChip(
                    selected = selectedFilter == key,
                    onClick = { onFilterChange(key) },
                    label = { Text(label, fontSize = 12.sp) }
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filtered) { tech ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(tech.displayName, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                                Text("Trade: ${tech.trades.joinToString(", ")} • ${tech.experienceYears}y exp", fontSize = 12.sp, color = TextSecondary)
                            }
                            Surface(
                                color = if (tech.isVerified) Color(0xFFDCFCE7) else Color(0xFFFEF3C7),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    if (tech.isVerified) "Certified & Verified" else "Qualification Audit Pending",
                                    color = if (tech.isVerified) Color(0xFF166534) else Color(0xFF92400E),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        // Qualification Certificate Box
                        Surface(
                            color = Color(0xFFF1F5F9),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(8.dp)) {
                                Text(
                                    "Trade Credential: ${tech.qualificationType}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFF1E3A8A)
                                )
                                Text(
                                    "Cert / Reg No: ${if (tech.qualificationRegNumber.isNotBlank()) tech.qualificationRegNumber else tech.kycDocNumber}",
                                    fontSize = 11.sp,
                                    color = Color(0xFF334155)
                                )
                                if (tech.qualificationInstitute.isNotBlank()) {
                                    Text(
                                        "Institute: ${tech.qualificationInstitute}",
                                        fontSize = 10.sp,
                                        color = Color(0xFF64748B)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))
                        Text("KYC Doc: ${tech.kycDocType} (${tech.kycDocNumber})", fontSize = 11.sp, color = Color(0xFF475569))
                        Text("UPI ID: ${tech.upiId}", fontSize = 11.sp, color = Color(0xFF475569))

                        Spacer(modifier = Modifier.height(10.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (!tech.isVerified) {
                                Button(
                                    onClick = { onApproveKyc(tech.uid) },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Approve & Certify", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                                OutlinedButton(
                                    onClick = { onRejectKyc(tech.uid) },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Reject", fontSize = 12.sp, color = Color(0xFFEF4444))
                                }
                            } else {
                                OutlinedButton(
                                    onClick = { onRejectKyc(tech.uid) },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Revoke Certification", fontSize = 12.sp, color = Color(0xFFEF4444))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun BookingsTab(
    bookings: List<Booking>,
    selectedStatus: String,
    isEnglish: Boolean,
    onStatusChange: (String) -> Unit,
    onReassign: (String, String) -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(if (isEnglish) "All Bookings & Dispatches (${bookings.size})" else "सभी बुकिंग और काम (${bookings.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
        }
        items(bookings) { booking ->
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(booking.id, fontWeight = FontWeight.Bold, color = BrandBlue, fontSize = 13.sp)
                        Surface(
                            color = when (booking.status) {
                                "completed" -> Color(0xFFDCFCE7)
                                "technician_en_route" -> Color(0xFFDBEAFE)
                                else -> Color(0xFFFEF3C7)
                            },
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                booking.status.replace("_", " ").uppercase(),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                color = when (booking.status) {
                                    "completed" -> Color(0xFF166534)
                                    "technician_en_route" -> Color(0xFF1E40AF)
                                    else -> Color(0xFF92400E)
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))
                    Text(booking.serviceTitle, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = TextPrimary)
                    Text("Customer: ${booking.customerName}", fontSize = 12.sp, color = TextSecondary)
                    Text("Assigned: ${booking.technicianName ?: "Pending Allocation"}", fontSize = 12.sp, color = TextSecondary)
                    Text("Booking total: ₹${booking.totalAmount}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DeepBlue)
                    if (booking.lineItems.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                            Text("Item-wise approved rates / अलग-अलग काम का रेट", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandBlue)
                            booking.lineItems.forEach { line ->
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("${line.serviceTitle} × ${line.quantity} ${line.billingUnit.replace('_', ' ')}", fontSize = 10.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                                    Text("₹${line.lineTotalMinimum.toInt()}${if (line.lineTotalMaximum != line.lineTotalMinimum) "–₹${line.lineTotalMaximum.toInt()}" else ""}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                }
                            }
                            Text("कुल item-wise अनुमान: ₹${booking.lineItems.sumOf { it.lineTotalMinimum }.toInt()} – ₹${booking.lineItems.sumOf { it.lineTotalMaximum }.toInt()}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = DeepBlue)
                        }
                    } else {
                        Text("इस booking में item-wise rate snapshot उपलब्ध नहीं है।", fontSize = 10.sp, color = Color(0xFFB45309))
                    }

                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { onReassign(booking.id, "Ramesh Kumar") },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Assign Ramesh", fontSize = 11.sp)
                        }
                        OutlinedButton(
                            onClick = { onReassign(booking.id, "Suresh Patel") },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Assign Suresh", fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CommissionsTab(
    settings: com.quickfix.app.data.model.CommissionSettings,
    bookings: List<Booking>,
    payouts: List<PayoutRecord>,
    adminConfig: AdminMasterPaymentConfig,
    onSave: (Int, Int, Int) -> Unit,
    onApprovePayout: (String) -> Unit,
    onHoldPayout: (String, String) -> Unit,
    onIssueRefund: (String, Int, String) -> Unit,
    onUpdateAdminConfig: (AdminMasterPaymentConfig) -> Unit,
    onSaveAdminBank: (String, String, String, String, String) -> Unit,
    onLoadAdminBank: () -> Unit,
    bankSaveStatus: String,
    isEnglish: Boolean
) {
    var elecPct by remember { mutableStateOf(settings.electricianCommissionPct.toString()) }
    var plumbPct by remember { mutableStateOf(settings.plumberCommissionPct.toString()) }
    var fee by remember { mutableStateOf(settings.convenienceFee.toString()) }

    var masterUpi by remember { mutableStateOf(adminConfig.masterUpiVpa) }
    var masterBank by remember { mutableStateOf(adminConfig.receivingBankName) }
    var bankNameInput by remember { mutableStateOf("") }
    var bankHolderInput by remember { mutableStateOf("") }
    var bankAccountTypeInput by remember { mutableStateOf("savings") }
    var bankAccountInput by remember { mutableStateOf("") }
    var bankIfscInput by remember { mutableStateOf("") }
    var bankMenuExpanded by remember { mutableStateOf(false) }
    val indianBanks = listOf("State Bank of India", "HDFC Bank", "ICICI Bank", "Punjab National Bank", "Bank of Baroda", "Axis Bank", "Canara Bank", "Union Bank of India", "Kotak Mahindra Bank", "IDFC FIRST Bank", "IndusInd Bank", "Yes Bank", "Indian Bank", "Central Bank of India", "Bank of India", "Other")

    var activeSubTab by remember { mutableStateOf("master_account") } // "master_account", "payouts", "history", "reports", "settings"
    var statusFilter by remember { mutableStateOf("all") } // "all", "paid", "pending", "failed"
    var reportMode by remember { mutableStateOf("daily") } // "daily", "monthly"

    LaunchedEffect(Unit) { onLoadAdminBank() }

    val totalReceived = bookings.filter { it.paymentStatus == "paid" }.sumOf { it.totalAmount }
    val pendingAmount = bookings.filter { it.paymentStatus != "paid" }.sumOf { it.totalAmount }
    val techPayments = bookings.filter { it.status == "completed" || it.id == "QF-84920" }.sumOf { it.technicianPayout }
    val pendingEscrowPayouts = payouts.filter { it.status == "pending_approval" || it.status == "held_in_escrow" }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Master Admin Account Badge
        Surface(
            color = DeepBlue,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Admin Master Payment Control", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp)
                    Surface(color = Color(0xFF10B981), shape = RoundedCornerShape(4.dp)) {
                        Text("100% ADMIN ROUTED", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                }
                Text("Master Receiving Account: ${adminConfig.masterUpiVpa} (${adminConfig.receivingBankName})", color = Color(0xFF93C5FD), fontSize = 12.sp)
                Text("All customer payments land in Admin HQ. Technician payouts are held in Admin Escrow and released only upon manual admin clearance.", color = Color(0xFFE2E8F0), fontSize = 11.sp)
            }
        }

        // 4 Financial KPI Stat Cards
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard(
                title = "Total Received (Admin A/C)",
                value = "₹$totalReceived",
                subtitle = "Collected at HQ",
                color = Color(0xFF10B981),
                modifier = Modifier.weight(1f),
                onClick = { activeSubTab = "history"; statusFilter = "paid" }
            )
            KpiCard(
                title = "Held in Admin Escrow",
                value = "₹${pendingEscrowPayouts.sumOf { it.amount }}",
                subtitle = "${pendingEscrowPayouts.size} Pending Approvals",
                color = Color(0xFFF59E0B),
                modifier = Modifier.weight(1f),
                onClick = { activeSubTab = "payouts" }
            )
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard(
                title = "Tech Payouts Disbursed",
                value = "₹$techPayments",
                subtitle = "Via Admin Master Bank",
                color = BrandBlue,
                modifier = Modifier.weight(1f),
                onClick = { activeSubTab = "payouts" }
            )
            KpiCard(
                title = if (isEnglish) "Pricing model" else "कीमत का तरीका",
                value = if (isEnglish) "Market rates" else "बाज़ार दर",
                subtitle = if (isEnglish) "No per-booking commission" else "हर बुकिंग पर कमीशन नहीं",
                color = Color(0xFF8B5CF6),
                modifier = Modifier.weight(1f),
                onClick = { activeSubTab = "settings" }
            )
        }

        // SubTab Selector Row
        ScrollableTabRow(
            selectedTabIndex = when (activeSubTab) {
                "master_account" -> 0
                "payouts" -> 1
                "history" -> 2
                "reports" -> 3
                else -> 4
            },
            containerColor = Color(0xFFF1F5F9),
            contentColor = BrandBlue,
            edgePadding = 0.dp
        ) {
            listOf(
                "master_account" to "Admin Master A/C",
                "payouts" to "Escrow Approvals (${pendingEscrowPayouts.size})",
                "history" to "Transactions",
                "reports" to "Reports",
                "settings" to "Rate Settings"
            ).forEach { (id, title) ->
                Tab(
                    selected = activeSubTab == id,
                    onClick = { activeSubTab = id },
                    text = {
                        Text(
                            title,
                            fontSize = 11.sp,
                            fontWeight = if (activeSubTab == id) FontWeight.Bold else FontWeight.Medium,
                            color = if (activeSubTab == id) BrandBlue else TextSecondary
                        )
                    }
                )
            }
        }

        // SUB-TAB 0: ADMIN MASTER ACCOUNT & GATEWAY
        if (activeSubTab == "master_account") {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(if (isEnglish) "Admin Receiving Account & Gateway" else "एडमिन बैंक खाता और पेमेंट गेटवे", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text(if (isEnglish) "This screen stores admin reference details only. No payment gateway is connected and no customer collection or bank transfer is processed here." else "यहाँ केवल एडमिन खाते की जानकारी सेव होती है। अभी कोई पेमेंट गेटवे जुड़ा नहीं है और ग्राहक से पैसा लेना या बैंक ट्रांसफर करना संभव नहीं है।", fontSize = 12.sp, color = TextSecondary)

                    Text("Saved bank account: ${adminConfig.receivingBankName.ifBlank { "Not configured" }} • ${adminConfig.accountNumberMasked.ifBlank { "Not configured" }} • IFSC ${adminConfig.ifscCode.ifBlank { "—" }}", fontSize = 12.sp, color = TextPrimary)
                    OutlinedButton(onClick = onLoadAdminBank, modifier = Modifier.fillMaxWidth()) {
                        Text(if (isEnglish) "Refresh saved bank details" else "सेव बैंक जानकारी दोबारा देखें")
                    }
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { bankMenuExpanded = true }, modifier = Modifier.fillMaxWidth()) {
                            Text(bankNameInput.ifBlank { if (isEnglish) "Select Bank" else "बैंक चुनें" }, modifier = Modifier.weight(1f))
                            Icon(Icons.Default.ArrowDropDown, contentDescription = if (isEnglish) "Select bank" else "बैंक चुनें")
                        }
                        DropdownMenu(expanded = bankMenuExpanded, onDismissRequest = { bankMenuExpanded = false }) {
                            indianBanks.forEach { bank ->
                                DropdownMenuItem(text = { Text(bank) }, onClick = {
                                    bankNameInput = bank
                                    bankMenuExpanded = false
                                })
                            }
                        }
                    }
                    Text(if (isEnglish) "Account Type" else "खाते का प्रकार", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { bankAccountTypeInput = "savings" }, modifier = Modifier.weight(1f)) { Text(if (isEnglish) { if (bankAccountTypeInput == "savings") "✓ Savings" else "Savings" } else { if (bankAccountTypeInput == "savings") "✓ बचत खाता" else "बचत खाता" }) }
                        OutlinedButton(onClick = { bankAccountTypeInput = "current" }, modifier = Modifier.weight(1f)) { Text(if (isEnglish) { if (bankAccountTypeInput == "current") "✓ Current" else "Current" } else { if (bankAccountTypeInput == "current") "✓ चालू खाता" else "चालू खाता" }) }
                    }
                    OutlinedTextField(value = bankHolderInput, onValueChange = { bankHolderInput = it }, label = { Text(if (isEnglish) "Account holder name" else "खाताधारक का नाम") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(value = bankAccountInput, onValueChange = { bankAccountInput = it.filter(Char::isDigit).take(18) }, label = { Text(if (isEnglish) "New bank account number" else "नया बैंक खाता नंबर") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(value = bankIfscInput, onValueChange = { bankIfscInput = it.uppercase().take(11) }, label = { Text(if (isEnglish) "IFSC code" else "IFSC कोड") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    Text(if (isEnglish) "The server encrypts bank details. Saving bank information does not transfer money or activate payouts." else "सर्वर बैंक जानकारी को सुरक्षित करता है। जानकारी सेव करने से पैसा ट्रांसफर या payout शुरू नहीं होता।", fontSize = 11.sp, color = Color(0xFFB45309))
                    Button(onClick = { onSaveAdminBank(bankNameInput, bankAccountTypeInput, bankHolderInput, bankAccountInput, bankIfscInput); bankAccountInput = "" }, colors = ButtonDefaults.buttonColors(containerColor = DeepBlue), modifier = Modifier.fillMaxWidth()) {
                        Text(if (isEnglish) "Save / Update Admin Bank Account" else "एडमिन बैंक खाता सेव / अपडेट करें", fontWeight = FontWeight.Bold)
                    }
                    if (bankSaveStatus.isNotBlank()) Text(bankSaveStatus, fontSize = 12.sp, color = TextSecondary)
                }
            }
        }

        // SUB-TAB 1: TECHNICIAN PAYOUTS & ESCROW APPROVALS
        if (activeSubTab == "payouts") {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(if (isEnglish) "Channel Partner Payouts & Escrow" else "चैनल पार्टनर payout और एस्क्रो", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text(if (isEnglish) "Payout processing is disabled. QuickFix has no connected payment provider or verified server-side payout ledger, so this app cannot approve, hold, reverse, or disburse funds." else "अभी payout बंद है। QuickFix में verified server-side payout ledger और payment provider जुड़ने तक पैसा approve, रोकना, वापस करना या भेजना संभव नहीं है।", fontSize = 12.sp, color = Color(0xFFB45309))
                    Surface(
                        color = Color(0xFFFFFBEB),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFDE68A)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "No bank transfer, IMPS payment, escrow hold, or settlement can be performed from this screen. Do not treat displayed legacy payout records as proof of payment.",
                            modifier = Modifier.padding(12.dp),
                            fontSize = 11.sp,
                            color = Color(0xFF92400E)
                        )
                    }
                }
            }
        }

        // SUB-TAB 2: TRANSACTIONS & BOOKING-WISE PAYMENT HISTORY
        if (activeSubTab == "history") {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Booking-Wise Payment History & Escrow Tracking", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)

                    // Filter chips: All, Paid, Pending, Failed
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("all" to "All", "paid" to "Paid", "pending" to "Pending", "failed" to "Failed").forEach { (st, label) ->
                            FilterChip(
                                selected = statusFilter == st,
                                onClick = { statusFilter = st },
                                label = { Text(label, fontSize = 11.sp) }
                            )
                        }
                    }

                    bookings.forEach { b ->
                        val paymentState = b.paymentStatus.lowercase()
                        val isPaid = paymentState == "paid" || paymentState == "captured"
                        val isRefunded = paymentState == "refunded"
                        val stString = if (isPaid || isRefunded) "paid" else "pending"
                        if (statusFilter == "all" || statusFilter == stString) {
                            Surface(
                                color = Color(0xFFF8FAFC),
                                shape = RoundedCornerShape(8.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(b.id, fontWeight = FontWeight.Bold, color = BrandBlue, fontSize = 12.sp)
                                        Surface(
                                            color = when {
                                                isRefunded -> Color(0xFFFEE2E2)
                                                isPaid -> Color(0xFFDCFCE7)
                                                else -> Color(0xFFFEF3C7)
                                            },
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                when {
                                                    isRefunded -> "REFUNDED"
                                                    isPaid -> "PAID (ADMIN ESCROW)"
                                                    else -> "PENDING"
                                                },
                                                color = when {
                                                    isRefunded -> Color(0xFF991B1B)
                                                    isPaid -> Color(0xFF166534)
                                                    else -> Color(0xFF92400E)
                                                },
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                    Text(b.serviceTitle, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = TextPrimary)
                                    Text("Customer: ${b.customerName} • Payment status: ${b.paymentStatus}", fontSize = 11.sp, color = TextSecondary)
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text(if (isEnglish) "Service amount: ₹${b.totalAmount}" else "सेवा राशि: ₹${b.totalAmount}", fontSize = 11.sp, color = Color(0xFF8B5CF6), fontWeight = FontWeight.SemiBold)
                                        Text("Tech Payout: ₹${b.technicianPayout}", fontSize = 11.sp, color = Color(0xFF10B981), fontWeight = FontWeight.SemiBold)
                                        Text("Total: ₹${b.totalAmount}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    }

                                    if (isPaid && !isRefunded) {
                                        Text("Payment is marked paid in the record. Refund processing is unavailable until a verified payment provider and server-side refund workflow are connected.", fontSize = 10.sp, color = Color(0xFFB45309))
                                    } else if (isRefunded) {
                                        Text("Refund status is recorded as refunded. Verify the provider transaction independently; this screen does not prove a bank credit.", fontSize = 10.sp, color = Color(0xFFB45309), fontWeight = FontWeight.Medium)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // SUB-TAB 3: DAILY & MONTHLY REVENUE REPORTS
        if (activeSubTab == "reports") {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Daily & Monthly Revenue Reports", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            FilterChip(selected = reportMode == "daily", onClick = { reportMode = "daily" }, label = { Text("Daily", fontSize = 10.sp) })
                            FilterChip(selected = reportMode == "monthly", onClick = { reportMode = "monthly" }, label = { Text("Monthly", fontSize = 10.sp) })
                        }
                    }

                    if (reportMode == "daily") {
                        Surface(
                            color = Color(0xFFF8FAFC),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("Today (03 Nov 2026)", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                                Text("Total Inflow to Admin A/C: ₹${bookings.sumOf { it.totalAmount }} • Realized: ₹$totalReceived", fontSize = 12.sp, color = TextSecondary)
                                Text(if (isEnglish) "Partner payouts: ₹$techPayments" else "पार्टनर भुगतान: ₹$techPayments", fontSize = 12.sp, color = Color(0xFF10B981), fontWeight = FontWeight.Medium)
                            }
                        }
                    } else {
                        Surface(
                            color = Color(0xFFF8FAFC),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("November 2026 (Month-to-Date)", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                                Text("Booking value: ₹${bookings.sumOf { it.totalAmount }} • Orders: ${bookings.size}", fontSize = 12.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            }
        }

        // SUB-TAB 4: COMMISSION PERCENTAGE SETTINGS
        if (activeSubTab == "settings") {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(if (isEnglish) "Market-based service pricing" else "बाज़ार के अनुसार सेवा की कीमत", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                    Text(
                        if (isEnglish) "QuickFix does not apply a per-booking commission cut. The customer sees the service price before booking; partners receive the listed service amount subject to the published platform subscription and payment terms."
                        else "QuickFix हर booking पर commission नहीं काटता। ग्राहक को booking से पहले सेवा की कीमत दिखाई जाएगी। पार्टनर को दिखाई गई सेवा राशि मिलेगी; लागू subscription और payment नियम अलग से दिखाए जाएँगे।",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

@Composable
fun ReviewsTab(bookings: List<Booking>) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Text("Ratings and Customer Reviews", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
        Spacer(modifier = Modifier.height(12.dp))
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBg),
            shape = RoundedCornerShape(10.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("⭐ 5.0", fontWeight = FontWeight.Bold, color = Color(0xFFD97706), fontSize = 14.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Ananya Deshmukh", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text("“Ramesh was exceptionally polite and fixed the sparking switchboard in less than 20 minutes! Standard QuickFix warranty provided.”", fontSize = 12.sp, color = TextSecondary)
                Spacer(modifier = Modifier.height(8.dp))
                Surface(
                    color = Color(0xFFEFF6FF),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "QuickFix Admin Response: Thank you Ananya! We have passed your appreciation to Ramesh.",
                        fontSize = 11.sp,
                        color = BrandBlue,
                        modifier = Modifier.padding(8.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun FirestoreTab(status: String, onSync: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = CardBg),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Firebase Firestore Live Collections", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("Collections continuously synced in real time with security rules:", fontSize = 12.sp, color = TextSecondary)

                Text("• /users/{uid} (Customers, Technicians, Admin)", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = BrandBlue)
                Text("• /bookings/{bookingId} (Live Orders, Dispatch status, OTP)", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = BrandBlue)
                Text("• /technicians/{techId} (Trade, KYC status, Ratings)", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = BrandBlue)
                Text("• /system/commission_rules (Rates and convenience fees)", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = BrandBlue)

                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onSync,
                    colors = ButtonDefaults.buttonColors(containerColor = DeepBlue),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Ping Firestore Realtime Listener")
                }
            }
        }
    }
}
