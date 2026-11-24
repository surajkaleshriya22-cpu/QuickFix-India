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

    val defaultAddress = ""

    var address by remember { mutableStateOf(defaultAddress) }
    var state by remember { mutableStateOf("") }
    var district by remember { mutableStateOf("") }
    var tehsil by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("1") }
    val quantityValue = quantity.trim().replace(',', '.').toDoubleOrNull()
    val isValidQuantity = quantityValue != null && quantityValue.isFinite() && quantityValue > 0.0 && quantityValue <= 100000.0
    var scheduledDate by remember { mutableStateOf(java.time.LocalDate.now().toString()) }
    var scheduledTimeSlot by remember { mutableStateOf("10:00 AM - 12:00 PM") }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimeOptions by remember { mutableStateOf(false) }
    val timeOptions = listOf("सुबह 8:00 - 10:00", "सुबह 10:00 - दोपहर 12:00", "दोपहर 12:00 - 2:00", "दोपहर 2:00 - शाम 4:00", "शाम 4:00 - 6:00", "शाम 6:00 - 8:00")
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
                        "काम बुक करें",
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
                actions = { QuickFixLanguageSelector() },
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
                        Text("अंतिम कीमत", fontSize = 11.sp, color = TextSecondary)
                        Text(
                            "काम की पुष्टि के बाद",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = BrandBlue
                        )
                    }
                    Button(
                        onClick = {
                            if (!isValidBookingDate) {
                                bookingError = "कृपया आज या आगे की सही तारीख चुनें।"
                            } else if (!isValidQuantity) {
                                bookingError = "कृपया मात्रा 0 से अधिक लिखें।"
                            } else if (address.isBlank()) {
                                bookingError = "कृपया पूरा पता लिखें।"
                            } else if (state.isBlank() || district.isBlank() || tehsil.isBlank()) {
                                bookingError = "कृपया राज्य, जिला और तहसील भरें।"
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
                        // Keep the action tappable so the form can explain which required field is missing.
                        enabled = !isBooking,
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            if (isBooking) "बुकिंग भेज रहे हैं..." else "बुकिंग भेजें →",
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
                        "आपकी बुकिंग स्वीकार होने पर सत्यापित पार्टनर मिलेगा। ${service.warrantyDays} दिन की QuickFix गारंटी",
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
                    Text("1. सेवा कहाँ चाहिए? ($currentCity)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = address,
                        onValueChange = { address = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("मकान नंबर, गली, मोहल्ला और पूरा पता") }
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
                        label = { Text("राज्य") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = district,
                        onValueChange = { district = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("जिला") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = tehsil,
                        onValueChange = { tehsil = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("तहसील / तालुका") },
                        singleLine = true
                    )
                    OutlinedButton(
                        onClick = { showDatePicker = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("काम की तारीख: $scheduledDate")
                    }
                    Text(
                        if (isValidBookingDate) "आज या आगे की तारीख चुनें" else "कृपया सही तारीख चुनें",
                        color = if (isValidBookingDate) TextSecondary else Color(0xFFDC2626),
                        fontSize = 11.sp
                    )
                    Box(modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(
                            onClick = { showTimeOptions = true },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Schedule, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("समय चुनें: $scheduledTimeSlot")
                        }
                        DropdownMenu(
                            expanded = showTimeOptions,
                            onDismissRequest = { showTimeOptions = false },
                            modifier = Modifier.fillMaxWidth(0.88f)
                        ) {
                            timeOptions.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option) },
                                    onClick = {
                                        scheduledTimeSlot = option
                                        showTimeOptions = false
                                    }
                                )
                            }
                        }
                    }
                    if (showDatePicker) {
                        val todayMillis = java.time.LocalDate.now()
                            .toEpochDay() * 24L * 60L * 60L * 1000L
                        val initialMillis = runCatching {
                            java.time.LocalDate.parse(scheduledDate).toEpochDay() * 24L * 60L * 60L * 1000L
                        }.getOrDefault(todayMillis)
                        val datePickerState = rememberDatePickerState(
                            initialSelectedDateMillis = initialMillis,
                            selectableDates = object : SelectableDates {
                                override fun isSelectableDate(utcTimeMillis: Long): Boolean =
                                    utcTimeMillis >= todayMillis
                            }
                        )
                        DatePickerDialog(
                            onDismissRequest = { showDatePicker = false },
                            confirmButton = {
                                TextButton(onClick = {
                                    datePickerState.selectedDateMillis?.let { millis ->
                                        scheduledDate = java.time.Instant.ofEpochMilli(millis)
                                            .atZone(java.time.ZoneOffset.UTC).toLocalDate().toString()
                                    }
                                    showDatePicker = false
                                }) { Text("तारीख तय करें") }
                            },
                            dismissButton = {
                                TextButton(onClick = { showDatePicker = false }) { Text("रद्द करें") }
                            }
                        ) {
                            DatePicker(state = datePickerState)
                        }
                    }
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
                    Text("2. कितना काम है?", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("मात्रा (घंटे / किलो / किलोमीटर आदि)") },
                        supportingText = { Text("सिर्फ विजिट या जाँच के लिए 1 लिखें") },
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
                    Text("3. क्या समस्या है? (ज़रूरी नहीं)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("जैसे: पंखा आवाज़ कर रहा है या नल से पानी टपक रहा है") }
                    )
                }
            }

            // Payment choice is explicit; customer checkout is not enabled until its
            // verified payment-order and webhook lifecycle is implemented.
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("4. भुगतान का तरीका", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = true, onClick = {})
                        Column {
                            Text("सेवा पूरी होने के बाद नकद (Cash)", fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            Text("अभी कोई ऑनलाइन भुगतान नहीं लिया जाएगा।", fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = false, onClick = {}, enabled = false)
                        Column {
                            Text("UPI / ऑनलाइन भुगतान", color = TextSecondary)
                            Text("ग्राहक भुगतान की सुरक्षित सुविधा अभी चालू नहीं है।", fontSize = 11.sp, color = TextSecondary)
                        }
                    }
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
                                "सुरक्षित बुकिंग अनुरोध",
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
                                    "भुगतान अभी नहीं",
                                    color = Color.White,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            "पहले आपकी सेवा की बुकिंग भेजी जाएगी। अभी कोई भुगतान नहीं लिया जाएगा। भुगतान की सुविधा सत्यापित पेमेंट सेवा जुड़ने के बाद शुरू होगी।",
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
                    Text("कीमत की जानकारी", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    Text(
                        "इस स्क्रीन पर कोई अनुमानित रकम नहीं ली जाती। जहाँ तय रेट उपलब्ध होंगे, उनका उपयोग होगा। अन्यथा काम शुरू होने से पहले पार्टनर कीमत बताएगा। अभी भुगतान नहीं लिया जाएगा।",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        lineHeight = 17.sp
                    )
                }
            }
        }
    }
}
