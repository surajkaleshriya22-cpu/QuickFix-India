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
import kotlinx.coroutines.launch
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
fun ServiceBookingScreen(
    serviceId: String,
    navController: NavController,
    viewModel: QuickFixViewModel
) {
    val services by viewModel.services.collectAsState()
    val currentCity by viewModel.currentCity.collectAsState()
    val commissionSettings by viewModel.commissionSettings.collectAsState()

    val service = services.find { it.id == serviceId } ?: services.first()

    val defaultAddress = ""

    var address by remember { mutableStateOf(defaultAddress) }
    var notes by remember { mutableStateOf("") }
    var isBooking by remember { mutableStateOf(false) }
    var bookingError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val basePrice = service.startingPrice
    val visitFee = commissionSettings.convenienceFee
    val discount = 20
    val taxes = (basePrice * commissionSettings.gstPct) / 100
    val totalAmount = basePrice + visitFee + taxes - discount

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Schedule Booking",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 17.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepNavy)
            )
        },
        bottomBar = {
            Surface(
                color = Color.White,
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text("Total Amount", fontSize = 11.sp, color = TextSecondary)
                        Text(
                            "₹$totalAmount",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp,
                            color = BrandBlue
                        )
                    }
                    Button(
                        onClick = {
                            if (address.isBlank()) {
                                bookingError = "Please enter your complete service address."
                            } else {
                                isBooking = true
                                bookingError = null
                                scope.launch {
                                    try {
                                        val newB = viewModel.createBooking(
                                            serviceTitle = service.title,
                                            category = service.category,
                                            customerAddress = address,
                                            price = basePrice,
                                            notes = notes
                                        )
                                        navController.navigate("live_tracking/${newB.id}") {
                                            popUpTo("customer_home")
                                        }
                                    } catch (error: Exception) {
                                        bookingError = error.localizedMessage
                                            ?: "Booking could not be saved. Please sign in and try again."
                                    } finally {
                                        isBooking = false
                                    }
                                }
                            }
                        },
                        enabled = !isBooking && address.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            if (isBooking) "Saving Request..." else "Request Service →",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
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
            bookingError?.let { message ->
                Text(
                    message,
                    color = Color(0xFFDC2626),
                    fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Selected Service Card
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(service.title, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                    if (service.hindiTitle != null) {
                        Text(service.hindiTitle, fontSize = 12.sp, color = TextSecondary)
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "Your request can be saved. Live partner assignment and service warranty workflows are not active yet.",
                        fontSize = 12.sp,
                        color = BrandBlue,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Service Address
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Service Address ($currentCity)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("House / Flat, Landmark, City") }
                    )
                }
            }

            // Issue Notes
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Describe Problem (Optional)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("e.g. Fan making clicking sound or tap leaking from base") }
                    )
                }
            }

            // QuickFix Admin Escrow Buyer Protection Badge
            Surface(
                color = Color(0xFFEFF6FF),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                    Icon(
                        Icons.Default.Security,
                        contentDescription = "Payment status",
                        tint = BrandBlue,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                "Secure Booking Request",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Surface(
                                color = BrandBlue,
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "PAYMENT PENDING",
                                    color = Color.White,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "Your service request is saved first. No payment is taken or held at this stage. Payment will be enabled after a verified payment provider is connected.",
                            fontSize = 11.sp,
                            color = Color(0xFF1E40AF),
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            // Bill Breakdown
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Price Summary", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Standard Service Fee", fontSize = 12.sp, color = TextSecondary)
                        Text("₹$basePrice", fontSize = 12.sp, color = TextPrimary)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Platform Visiting Fee", fontSize = 12.sp, color = TextSecondary)
                        Text("₹$visitFee", fontSize = 12.sp, color = TextPrimary)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Welcome Discount", fontSize = 12.sp, color = Color(0xFF16A34A))
                        Text("-₹$discount", fontSize = 12.sp, color = Color(0xFF16A34A))
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("GST (${commissionSettings.gstPct}%)", fontSize = 12.sp, color = TextSecondary)
                        Text("₹$taxes", fontSize = 12.sp, color = TextPrimary)
                    }

                    Divider(color = Color(0xFFE2E8F0))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total Payable", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Text("₹$totalAmount", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = BrandBlue)
                    }
                }
            }
        }
    }
}
