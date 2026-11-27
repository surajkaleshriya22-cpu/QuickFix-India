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
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
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
import com.razorpay.Checkout
import org.json.JSONObject

private val BrandBlue = Color(0xFF2563EB)
private val DeepNavy = Color(0xFF0F172A)
private val CardBg = Color(0xFFFFFFFF)
private val TextPrimary = Color(0xFF0F172A)
private val TextSecondary = Color(0xFF64748B)

private tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceBookingScreen(
    serviceId: String,
    navController: NavController,
    viewModel: QuickFixViewModel
) {
    val services by viewModel.services.collectAsState()
    val currentCity by viewModel.currentCity.collectAsState()
    val isEnglish = LocalQuickFixLanguage.current.value == "en"

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
    var customerQuote by remember { mutableStateOf<com.quickfix.app.viewmodel.CustomerBookingQuote?>(null) }
    var quoteLoading by remember { mutableStateOf(false) }
    var priceConsentAccepted by remember { mutableStateOf(false) }
    var quoteError by remember { mutableStateOf<String?>(null) }
    var paymentMethod by remember { mutableStateOf("cash") }
    var pendingBookingId by remember { mutableStateOf<String?>(null) }
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

    LaunchedEffect(serviceId, quantity, state, district, tehsil, currentCity, scheduledDate) {
        customerQuote = null
        priceConsentAccepted = false
        quoteError = null
        val amount = quantity.trim().replace(',', '.').toDoubleOrNull()
        if (amount != null && amount.isFinite() && amount > 0.0 && amount <= 100000.0 &&
            state.isNotBlank() && district.isNotBlank() && tehsil.isNotBlank() && isValidBookingDate) {
            quoteLoading = true
            try {
                customerQuote = viewModel.getCustomerBookingQuote(service.id, amount, state, district, tehsil, currentCity, scheduledDate)
            } catch (error: Exception) {
                quoteError = error.localizedMessage ?: if (isEnglish) "Local price could not be loaded." else "स्थानीय रेट नहीं मिल सका।"
            } finally {
                quoteLoading = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (isEnglish) "Book a service" else "काम बुक करें",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 17.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = if (isEnglish) "Back" else "वापस जाएँ", tint = Color.White)
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
                        Text(if (isEnglish) "Final price" else "अंतिम कीमत", fontSize = 11.sp, color = TextSecondary)
                        Text(
                            when {
                                quoteLoading -> if (isEnglish) "Checking local rate…" else "स्थानीय रेट जाँच रहे हैं…"
                                customerQuote?.quoteAvailable == true -> "₹${String.format(Locale.US, "%.0f", customerQuote!!.minimum)}–₹${String.format(Locale.US, "%.0f", customerQuote!!.maximum)}"
                                else -> if (isEnglish) "Quote required before work" else "काम से पहले कोटेशन जरूरी"
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = BrandBlue
                        )
                    }
                    Button(
                        onClick = {
                            if (!isValidBookingDate) {
                                bookingError = if (isEnglish) "Please choose today or a future date." else "कृपया आज या आगे की सही तारीख चुनें।"
                            } else if (!isValidQuantity) {
                                bookingError = if (isEnglish) "Please enter a quantity greater than 0." else "कृपया मात्रा 0 से अधिक लिखें।"
                            } else if (customerQuote == null || !priceConsentAccepted) {
                                bookingError = if (isEnglish) "Please review the price/quote and confirm before booking." else "बुकिंग से पहले रेट/कोटेशन देखकर मंजूरी दें।"
                            } else if (customerLatitude == null || customerLongitude == null) {
                                bookingError = if (isEnglish) "Please share your current GPS location so QuickFix can find an eligible nearby Channel Partner." else "नज़दीकी सही Channel Partner खोजने के लिए कृपया अपनी वर्तमान GPS लोकेशन साझा करें।"
                            } else if (address.isBlank()) {
                                bookingError = if (isEnglish) "Please enter the complete address." else "कृपया पूरा पता लिखें।"
                            } else if (state.isBlank() || district.isBlank() || tehsil.isBlank()) {
                                bookingError = if (isEnglish) "Please enter state, district and tehsil." else "कृपया राज्य, जिला और तहसील भरें।"
                            } else {
                                isBooking = true
                                bookingError = null
                                scope.launch {
                                    var waitingForPayment = false
                                    try {
                                        val bookingId = pendingBookingId ?: viewModel.createBooking(
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
                                            customerLongitude = customerLongitude,
                                            paymentMethod = paymentMethod,
                                            priceConsentAccepted = priceConsentAccepted,
                                            acceptedQuoteMinimum = customerQuote?.minimum ?: 0.0,
                                            acceptedQuoteMaximum = customerQuote?.maximum ?: 0.0
                                        ).id.also { pendingBookingId = it }
                                        if (paymentMethod == "cash") {
                                            navController.navigate("live_tracking/$bookingId") {
                                                popUpTo("customer_home")
                                            }
                                        } else {
                                            val order = createCustomerBookingPaymentOrder(bookingId)
                                            val activity = context.findActivity()
                                                ?: throw IllegalStateException("Payment screen could not be opened. Please reopen QuickFix.")
                                            val options = JSONObject().apply {
                                                put("name", "QuickFix India")
                                                put("description", "Service booking payment")
                                                put("order_id", order.orderId)
                                                put("currency", order.currency)
                                                put("amount", order.amountPaise)
                                                put("method", JSONObject().put("upi", if (paymentMethod == "upi") 1 else 0).put("card", if (paymentMethod == "card") 1 else 0).put("netbanking", if (paymentMethod == "netbanking") 1 else 0).put("wallet", 0))
                                                put("theme", JSONObject().put("color", "#2563EB"))
                                                put("prefill", JSONObject())
                                                put("notes", JSONObject().put("bookingId", bookingId))
                                            }
                                            val checkout = Checkout()
                                            checkout.setKeyID(order.keyId)
                                            CustomerBookingPaymentResult.callback = { paymentId, paidOrderId, signature, failure ->
                                                scope.launch {
                                                    try {
                                                        if (failure != null || paymentId.isNullOrBlank() || paidOrderId != order.orderId || signature.isNullOrBlank()) {
                                                            bookingError = failure ?: "Online payment response incomplete. Booking remains unpaid."
                                                        } else {
                                                            verifyCustomerBookingPayment(bookingId, paidOrderId, paymentId, signature)
                                                            navController.navigate("live_tracking/$bookingId") {
                                                                popUpTo("customer_home")
                                                            }
                                                        }
                                                    } catch (verifyError: Exception) {
                                                        bookingError = verifyError.localizedMessage
                                                            ?: "Payment verification pending. Booking remains unpaid until server confirms it."
                                                    } finally {
                                                        isBooking = false
                                                    }
                                                }
                                            }
                                            waitingForPayment = true
                                            checkout.open(activity, options)
                                            return@launch
                                        }
                                    } catch (error: Exception) {
                                        waitingForPayment = false
                                        CustomerBookingPaymentResult.callback = null
                                        bookingError = error.localizedMessage
                                            ?: "Booking could not be saved. Please sign in and try again."
                                    } finally {
                                        if (!waitingForPayment) isBooking = false
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
                            if (isBooking) "बुकिंग भेज रहे हैं..." else if (paymentMethod != "cash") { if (pendingBookingId != null) "Online भुगतान दोबारा करें →" else "बुक करें और Online भुगतान करें →" } else "बुकिंग भेजें →",
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
                    val serviceDisplayTitle: String = if (isEnglish) service.title.toString() else (service.hindiTitle ?: service.title).toString()
                    Text(text = serviceDisplayTitle, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                    if (service.hindiTitle != null) {
                        Text(text = if (isEnglish) service.hindiTitle.orEmpty() else service.title, fontSize = 12.sp, color = TextSecondary)
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
                        label = { Text(if (isEnglish) "House number, street, locality and full address" else "मकान नंबर, गली, मोहल्ला और पूरा पता") }
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
                        Text(if (isEnglish) "Use my current location" else "मेरी वर्तमान लोकेशन इस्तेमाल करें")
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
                            if (isEnglish) "The map pin shows the GPS location shared with your permission. Please check the address and pin." else "नक्शे पर पिन आपकी अनुमति से मिली GPS लोकेशन दिखाता है। पता और पिन जाँच लें।",
                            fontSize = 10.sp,
                            color = TextSecondary
                        )
                    } else {
                        Text(
                            if (isEnglish) "Your pin will appear on the map after you select GPS location." else "GPS चुनने के बाद यहाँ नक्शे पर आपका पिन दिखाई देगा।",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                    OutlinedTextField(
                        value = state,
                        onValueChange = { state = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (isEnglish) "State" else "राज्य") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = district,
                        onValueChange = { district = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (isEnglish) "District" else "जिला") },
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = tehsil,
                        onValueChange = { tehsil = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (isEnglish) "Tehsil / Taluka" else "तहसील / तालुका") },
                        singleLine = true
                    )
                    OutlinedButton(
                        onClick = { showDatePicker = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (isEnglish) "Service date: $scheduledDate" else "काम की तारीख: $scheduledDate")
                    }
                    Text(
                        if (isValidBookingDate) if (isEnglish) "Choose today or a future date" else "आज या आगे की तारीख चुनें" else if (isEnglish) "Please choose a valid date" else "कृपया सही तारीख चुनें",
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
                            Text(if (isEnglish) "Choose time: $scheduledTimeSlot" else "समय चुनें: $scheduledTimeSlot")
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
                                }) { Text(if (isEnglish) "Set date" else "तारीख तय करें") }
                            },
                            dismissButton = {
                                TextButton(onClick = { showDatePicker = false }) { Text(if (isEnglish) "Cancel" else "रद्द करें") }
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
                    Text(if (isEnglish) "2. How much work is needed?" else "2. कितना काम है?", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (isEnglish) "Quantity (hours / kg / km etc.)" else "मात्रा (घंटे / किलो / किलोमीटर आदि)") },
                        supportingText = { Text(if (isEnglish) "Enter 1 for a visit or inspection only" else "सिर्फ विजिट या जाँच के लिए 1 लिखें") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        isError = quantity.isNotBlank() && !isValidQuantity
                    )
                }
            }
            // Approved local price preview and explicit customer consent.
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (isEnglish) "4. Review local price before booking" else "4. बुकिंग से पहले स्थानीय रेट जाँचें", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    when {
                        quoteLoading -> Text(if (isEnglish) "Checking the approved rate for your area…" else "आपके क्षेत्र का मंजूर रेट जाँचा जा रहा है…", color = TextSecondary, fontSize = 12.sp)
                        quoteError != null -> Text(quoteError!!, color = Color(0xFFB45309), fontSize = 12.sp)
                        customerQuote?.quoteAvailable == true -> {
                            val q = customerQuote!!
                            Text("${q.serviceTitle} · ${q.quantity} ${q.billingUnit}", color = TextPrimary, fontWeight = FontWeight.SemiBold)
                            Text("₹${String.format(Locale.US, "%.2f", q.minimum)} – ₹${String.format(Locale.US, "%.2f", q.maximum)}", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text(if (isEnglish) { if (q.materialsIncluded) "Materials are included as stated by the approved rate card." else "Materials are not included; approve any additional material cost first." } else { if (q.materialsIncluded) "मंजूर रेट कार्ड के अनुसार सामग्री शामिल है।" else "सामग्री शामिल नहीं है; अतिरिक्त सामग्री का रेट पहले मंजूर करें।" }, color = TextSecondary, fontSize = 11.sp)
                            if (q.rateSourceName.isNotBlank()) Text("${if (isEnglish) "Rate source" else "रेट स्रोत"}: ${q.rateSourceName}", color = TextSecondary, fontSize = 10.sp)
                        }
                        customerQuote != null -> Text(if (isEnglish) "No admin-approved rate is available for this service and area. Ask the partner for an itemised quote and approve it before work begins." else "इस सेवा और क्षेत्र के लिए एडमिन-मंजूर रेट उपलब्ध नहीं है। काम शुरू होने से पहले पार्टनर से मदवार कोटेशन लेकर मंजूर करें।", color = Color(0xFFB45309), fontSize = 12.sp)
                        else -> Text(if (isEnglish) "Enter state, district, tehsil and quantity to check the approved local rate." else "मंजूर स्थानीय रेट देखने के लिए राज्य, जिला, तहसील और मात्रा भरें।", color = TextSecondary, fontSize = 12.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = priceConsentAccepted, onCheckedChange = { priceConsentAccepted = it }, enabled = customerQuote != null && !quoteLoading)
                        Text(if (isEnglish) { if (customerQuote?.quoteAvailable == true) "I have reviewed and accept the displayed price range." else "I understand that no fixed rate is available yet; I will review and approve an itemised quote before work starts." } else { if (customerQuote?.quoteAvailable == true) "मैंने ऊपर दिखाया गया रेट/अनुमान पढ़ लिया है और इसे स्वीकार करता/करती हूँ।" else "मैं समझता/समझती हूँ कि अभी निश्चित रेट उपलब्ध नहीं है; काम शुरू होने से पहले मदवार कोटेशन लेकर मंजूर करूँगा/करूँगी।" }, color = TextPrimary, fontSize = 11.sp)
                    }
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
                    Text(if (isEnglish) "3. What is the issue? (optional)" else "3. क्या समस्या है? (ज़रूरी नहीं)", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    OutlinedTextField(
                        value = notes,
                        onValueChange = { notes = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(if (isEnglish) "Example: fan is noisy or tap is leaking" else "जैसे: पंखा आवाज़ कर रहा है या नल से पानी टपक रहा है") }
                    )
                }
            }

            // Customer can choose UPI or cash. UPI is captured only against an
            // approved server-side rate card and marked paid only after verification.
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (isEnglish) "4. Payment method" else "4. भुगतान का तरीका", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(
                            selected = paymentMethod == "cash",
                            onClick = { if (pendingBookingId == null) paymentMethod = "cash" },
                            enabled = pendingBookingId == null
                        )
                        Column {
                            Text(if (isEnglish) "Cash after service completion" else "सेवा पूरी होने के बाद नकद (Cash)", fontWeight = FontWeight.SemiBold, color = TextPrimary)
                            Text(if (isEnglish) "Pay directly after the work is completed." else "काम पूरा होने के बाद सीधे भुगतान करें।", fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                    listOf(
                        "upi" to (if (isEnglish) "UPI (GPay, PhonePe, Paytm, BHIM)" else "UPI (GPay, PhonePe, Paytm, BHIM)"),
                        "card" to (if (isEnglish) "Debit / Credit Card" else "डेबिट / क्रेडिट कार्ड"),
                        "netbanking" to (if (isEnglish) "Net Banking" else "नेट बैंकिंग")
                    ).forEach { (method, title) ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(
                                selected = paymentMethod == method,
                                onClick = { if (pendingBookingId == null) paymentMethod = method },
                                enabled = pendingBookingId == null
                            )
                            Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Text(
                        if (isEnglish) "UPI, cards and Net Banking are available only when an approved local rate card confirms the booking amount. If no approved rate exists, no online payment is collected; choose cash or request an inspection quote." else "UPI, कार्ड और नेट बैंकिंग तभी उपलब्ध होंगे जब approved local rate card बुकिंग की कीमत तय करे। Rate उपलब्ध न होने पर online payment नहीं कटेगा; Cash चुनें या inspection quote लें।",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                    if (pendingBookingId != null && paymentMethod in listOf("upi", "card", "netbanking")) {
                        Text(if (isEnglish) "Booking saved. Retry online payment without creating another booking." else "बुकिंग सेव है। दोबारा online भुगतान करें—नई बुकिंग नहीं बनेगी।", fontSize = 11.sp, color = BrandBlue)
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
                        contentDescription = if (isEnglish) "Payment protection" else "भुगतान सुरक्षा",
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
                                    "भुगतान का तरीका आपके चयन के अनुसार",
                                    color = Color.White,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            if (isEnglish) "Cash is paid after service completion. If you choose UPI, card or Net Banking, QuickFix creates a server-side Razorpay order and marks the booking paid only after server verification." else "Cash चुनने पर सेवा पूरी होने के बाद भुगतान करें। UPI, कार्ड या नेट बैंकिंग चुनने पर QuickFix सर्वर Razorpay ऑर्डर बनाता है और सर्वर से पुष्टि होने के बाद ही बुकिंग को Paid करता है।",
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
                    Text(if (isEnglish) "Price details" else "कीमत की जानकारी", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
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
