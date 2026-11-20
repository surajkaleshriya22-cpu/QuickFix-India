package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.quickfix.app.data.model.ServiceItem
import com.quickfix.app.viewmodel.QuickFixViewModel

private val BrandBlue = Color(0xFF2563EB)
private val DeepNavy = Color(0xFF0F172A)
private val CardBg = Color(0xFFFFFFFF)
private val TextPrimary = Color(0xFF0F172A)
private val TextSecondary = Color(0xFF64748B)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerHomeScreen(
    navController: NavController,
    viewModel: QuickFixViewModel
) {
    val currentCity by viewModel.currentCity.collectAsState()
    val services by viewModel.services.collectAsState()
    val bookings by viewModel.bookings.collectAsState()
    val customerStartOtps by viewModel.customerStartOtps.collectAsState()
    val customerStartOtpStatus by viewModel.customerStartOtpStatus.collectAsState()

    var selectedCategory by remember { mutableStateOf("all") }
    var showCityMenu by remember { mutableStateOf(false) }
    var cityInput by remember(currentCity) { mutableStateOf(currentCity) }
    val filteredServices = if (selectedCategory == "all") {
        services
    } else {
        services.filter { it.category == selectedCategory }
    }

    val activeBooking = bookings.firstOrNull { it.status in listOf("assigned", "technician_en_route") }
        ?: bookings.firstOrNull { it.status == "in_progress" }
        ?: bookings.firstOrNull { it.status !in listOf("completed", "cancelled") }

    LaunchedEffect(activeBooking?.id, activeBooking?.status) {
        if (activeBooking != null && activeBooking.status in listOf("assigned", "technician_en_route")) {
            viewModel.loadCustomerStartOtp(activeBooking.id)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable { showCityMenu = !showCityMenu }
                        ) {
                            Icon(
                                Icons.Default.LocationOn,
                                contentDescription = "City",
                                tint = Color(0xFF60A5FA),
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                currentCity,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                fontSize = 15.sp
                            )
                            Icon(
                                Icons.Default.ArrowDropDown,
                                contentDescription = "Select City",
                                tint = Color(0xFF94A3B8)
                            )
                        }
                        Text(
                            "Choose your service city",
                            color = Color(0xFF94A3B8),
                            fontSize = 10.sp
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate("profile_screen") }) {
                        Icon(Icons.Default.AccountCircle, contentDescription = "Profile", tint = Color.White)
                    }
                    IconButton(onClick = { navController.navigate("admin_login") }) {
                        Icon(Icons.Default.AdminPanelSettings, contentDescription = "Admin", tint = Color(0xFF60A5FA))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DeepNavy)
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(Color(0xFFF8FAFC)),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Customers can enter any city instead of being limited to a five-city demo list.
            if (showCityMenu) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = CardBg),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                "अपना शहर लिखें / Enter your city",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = TextPrimary
                            )
                            OutlinedTextField(
                                value = cityInput,
                                onValueChange = { cityInput = it },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                label = { Text("City / शहर") },
                                supportingText = { Text("भारत के किसी भी शहर का नाम लिख सकते हैं। सेवा उपलब्धता की पुष्टि बुकिंग के समय होगी।") }
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(onClick = { cityInput = currentCity; showCityMenu = false }) {
                                    Text("Cancel")
                                }
                                Button(
                                    onClick = {
                                        val selectedCity = cityInput.trim()
                                        if (selectedCity.length in 2..60) {
                                            viewModel.setCity(selectedCity)
                                            showCityMenu = false
                                        }
                                    },
                                    enabled = cityInput.trim().length in 2..60,
                                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                                ) {
                                    Text("Save City")
                                }
                            }
                        }
                    }
                }
            }

            // Hero Banner
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = BrandBlue),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                color = Color.White.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(4.dp)
                            ) {
                                Text(
                                    "QUICKFIX SERVICES IN $currentCity",
                                    color = Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Book local service partners",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            "Availability, visit time and final price are confirmed before work starts.",
                            color = Color(0xFFDBEAFE),
                            fontSize = 11.sp
                        )
                    }
                }
            }

            // Active Booking Tracking Card (if available)
            if (activeBooking != null) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { navController.navigate("live_tracking/${activeBooking.id}") }
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF2563EB))
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        "ONGOING SERVICE • ${activeBooking.id}",
                                        color = BrandBlue,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Text(
                                    activeBooking.serviceTitle,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    "Technician: ${activeBooking.technicianName ?: "Allocating"}",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                                if (activeBooking.status in listOf("assigned", "technician_en_route")) {
                                    val customerOtp = customerStartOtps[activeBooking.id]
                                    Text(
                                        if (customerOtp != null) "Service Start OTP: $customerOtp"
                                        else customerStartOtpStatus[activeBooking.id] ?: "Service Start OTP लोड हो रहा है...",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = BrandBlue
                                    )
                                }
                            }
                            Icon(
                                Icons.Default.ChevronRight,
                                contentDescription = "Track",
                                tint = BrandBlue
                            )
                        }
                    }
                }
            }

            // All partner categories from the canonical Android service catalogue.
            item {
                val categoryOptions = listOf(
                    "all" to "सभी सेवाएँ",
                    "electrician" to "⚡ Electrician",
                    "plumber" to "🔧 Plumber",
                    "ac_repair" to "❄️ AC Repair",
                    "fridge_repair" to "🧊 Fridge",
                    "appliance_repair" to "🛠️ Appliance",
                    "welder" to "Welder",
                    "mechanic" to "Mechanic",
                    "driver" to "Driver",
                    "tourist_guide" to "Tourist Guide",
                    "contractor" to "Contractor",
                    "bike_taxi" to "🏍️ Bike Taxi",
                    "kaamkaaj_partner" to "🏠 Kaam-Kaaj",
                    "carpenter" to "Carpenter",
                    "painter" to "Painter",
                    "gardener" to "Gardener",
                    "pest_control" to "Pest Control",
                    "house_shifting" to "House Shifting"
                )
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(categoryOptions) { (id, label) ->
                        FilterChip(
                            selected = selectedCategory == id,
                            onClick = { selectedCategory = id },
                            label = { Text(label, fontSize = 12.sp) }
                        )
                    }
                }
            }

            // Services Grid / List
            items(filteredServices) { service ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { navController.navigate("service_booking/${service.id}") }
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    service.title,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = TextPrimary
                                )
                            }
                            if (service.hindiTitle != null) {
                                Text(
                                    service.hindiTitle,
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    "⭐ ${service.rating}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFFD97706)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "• ${service.warrantyDays} Days Warranty",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("Rate on confirmation", fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = TextSecondary)
                            Button(
                                onClick = { navController.navigate("service_booking/${service.id}") },
                                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Book", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
