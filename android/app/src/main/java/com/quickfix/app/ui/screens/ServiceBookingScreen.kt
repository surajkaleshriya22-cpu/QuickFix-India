package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.Manifest
import android.content.pm.PackageManager
import android.location.Geocoder
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.tasks.await
import java.util.Locale
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

    val service = services.find { it.id == serviceId } ?: services.first()

    var houseFlat by remember { mutableStateOf("") }
    var locality by remember { mutableStateOf("") }
    var landmark by remember { mutableStateOf("") }
    var pincode by remember { mutableStateOf("") }
    val address = listOf(houseFlat, locality, landmark, pincode).filter { it.isNotBlank() }.joinToString(", ")
    var state by remember { mutableStateOf("") }
    var district by remember { mutableStateOf("") }
    var tehsil by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("1") }
    val quantityValue = quantity.trim().replace(',', '.').toDoubleOrNull()
    val isValidQuantity = quantityValue != null && quantityValue.isFinite() && quantityValue > 0.0 && quantityValue <= 100000.0
    var scheduledDate by remember { mutableStateOf(java.time.LocalDate.now().toString()) }
    var scheduledTimeSlot by remember { mutableStateOf("10:00 AM - 12:00 PM") }
    var isBooking by remember { mutableStateOf(false) }
    var bookingError by remember { mutableStateOf<String?>(null) }
    var locationMessage by remember { mutableStateOf<String?>(null) }
    var customerLatitude by remember { mutableStateOf<Double?>(null) }
    var customerLongitude by remember { mutableStateOf<Double?>(null) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    val requestCurrentLocation = {
        scope.launch {
            locationMessage = "लोकेशन प्राप्त हो रही है..."
            try {
                val fineGranted = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                val coarseGranted = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                if (!fineGranted && !coarseGranted) {
                    locationMessage = "लोकेशन अनुमति नहीं मिली। अनुमति दें या पता हाथ से भरें।"
                } else {
                    val locationClient = LocationServices.getFusedLocationProviderClient(context)
                    val currentLocation = locationClient.getCurrentLocation(
                        Priority.PRIORITY_HIGH_ACCURACY,
                        CancellationTokenSource().token
                    ).await() ?: throw IllegalStateException("वर्तमान लोकेशन नहीं मिली। GPS चालू करके फिर कोशिश करें।")

                    val place = withContext(Dispatchers.IO) {
                        @Suppress("DEPRECATION")
                        Geocoder(context, Locale.getDefault()).getFromLocation(
                            currentLocation.latitude, currentLocation.longitude, 1
                        )?.firstOrNull()
                    }
                    customerLatitude = currentLocation.latitude
                    customerLongitude = currentLocation.longitude
                    if (place == null) {
                        locationMessage = "GPS मिल गया, लेकिन पता नहीं मिला। कृपया पता हाथ से भरें।"
                    } else {
                        val addressParts = listOfNotNull(
                            place.subLocality, place.thoroughfare, place.featureName, place.postalCode
                        ).map { it.trim() }.filter { it.isNotBlank() }.distinct()
                        if (addressParts.isNotEmpty()) address = addressParts.joinToString(", ")
                        place.adminArea?.takeIf { it.isNotBlank() }?.let { state = it }
                        place.subAdminArea?.takeIf { it.isNotBlank() }?.let { district = it }
                        place.locality?.takeIf { it.isNotBlank() }?.let { viewModel.setCity(it) }
                        locationMessage = "पता भर दिया गया। Tehsil/Taluka सही है या नहीं, कृपया जाँचकर भरें।"
                    }
                }
            } catch (error: Exception) {
                locationMessage = error.localizedMessage ?: "लोकेशन नहीं मिल सकी। पता हाथ से भरें।"
            }
        }
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        ) {
            requestCurrentLocation()
        } else {
            locationMessage = "लोकेशन अनुमति अस्वीकार हुई। आप पता हाथ से भर सकते हैं।"
        }
    }

    val isValidBookingDate = remember(scheduledDate) {
        runCatching {
            val parsedDate = java.time.LocalDate.parse(scheduledDate)
            !parsedDate.isBefore(java.time.LocalDate.now())
        }.getOrDefault(false)
    }

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
                        Text("Final price", fontSize = 11.sp, color = TextSecondary)
                        Text(
                            "After confirmation",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = BrandBlue
                        )
                    }
                    Button(
                        onClick = {
                            if (!isValidBookingDate) {
                                bookingError = "Please choose a valid date today or later."
                            } else if (!isValidQuantity) {
                                bookingError = "Please enter a valid quantity greater than zero."
                            } else if (address.isBlank()) {
                                bookingError = "Please enter your complete service address."
                            } else if (state.isBlank() || district.isBlank() || tehsil.isBlank()) {
                                bookingError = "Please enter State, District and Tehsil."
                            } else {
                                isBooking = true
                                bookingError = null
                                scope.launch {
                                    try {
                                        val newB = viewModel.createBooking(
                                            serviceId = service.id,
                                            serviceTitle = service.title,
                                            category = service.category,
                                            customerAddress = address,
                                            scheduledDate = scheduledDate,
                                            scheduledTimeSlot = scheduledTimeSlot,
                                            state = state,
                                            district = district,
                                            tehsil = tehsil,
                                            notes = notes,
                                            quantity = quantityValue!!,
                                            customerLatitude = customerLatitude,
                                            customerLongitude = customerLongitude
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
                        enabled = !isBooking && houseFlat.isNotBlank() && locality.isNotBlank() && landmark.isNotBlank() && pincode.matches(Regex("^\\d{6}$")) && isValidBookingDate && isValidQuantity && scheduledTimeSlot.isNotBlank(),
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
                        "A verified partner will be assigned after accepting your request. ${service.warrantyDays}-Day QuickFix Guarantee",
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
                        label = { Text("House / Flat, Landmark, Full Address") }
                    )
                    OutlinedButton(
                        onClick = {
                            val fineGranted = ContextCompat.checkSelfPermission(
                                context, Manifest.permission.ACCESS_FINE_LOCATION
                            ) == PackageManager.PERMISSION_GRANTED
                            val coarseGranted = ContextCompat.checkSelfPermission(
                                context, Manifest.permission.ACCESS_COARSE_LOCATION
                            ) == PackageManager.PERMISSION_GRANTED
                            if (fineGranted || coarseGranted) {
                                requestCurrentLocation()
                            } else {
                                locationPermissionLauncher.launch(
                                    arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    )
                                )
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.MyLocation, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("मेरी वर्तमान लोकेशन इस्तेमाल करें")
                    }
                    locationMessage?.let { message ->
                        Text(message, fontSize = 11.sp, color = TextSecondary)
                    }

                    if (customerLatitude != null && customerLongitude != null) {
                        val lat = customerLatitude!!
                        val lon = customerLongitude!!
                        val south = lat - 0.008
                        val north = lat + 0.008
                        val west = lon - 0.008
                        val east = lon + 0.008
                        val mapUrl = "https://www.openstreetmap.org/export/embed.html?bbox=$west%2C$south%2C$east%2C$north&layer=mapnik&marker=$lat%2C$lon"
                        Text(
                            "चुनी हुई GPS लोकेशन · $lat, $lon",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                        AndroidView(
                            factory = { viewContext ->
                                WebView(viewContext).apply {
                                    settings.javaScriptEnabled = true
                                    settings.domStorageEnabled = false
                                    webViewClient = WebViewClient()
                                    loadUrl(mapUrl)
                                }
                            },
                            update = { webView ->
                                if (webView.url != mapUrl) webView.loadUrl(mapUrl)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                        )
                        Text(
                            "नक्शे पर पिन आपकी अनुमति से मिली GPS लोकेशन दिखाता है। पता और पिन जाँच लें।",
                            fontSize = 10.sp,
                            color = TextSecondary
                        )
                    } else {
                        Text(
                            "GPS चुनने के बाद यहाँ नक्शे पर आपका पिन दिखाई देगा।",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                    OutlinedTextField(
                        value = state,
                        onValueChange = { state = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("State") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = district,
                        onValueChange = { district = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("District") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = tehsil,
                        onValueChange = { tehsil = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Tehsil / Taluka") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = scheduledDate,
                        onValueChange = { scheduledDate = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Service date (YYYY-MM-DD)") },
                        supportingText = {
                            Text(if (isValidBookingDate) "Choose today or a future date" else "Enter a real date today or later, e.g. ${java.time.LocalDate.now()}")
                        },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = scheduledTimeSlot,
                        onValueChange = { scheduledTimeSlot = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Preferred time slot") },
                        supportingText = { Text("Example: 10:00 AM - 12:00 PM") },
                        singleLine = true
                    )
                }
            }

            // Quantity is sent to the trusted server; no client-side price is calculated.
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("काम की मात्रा / Quantity", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Quantity (points / hours / kg / km)") },
                        supportingText = { Text("विजिट या कोटेशन वाले काम के लिए 1 रखें") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        isError = quantity.isNotBlank() && !isValidQuantity
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
                        contentDescription = "Escrow",
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

            // Truthful pricing notice: server uses approved local rates only.
            Surface(
                color = Color(0xFFEFF6FF),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("कीमत की जानकारी / Price confirmation", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    Text(
                        "No estimated total is charged on this screen. QuickFix will use an approved local rate card where available; otherwise the partner must confirm a quotation before work starts. No payment is collected now.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        lineHeight = 17.sp
                    )
                }
            }
        }
    }
}
