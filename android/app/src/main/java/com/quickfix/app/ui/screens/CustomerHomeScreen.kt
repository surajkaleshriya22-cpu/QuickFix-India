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

    var selectedCategory by remember { mutableStateOf("all") }
    var showCityMenu by remember { mutableStateOf(false) }

    val cities = listOf("Indore", "Bhopal", "Dewas", "Ujjain", "Bengaluru")
    val filteredServices = if (selectedCategory == "all") {
        services
    } else {
        services.filter { it.category == selectedCategory }
    }

    val activeBooking = bookings.firstOrNull { it.status != "completed" }

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
                            "Madhya Pradesh & South Hubs",
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
            // City Dropdown if active
            if (showCityMenu) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = CardBg),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(8.dp)) {
                            Text(
                                "Select Service City",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                            cities.forEach { city ->
                                Text(
                                    city,
                                    color = if (city == currentCity) BrandBlue else TextPrimary,
                                    fontWeight = if (city == currentCity) FontWeight.Bold else FontWeight.Normal,
                                    fontSize = 13.sp,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            viewModel.setCity(city)
                                            showCityMenu = false
                                        }
                                        .padding(horizontal = 8.dp, vertical = 6.dp)
                                )
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
                                    "SERVICE REQUESTS IN $currentCity",
                                    color = Color.White,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Book trusted home repair services",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            "Live partner assignment and payment protection are not active yet.",
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
                                    "Technician: ${activeBooking.technicianName ?: "Allocating"} • Start OTP: ${activeBooking.startOtp}",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
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

            // Category Chips
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        "all" to "All Services",
                        "electrician" to "⚡ Electrician",
                        "plumber" to "🔧 Plumber"
                    ).forEach { (id, label) ->
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
                            Text(
                                "₹${service.startingPrice}",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 16.sp,
                                color = BrandBlue
                            )
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
