package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
    COMMISSIONS("Commissions & Payouts"),
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

    var activeTab by remember { mutableStateOf(AdminTab.OVERVIEW) }
    var selectedTradeFilter by remember { mutableStateOf("all") }
    var selectedBookingStatus by remember { mutableStateOf("all") }

    // KPI Metrics
    val totalCustomers = customers.size
    val totalElectricians = technicians.filter { it.trades.contains("electrician") }.size
    val totalPlumbers = technicians.filter { it.trades.contains("plumber") }.size
    val totalBookings = bookings.size
    val totalRevenueGmv = bookings.sumOf { it.totalAmount }
    val totalCommissionCut = bookings.sumOf { it.adminCommission }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "QuickFix Admin HQ",
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
                                    "LIVE",
                                    color = Color(0xFF34D399),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "Operations & Marketplace Governance",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.triggerFirestoreSync() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Sync", tint = Color.White)
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
                                tab.title,
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
                    totalCommissionCut = totalCommissionCut,
                    firestoreStatus = firestoreStatus,
                    onNavigateToTab = { activeTab = it }
                )
                AdminTab.CUSTOMERS -> CustomersTab(customers = customers)
                AdminTab.TECHNICIANS -> TechniciansTab(
                    technicians = technicians,
                    selectedFilter = selectedTradeFilter,
                    onFilterChange = { selectedTradeFilter = it },
                    onApproveKyc = { viewModel.approveTechnicianKyc(it) },
                    onRejectKyc = { viewModel.rejectTechnicianKyc(it) }
                )
                AdminTab.BOOKINGS -> BookingsTab(
                    bookings = bookings,
                    selectedStatus = selectedBookingStatus,
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
                    onUpdateAdminConfig = { cfg -> viewModel.updateAdminPaymentConfig(cfg) }
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
    totalCommissionCut: Int,
    firestoreStatus: String,
    onNavigateToTab: (AdminTab) -> Unit
) {
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
                        Text("Cloud Firestore Real-Time Sync", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        Text(firestoreStatus, color = Color(0xFF93C5FD), fontSize = 11.sp)
                    }
                }
                Text("Latency: ~12ms", color = Color(0xFFBAE6FD), fontSize = 11.sp)
            }
        }

        // Metrics Grid (5 KPI Cards requested by User)
        Text("Primary Marketplace Metrics", fontWeight = FontWeight.Bold, color = TextPrimary, fontSize = 16.sp)

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            KpiCard(
                title = "Total Customers",
                value = totalCustomers.toString(),
                subtitle = "Active Verified Buyers",
                color = BrandBlue,
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.CUSTOMERS) }
            )
            KpiCard(
                title = "Total Bookings",
                value = totalBookings.toString(),
                subtitle = "Dispatched Orders",
                color = Color(0xFF8B5CF6),
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.BOOKINGS) }
            )
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            KpiCard(
                title = "Electricians",
                value = totalElectricians.toString(),
                subtitle = "Wiremen & Technicians",
                color = Color(0xFFF59E0B),
                modifier = Modifier.weight(1f),
                onClick = { onNavigateToTab(AdminTab.TECHNICIANS) }
            )
            KpiCard(
                title = "Plumbers",
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
                Text("Total Revenue (Gross Merchandise Value)", fontSize = 12.sp, color = TextSecondary)
                Spacer(modifier = Modifier.height(4.dp))
                Text("₹$totalRevenueGmv", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = DeepBlue)

                Spacer(modifier = Modifier.height(12.dp))
                Divider(color = Color(0xFFF1F5F9))
                Spacer(modifier = Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Platform Commission", fontSize = 11.sp, color = TextSecondary)
                        Text("₹$totalCommissionCut", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Technician Disbursed", fontSize = 11.sp, color = TextSecondary)
                        Text("₹${totalRevenueGmv - totalCommissionCut}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
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
fun CustomersTab(customers: List<User>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Registered Indian Customers (${customers.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
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
    onFilterChange: (String) -> Unit,
    onApproveKyc: (String) -> Unit,
    onRejectKyc: (String) -> Unit
) {
    val filtered = if (selectedFilter == "all") technicians else technicians.filter { it.trades.contains(selectedFilter) }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        // Trade filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            listOf("all" to "All Partners", "electrician" to "Electricians", "plumber" to "Plumbers").forEach { (key, label) ->
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
    onStatusChange: (String) -> Unit,
    onReassign: (String, String) -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("All Bookings & Dispatches (${bookings.size})", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
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
                    Text("Start OTP: ${booking.startOtp} • Total: ₹${booking.totalAmount}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DeepBlue)

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
    onUpdateAdminConfig: (AdminMasterPaymentConfig) -> Unit
) {
    var elecPct by remember { mutableStateOf(settings.electricianCommissionPct.toString()) }
    var plumbPct by remember { mutableStateOf(settings.plumberCommissionPct.toString()) }
    var fee by remember { mutableStateOf(settings.convenienceFee.toString()) }
    var savedMsg by remember { mutableStateOf(false) }

    var masterUpi by remember { mutableStateOf(adminConfig.masterUpiVpa) }
    var masterBank by remember { mutableStateOf(adminConfig.receivingBankName) }
    var configSavedMsg by remember { mutableStateOf(false) }

    var activeSubTab by remember { mutableStateOf("master_account") } // "master_account", "payouts", "history", "reports", "settings"
    var statusFilter by remember { mutableStateOf("all") } // "all", "paid", "pending", "failed"
    var reportMode by remember { mutableStateOf("daily") } // "daily", "monthly"

    val totalReceived = bookings.filter { it.status == "completed" || it.id == "QF-84920" }.sumOf { it.totalAmount }
    val pendingAmount = bookings.filter { it.status != "completed" && it.id != "QF-84920" }.sumOf { it.totalAmount }
    val techPayments = bookings.filter { it.status == "completed" || it.id == "QF-84920" }.sumOf { it.technicianPayout }
    val platformComm = bookings.filter { it.status == "completed" || it.id == "QF-84920" }.sumOf { it.adminCommission }
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
                title = "Platform Net Cut",
                value = "₹$platformComm",
                subtitle = "Retained in Admin A/C",
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
                    Text("Admin Master Receiving Account & Gateway", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text("Configure the central corporate bank account and payment gateway that captures all customer transactions.", fontSize = 12.sp, color = TextSecondary)

                    OutlinedTextField(
                        value = masterUpi,
                        onValueChange = { masterUpi = it },
                        label = { Text("Master UPI VPA (Customer Collections)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = masterBank,
                        onValueChange = { masterBank = it },
                        label = { Text("Receiving Bank & Account Details") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Surface(
                        color = Color(0xFFF8FAFC),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("Corporate Entity: ${adminConfig.corporateEntity}", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                            Text("Account: ${adminConfig.accountNumberMasked} • IFSC: ${adminConfig.ifscCode}", fontSize = 11.sp, color = TextSecondary)
                            Text("Gateway Escrow Route: ${adminConfig.gatewayProvider}", fontSize = 11.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                            Text("Strict Manual Admin Clearance: ACTIVE (Technicians cannot withdraw directly)", fontSize = 11.sp, color = Color(0xFF16A34A), fontWeight = FontWeight.SemiBold)
                        }
                    }

                    Button(
                        onClick = {
                            val updated = adminConfig.copy(masterUpiVpa = masterUpi, receivingBankName = masterBank)
                            onUpdateAdminConfig(updated)
                            configSavedMsg = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = DeepBlue),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save Gateway Configuration", fontWeight = FontWeight.Bold)
                    }

                    if (configSavedMsg) {
                        Text("✓ Master Account configuration updated successfully", color = Color(0xFF16A34A), fontSize = 12.sp)
                    }
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
                    Text("Technician Payouts & Escrow Approvals", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text("All payouts are held in QuickFix Admin Escrow. Funds are only transferred to technician bank accounts after your review.", fontSize = 11.sp, color = TextSecondary)

                    payouts.forEach { payout ->
                        val isPending = payout.status == "pending_approval"
                        val isHeld = payout.status == "held_in_escrow"
                        val isSettled = payout.status == "settled"

                        Surface(
                            color = Color(0xFFF8FAFC),
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(payout.id, fontWeight = FontWeight.Bold, color = BrandBlue, fontSize = 12.sp)
                                    Surface(
                                        color = when {
                                            isSettled -> Color(0xFFDCFCE7)
                                            isHeld -> Color(0xFFFEE2E2)
                                            else -> Color(0xFFFEF3C7)
                                        },
                                        shape = RoundedCornerShape(4.dp)
                                    ) {
                                        Text(
                                            when {
                                                isSettled -> "SETTLED VIA ADMIN A/C"
                                                isHeld -> "HELD IN ESCROW (AUDIT)"
                                                else -> "AWAITING ADMIN APPROVAL"
                                            },
                                            color = when {
                                                isSettled -> Color(0xFF166534)
                                                isHeld -> Color(0xFF991B1B)
                                                else -> Color(0xFF92400E)
                                            },
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 9.sp,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }

                                Text(payout.technicianName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = TextPrimary)
                                Text("Amount: ₹${payout.amount} • UPI: ${payout.upiId}", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = TextSecondary)
                                Text("Requested: ${payout.requestedAt} • Note: ${payout.adminNote ?: "Awaiting Admin Action"}", fontSize = 11.sp, color = TextSecondary)

                                if (isSettled && payout.bankUtr != null) {
                                    Text("Bank UTR: ${payout.bankUtr} (Disbursed from Admin HDFC Account)", fontSize = 11.sp, color = Color(0xFF16A34A), fontWeight = FontWeight.SemiBold)
                                }

                                if (isPending || isHeld) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Button(
                                            onClick = { onApprovePayout(payout.id) },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                            modifier = Modifier.weight(1.2f)
                                        ) {
                                            Text("Approve & Disburse (IMPS)", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        }
                                        OutlinedButton(
                                            onClick = { onHoldPayout(payout.id, "Customer complaint review") },
                                            modifier = Modifier.weight(0.8f)
                                        ) {
                                            Text(if (isHeld) "Keep On Hold" else "Hold Funds", fontSize = 10.sp)
                                        }
                                    }
                                }
                            }
                        }
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
                        val isPaid = b.status == "completed" || b.id == "QF-84920"
                        val isRefunded = b.paymentStatus == "refunded"
                        val stString = if (isPaid) "paid" else "pending"
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
                                    Text("Customer: ${b.customerName} • Escrow: Held in Admin Account", fontSize = 11.sp, color = TextSecondary)
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                        Text("Commission: ₹${b.adminCommission}", fontSize = 11.sp, color = Color(0xFF8B5CF6), fontWeight = FontWeight.SemiBold)
                                        Text("Tech Payout: ₹${b.technicianPayout}", fontSize = 11.sp, color = Color(0xFF10B981), fontWeight = FontWeight.SemiBold)
                                        Text("Total: ₹${b.totalAmount}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    }

                                    if (isPaid && !isRefunded) {
                                        OutlinedButton(
                                            onClick = { onIssueRefund(b.id, b.totalAmount, "Admin Direct Customer Satisfaction Refund") },
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text("Issue Full Refund from Admin A/C (₹${b.totalAmount})", fontSize = 10.sp, color = Color(0xFFDC2626))
                                        }
                                    } else if (isRefunded) {
                                        Text("✓ ₹${b.refundAmount} refunded directly to customer from Admin Master Account", fontSize = 10.sp, color = Color(0xFFDC2626), fontWeight = FontWeight.Medium)
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
                                Text("Admin Commission Retained: ₹$platformComm • Disbursed: ₹$techPayments", fontSize = 12.sp, color = Color(0xFF10B981), fontWeight = FontWeight.Medium)
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
                                Text("Month GMV in Admin A/C: ₹${bookings.sumOf { it.totalAmount }} • Orders: ${bookings.size}", fontSize = 12.sp, color = TextSecondary)
                                Text("Total Platform Cut Retained: ₹$platformComm (15% Margin)", fontSize = 12.sp, color = Color(0xFF8B5CF6), fontWeight = FontWeight.SemiBold)
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
                    Text("Commission Rate Architecture", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                    Text("Configurable commission cut retained by QuickFix platform on each completed booking.", fontSize = 12.sp, color = TextSecondary)

                    OutlinedTextField(
                        value = elecPct,
                        onValueChange = { elecPct = it },
                        label = { Text("Electrician Platform Cut (%)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = plumbPct,
                        onValueChange = { plumbPct = it },
                        label = { Text("Plumber Platform Cut (%)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = fee,
                        onValueChange = { fee = it },
                        label = { Text("Customer Convenience Fee (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            val e = elecPct.toIntOrNull() ?: 12
                            val p = plumbPct.toIntOrNull() ?: 15
                            val f = fee.toIntOrNull() ?: 29
                            onSave(e, p, f)
                            savedMsg = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Save to Cloud Firestore", fontWeight = FontWeight.Bold)
                    }

                    if (savedMsg) {
                        Text("✓ Rates successfully saved to Firestore /system/commission_rules", color = Color(0xFF16A34A), fontSize = 12.sp)
                    }
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
