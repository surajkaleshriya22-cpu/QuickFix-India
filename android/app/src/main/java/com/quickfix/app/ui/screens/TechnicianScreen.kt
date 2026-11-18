package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.quickfix.app.viewmodel.QuickFixViewModel

private val BrandBlue = Color(0xFF2563EB)
private val DeepNavy = Color(0xFF0F172A)
private val CardBg = Color(0xFFFFFFFF)
private val TextPrimary = Color(0xFF0F172A)
private val TextSecondary = Color(0xFF64748B)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TechnicianScreen(
    navController: NavController,
    viewModel: QuickFixViewModel
) {
    val bookings by viewModel.bookings.collectAsState()
    val partnerJobs by viewModel.partnerJobs.collectAsState()
    val partnerJobsStatus by viewModel.partnerJobsStatus.collectAsState()
    val acceptingPartnerJobId by viewModel.acceptingPartnerJobId.collectAsState()
    val partnerJobActionStatus by viewModel.partnerJobActionStatus.collectAsState()
    val firestoreStatus by viewModel.firestoreSyncStatus.collectAsState()

    var enteredOtp by remember { mutableStateOf("") }
    var otpError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { viewModel.refreshPartnerJobs() }

    val myBookings = bookings

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "QuickFix Channel Partner Portal",
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 17.sp
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                color = Color(0xFF10B981),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "CHANNEL PARTNER",
                                    color = Color.White,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "Signed-in partner account",
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepNavy)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .background(Color(0xFFF8FAFC))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Trade Qualification Certificate Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Surface(
                        color = Color(0xFF2563EB),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.size(38.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Certified", tint = Color.White)
                        }
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(
                                "Trade Verification Status",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = DeepNavy
                            )
                            Surface(
                                color = Color(0xFFFEE2E2),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "NOT VERIFIED",
                                    color = Color(0xFF991B1B),
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "Your submitted trade and KYC details will appear here after registration and review.",
                            fontSize = 11.sp,
                            color = Color(0xFF1E40AF),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Wallet and payouts remain unavailable until a trusted server ledger
            // and payment provider are connected. Do not display sample balances.
            Card(
                colors = CardDefaults.cardColors(containerColor = DeepNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Partner Wallet", fontSize = 13.sp, color = Color(0xFF94A3B8))
                    Text("Wallet balance unavailable", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color.White)
                    Text(
                        "Top-ups and withdrawals will be enabled after secure server-side ledger and payment-provider integration. No demo balance or payout confirmation is shown.",
                        color = Color(0xFFCBD5E1),
                        fontSize = 11.sp
                    )
                }
            }

            // Available jobs are read from the authenticated, city/trade-matched server feed.
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Available Jobs / उपलब्ध काम", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                        TextButton(onClick = { viewModel.refreshPartnerJobs() }) { Text("Refresh") }
                    }
                    Text(partnerJobsStatus, fontSize = 11.sp, color = TextSecondary)
                    if (partnerJobActionStatus.isNotBlank()) Text(partnerJobActionStatus, fontSize = 11.sp, color = BrandBlue, fontWeight = FontWeight.SemiBold)
                    partnerJobs.filter { it.status == "requested" }.forEach { job ->
                        Divider(color = Color(0xFFE2E8F0))
                        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                            Text(job.serviceTitle, fontWeight = FontWeight.SemiBold, color = TextPrimary, fontSize = 13.sp)
                            Text("Category: ${job.category} · Customer: ${job.customerName}", fontSize = 11.sp, color = TextSecondary)
                            Text("Service price: ₹${job.price} · Total: ₹${job.totalAmount}", fontSize = 11.sp, color = TextSecondary)
                            Text("नया अनुरोध · server आपकी KYC, online स्थिति, ₹2,000 reserve और service area जाँचेगा.", fontSize = 10.sp, color = TextSecondary)
                            Button(onClick = { viewModel.acceptPartnerJob(job.id) }, enabled = acceptingPartnerJobId == null, modifier = Modifier.fillMaxWidth()) {
                                if (acceptingPartnerJobId == job.id) { CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White); Spacer(modifier = Modifier.width(8.dp)) }
                                Text(if (acceptingPartnerJobId == job.id) "काम स्वीकार हो रहा है..." else "काम स्वीकार करें / Accept Job")
                            }
                        }
                    }
                }
            }

            // The server feed returns assignedBookings separately from new requests.
            val serverAssignedJobs = partnerJobs.filter { it.status != "requested" }
            Text("Assigned Customer Bookings / आपको मिले काम", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
            if (serverAssignedJobs.isEmpty() && myBookings.isEmpty()) {
                Text("अभी कोई booking आपको assign नहीं हुई है.", fontSize = 12.sp, color = TextSecondary)
            }
            serverAssignedJobs.forEach { job ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(job.id, fontWeight = FontWeight.Bold, color = BrandBlue, fontSize = 12.sp)
                        Text(job.serviceTitle, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Text("Category: ${job.category} · Customer: ${job.customerName}", fontSize = 11.sp, color = TextSecondary)
                        Text("Status: ${job.status.replace("_", " ").uppercase()}", fontSize = 11.sp, color = TextSecondary)
                    }
                }
            }

            myBookings.forEach { booking ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(booking.id, fontWeight = FontWeight.Bold, color = BrandBlue, fontSize = 12.sp)
                            Surface(
                                color = when (booking.status) {
                                    "completed" -> Color(0xFFDCFCE7)
                                    "in_progress" -> Color(0xFFDBEAFE)
                                    else -> Color(0xFFFEF3C7)
                                },
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    booking.status.replace("_", " ").uppercase(),
                                    color = when (booking.status) {
                                        "completed" -> Color(0xFF166534)
                                        "in_progress" -> Color(0xFF1E40AF)
                                        else -> Color(0xFF92400E)
                                    },
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }

                        Text(booking.serviceTitle, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Text("Customer: ${booking.customerName}", fontSize = 12.sp, color = TextSecondary)
                        Text("Location: ${booking.customerAddress}", fontSize = 11.sp, color = TextSecondary)
                        Text("Partner payout details unavailable until server-side settlement is enabled.", fontSize = 11.sp, color = TextSecondary)

                        // OTP Verification when assigned
                        if (booking.status != "in_progress" && booking.status != "completed") {
                            Divider(color = Color(0xFFE2E8F0))
                            Text("Ask customer for 4-digit start OTP:", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextPrimary)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = enteredOtp,
                                    onValueChange = {
                                        enteredOtp = it
                                        otpError = null
                                    },
                                    modifier = Modifier.weight(1f),
                                    placeholder = { Text("Enter OTP shared by customer") },
                                    singleLine = true
                                )
                                Button(
                                    onClick = {
                                        val valid = viewModel.verifyStartOtp(booking.id, enteredOtp)
                                        if (valid) {
                                            enteredOtp = ""
                                            otpError = null
                                        } else {
                                            otpError = "Server-side OTP verification is not configured. No status was changed."
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                                ) {
                                    Text("Verify OTP")
                                }
                            }
                            if (otpError != null) {
                                Text(otpError ?: "", color = Color(0xFFDC2626), fontSize = 11.sp)
                            }
                        }

                        // Complete Job button when in progress
                        if (booking.status == "in_progress") {
                            Divider(color = Color(0xFFE2E8F0))
                            Button(
                                onClick = { viewModel.completeJob(booking.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Request completion (currently unavailable)", fontWeight = FontWeight.Bold)
                            }
                            Text(firestoreStatus, color = Color(0xFFDC2626), fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
