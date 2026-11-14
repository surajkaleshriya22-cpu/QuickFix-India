package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
fun LiveTrackingScreen(
    bookingId: String,
    navController: NavController,
    viewModel: QuickFixViewModel
) {
    val bookings by viewModel.bookings.collectAsState()
    val booking = bookings.find { it.id == bookingId } ?: bookings.firstOrNull()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Live Job Tracking",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 17.sp
                        )
                        Text(
                            "Booking ID: $bookingId",
                            color = Color(0xFF94A3B8),
                            fontSize = 11.sp
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { navController.navigate("customer_home") { popUpTo("customer_home") { inclusive = true } } }) {
                        Icon(Icons.Default.Home, contentDescription = "Home", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepNavy)
            )
        }
    ) { paddingValues ->
        if (booking == null) {
            Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                Text("Booking not found.")
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .verticalScroll(rememberScrollState())
                    .background(Color(0xFFF8FAFC))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // A start OTP is shown only after a trusted backend assigns and dispatches a partner.
                if (booking.startOtp.isNotBlank()) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = DeepNavy),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                "SERVICE START OTP",
                                color = Color(0xFF94A3B8),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                booking.startOtp,
                                color = Color(0xFF60A5FA),
                                fontSize = 32.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 4.sp
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                "Share this code only after the assigned technician arrives.",
                                color = Color(0xFFCBD5E1),
                                fontSize = 11.sp,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                } else {
                    Surface(
                        color = Color(0xFFEFF6FF),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "Your request is saved. A start OTP will appear only after a verified technician accepts the job. No technician has been assigned yet.",
                            color = Color(0xFF1E40AF),
                            fontSize = 12.sp,
                            modifier = Modifier.padding(14.dp)
                        )
                    }
                }

                // Technician Dispatch Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFDBEAFE)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                (booking.technicianName ?: "T").take(1),
                                fontWeight = FontWeight.Bold,
                                color = BrandBlue,
                                fontSize = 18.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                booking.technicianName ?: "Assigning Technician...",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = TextPrimary
                            )
                            Text(
                                if (booking.technicianName != null) "Assigned QuickFix partner" else "Waiting for partner acceptance",
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                            Text(
                                if (booking.technicianName != null) "Partner details will be confirmed in the app." else "We will show partner details here after assignment.",
                                fontSize = 11.sp,
                                color = Color(0xFF16A34A)
                            )
                        }
                    }
                }

                // Status Stepper
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Text("Live Job Milestones", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)

                        val steps = listOf(
                            "Booking Request Saved" to true,
                            "Partner Assigned" to (booking.technicianName != null),
                            "Technician En Route" to (booking.status == "technician_en_route" || booking.status == "in_progress" || booking.status == "completed"),
                            "Service in Progress (OTP Verified)" to (booking.status == "in_progress" || booking.status == "completed"),
                            "Job Completed & Escrow Cleared" to (booking.status == "completed")
                        )

                        steps.forEachIndexed { index, (stepText, isDone) ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .clip(CircleShape)
                                        .background(if (isDone) Color(0xFF10B981) else Color(0xFFCBD5E1)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isDone) {
                                        Icon(
                                            Icons.Default.Check,
                                            contentDescription = "Done",
                                            tint = Color.White,
                                            modifier = Modifier.size(12.dp)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    stepText,
                                    fontSize = 12.sp,
                                    fontWeight = if (isDone) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (isDone) TextPrimary else TextSecondary
                                )
                            }
                        }
                    }
                }

                // Booking Summary Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Service Details", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Text(booking.serviceTitle, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = BrandBlue)
                        Text("Address: ${booking.customerAddress}", fontSize = 11.sp, color = TextSecondary)
                        Text(if (booking.paymentStatus == "paid") "Payment confirmed: ₹${booking.totalAmount}" else "Estimated total: ₹${booking.totalAmount} • Payment pending (no payment collected)", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = Color(0xFF16A34A))
                    }
                }

                Button(
                    onClick = { navController.navigate("customer_home") { popUpTo("customer_home") { inclusive = true } } },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Return to Home")
                }
            }
        }
    }
}
