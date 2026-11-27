package com.quickfix.app.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.messaging.FirebaseMessaging
import com.quickfix.app.notifications.QuickFixNotificationTokenRegistrar
import com.google.firebase.firestore.FirebaseFirestore
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.quickfix.app.viewmodel.QuickFixViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.tasks.await


private fun partnerCategoryHindi(category: String): String = when (category.trim().lowercase()) {
    "electrician" -> "इलेक्ट्रीशियन (बिजली मिस्त्री)"
    "plumber" -> "प्लंबर (नलसाज़)"
    "technician", "ac_repair" -> "एसी / उपकरण मैकेनिक"
    "fridge_repair" -> "फ्रिज मैकेनिक"
    "appliance_repair" -> "घरेलू उपकरण मरम्मत"
    "welder" -> "वेल्डर / फैब्रिकेटर"
    "mechanic" -> "मैकेनिक (वाहन मिस्त्री)"
    "driver" -> "ड्राइवर"
    "tourist_guide" -> "पर्यटक गाइड"
    "contractor" -> "ठेकेदार"
    "bike_taxi", "bike_rider" -> "बाइक टैक्सी कैप्टन"
    "kaamkaaj_partner" -> "कामकाज पार्टनर"
    "house_cleaning" -> "घर की सफाई"
    "cook" -> "रसोइया"
    "laundry" -> "कपड़े धोने की सेवा"
    "maid" -> "घरेलू सहायिका / सहायक"
    "carpenter" -> "बढ़ई"
    "painter" -> "पेंटर (रंगाई-पुताई)"
    "gardener" -> "माली"
    "pest_control" -> "कीट नियंत्रण सेवा"
    "house_shifting" -> "घर शिफ्टिंग सेवा"
    "car_wash" -> "कार / बाइक वॉश पार्टनर"
    "transport" -> "ट्रांसपोर्ट / सामान डिलीवरी पार्टनर"
    else -> category.replace("_", " ").replaceFirstChar { it.uppercase() }
}

private val BrandBlue = Color(0xFF2563EB)
private val DeepNavy = Color(0xFF0F172A)
private val CardBg = Color(0xFFFFFFFF)
private val TextPrimary = Color(0xFF0F172A)
private val TextSecondary = Color(0xFF64748B)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun TechnicianScreen(
    navController: NavController,
    viewModel: QuickFixViewModel,
    initialBookingId: String? = null
) {
    val bookings by viewModel.bookings.collectAsState()
    val partnerJobs by viewModel.partnerJobs.collectAsState()
    val partnerJobsStatus by viewModel.partnerJobsStatus.collectAsState()
    val partnerJobsHasMore by viewModel.partnerJobsHasMore.collectAsState()
    val firestoreStatus by viewModel.firestoreSyncStatus.collectAsState()
    val savedDispatchRadius by viewModel.partnerDispatchRadiusKm.collectAsState()
    val context = LocalContext.current
    val targetBookingRequester = remember { BringIntoViewRequester() }
    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { /* The partner can still see jobs in the in-app feed if permission is denied. */ }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        val signedInUser = FirebaseAuth.getInstance().currentUser
        if (signedInUser != null) {
            runCatching { FirebaseMessaging.getInstance().token.await() }
                .onSuccess { token -> QuickFixNotificationTokenRegistrar.register(token) }
                .onFailure { error -> android.util.Log.w("QuickFixFCM", "Could not retrieve Android notification token", error) }
        }
    }
    var sosStatus by remember { mutableStateOf("") }
    val isEnglish = LocalQuickFixLanguage.current.value == "en"
    var registeredTrades by remember { mutableStateOf<List<String>>(emptyList()) }
    var partnerQuickFixId by remember { mutableStateOf("") }
    var tradesLoadMessage by remember { mutableStateOf("आपकी सेवाएँ लोड हो रही हैं...") }
    var partnerBankName by remember { mutableStateOf("") }
    var partnerBankType by remember { mutableStateOf("savings") }
    var partnerBankHolder by remember { mutableStateOf("") }
    var partnerBankAccount by remember { mutableStateOf("") }
    var partnerBankIfsc by remember { mutableStateOf("") }
    var partnerBankSummary by remember { mutableStateOf("") }
    var partnerBankStatus by remember { mutableStateOf("बैंक विवरण लोड हो रहे हैं...") }
    var partnerBankSaving by remember { mutableStateOf(false) }
    val bankScope = rememberCoroutineScope()
    var selectedDispatchRadius by remember(savedDispatchRadius) { mutableIntStateOf(savedDispatchRadius) }
    var locationSaveMessage by remember { mutableStateOf("") }
    var isLiveLocationSharing by remember { mutableStateOf(false) }
    var requestingLiveShare by remember { mutableStateOf(false) }
    val liveLocationStatus by viewModel.partnerLocationStatus.collectAsState()
    val hasActiveAssignedJob = partnerJobs.any { it.status in listOf("assigned", "technician_en_route", "in_progress") }

    fun captureAndSendLiveLocation() {
        try {
            LocationServices.getFusedLocationProviderClient(context)
                .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token)
                .addOnSuccessListener { location ->
                    if (location != null) viewModel.updatePartnerLiveLocation(location.latitude, location.longitude, location.accuracy)
                    else locationSaveMessage = "GPS location नहीं मिली. फोन की Location चालू रखें."
                }
                .addOnFailureListener { locationSaveMessage = "GPS update नहीं हो सका." }
        } catch (_: SecurityException) {
            isLiveLocationSharing = false
            locationSaveMessage = "Location permission हट गई है. दोबारा अनुमति दें."
        }
    }

    var acceptingJobId by remember { mutableStateOf<String?>(null) }
    var enteredOtps by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var otpErrors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            if (requestingLiveShare) {
                requestingLiveShare = false
                isLiveLocationSharing = true
                locationSaveMessage = "Live location sharing शुरू हो रही है."
                captureAndSendLiveLocation()
            } else {
                try {
                    LocationServices.getFusedLocationProviderClient(context)
                        .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token)
                        .addOnSuccessListener { location ->
                            if (location != null) {
                                viewModel.savePartnerDispatchSettings(selectedDispatchRadius, location.latitude, location.longitude)
                                locationSaveMessage = "GPS मिली; आपकी दूरी सेव हो रही है."
                            } else locationSaveMessage = "GPS location नहीं मिली. फोन की Location चालू करके फिर कोशिश करें."
                        }
                        .addOnFailureListener { locationSaveMessage = "GPS location नहीं मिल सकी." }
                } catch (_: SecurityException) {
                    locationSaveMessage = "Location permission नहीं मिली."
                }
            }
        } else {
            requestingLiveShare = false
            locationSaveMessage = "Location permission नहीं मिली."
        }
    }

    // Keep the authenticated server-filtered available-job feed fresh only while this screen is visible.
    LaunchedEffect(viewModel) {
        while (true) {
            viewModel.refreshPartnerJobs()
            kotlinx.coroutines.delay(15_000L)
        }
    }

    LaunchedEffect(Unit) {
        viewModel.loadPartnerDispatchSettings()
        val uid = FirebaseAuth.getInstance().currentUser?.uid
        if (uid == null) {
            tradesLoadMessage = "Partner खाते में लॉगिन करें।"
        } else {
            FirebaseFirestore.getInstance().collection("users").document(uid).get()
                .addOnSuccessListener { profile ->
                    registeredTrades = (profile.get("trades") as? List<*>)?.filterIsInstance<String>().orEmpty()
                    partnerQuickFixId = profile.getString("partnerQuickFixId")
                        ?.takeIf { it.isNotBlank() }
                        ?: profile.getString("quickFixId").orEmpty()
                    tradesLoadMessage = if (registeredTrades.isEmpty()) "आपकी सेवाएँ अभी प्रोफ़ाइल में दर्ज नहीं हैं।" else ""
                }
                .addOnFailureListener { tradesLoadMessage = "सेवाएँ लोड नहीं हो सकीं। इंटरनेट जाँचें।" }
        }
    }

    LaunchedEffect(Unit) {
        val user = FirebaseAuth.getInstance().currentUser
        if (user == null) {
            partnerBankStatus = "बैंक विवरण देखने के लिए Channel Partner में लॉगिन करें।"
        } else {
            try {
                val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                val result = withContext(Dispatchers.IO) {
                    val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/bank-account").openConnection() as java.net.HttpURLConnection
                    try {
                        connection.requestMethod = "GET"
                        connection.setRequestProperty("Authorization", "Bearer $token")
                        connection.connectTimeout = 15000
                        connection.readTimeout = 20000
                        val status = connection.responseCode
                        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                        val json = org.json.JSONObject(body)
                        if (status !in 200..299 || !json.optBoolean("success")) error(json.optString("error").ifBlank { "Bank details could not be loaded (HTTP $status)." })
                        json
                    } finally { connection.disconnect() }
                }
                if (result.optBoolean("configured")) {
                    partnerBankName = result.optString("bankName")
                    partnerBankType = result.optString("accountType", "savings")
                    partnerBankHolder = result.optString("accountHolderName")
                    partnerBankIfsc = result.optString("ifsc")
                    partnerBankSummary = "${result.optString("bankName")} • ${if (result.optString("accountType") == "current") "Current" else "Savings"} •••• ${result.optString("accountLast4")} • IFSC ${result.optString("ifsc")}"
                    partnerBankStatus = "आपका सेव किया हुआ बैंक अकाउंट लोड हो गया।"
                } else {
                    partnerBankStatus = "अभी कोई बैंक अकाउंट सेव नहीं है।"
                }
            } catch (error: Exception) {
                partnerBankStatus = error.message ?: "बैंक विवरण लोड नहीं हो सके।"
            }
        }
    }

    LaunchedEffect(isLiveLocationSharing, hasActiveAssignedJob) {
        if (isLiveLocationSharing && hasActiveAssignedJob) {
            while (true) {
                delay(30_000)
                captureAndSendLiveLocation()
            }
        } else if (isLiveLocationSharing && !hasActiveAssignedJob) {
            isLiveLocationSharing = false
        }
    }

    DisposableEffect(isLiveLocationSharing) {
        onDispose {
            if (isLiveLocationSharing) viewModel.stopPartnerLiveLocation()
        }
    }

    val myBookings = bookings.sortedByDescending { it.id == initialBookingId }

    LaunchedEffect(initialBookingId) {
        if (!initialBookingId.isNullOrBlank()) viewModel.refreshPartnerJobs()
    }
    LaunchedEffect(initialBookingId, partnerJobs, bookings) {
        if (!initialBookingId.isNullOrBlank() &&
            (partnerJobs.any { it.id == initialBookingId } || bookings.any { it.id == initialBookingId })) {
            delay(450)
            targetBookingRequester.bringIntoView()
        }
    }

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
                            if (isEnglish) "Signed-in partner account" else "लॉगिन किया हुआ पार्टनर खाता",
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
                actions = { QuickFixLanguageSelector() },
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
            PartnerRechargeCard()
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        if (isEnglish) "My QuickFix Partner ID" else "मेरा QuickFix पार्टनर ID",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = TextPrimary
                    )
                    Text(
                        partnerQuickFixId.ifBlank {
                            if (isEnglish) "ID is loading. Please refresh or sign in again." else "ID लोड हो रही है। कृपया रिफ्रेश करें या दोबारा लॉगिन करें।"
                        },
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        color = if (partnerQuickFixId.isBlank()) TextSecondary else BrandBlue
                    )
                    Text(
                        if (isEnglish) "Keep this ID for support and booking references." else "सहायता और बुकिंग के लिए इस ID को संभालकर रखें।",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }
            }
            if (!initialBookingId.isNullOrBlank()) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF60A5FA)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(if (isEnglish) "Opened from booking notification" else "बुकिंग नोटिफिकेशन से खोला गया", fontWeight = FontWeight.Bold, color = BrandBlue)
                        Text(if (isEnglish) "Target booking: $initialBookingId" else "लक्षित बुकिंग: $initialBookingId", fontSize = 12.sp, color = TextPrimary)
                        Text(if (isEnglish) "The matching booking is moved to the top of its list. If it is no longer available, refresh the job feed." else "संबंधित बुकिंग अपनी सूची में सबसे ऊपर दिखाई जाएगी। यदि उपलब्ध न हो, तो जॉब सूची रिफ्रेश करें।", fontSize = 11.sp, color = TextSecondary)
                        OutlinedButton(onClick = { viewModel.refreshPartnerJobs() }, modifier = Modifier.fillMaxWidth()) {
                            Text(if (isEnglish) "Refresh target booking" else "लक्षित बुकिंग रिफ्रेश करें")
                        }
                    }
                }
            }
            EmergencyContactsSection(isEnglish = isEnglish)
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text(if (isEnglish) "My bank account" else "मेरा बैंक अकाउंट", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text(if (isEnglish) "Securely save your bank account for future payouts." else "भविष्य में payout के लिए अपना बैंक अकाउंट सुरक्षित रूप से सेव करें।", fontSize = 12.sp, color = TextSecondary)
                    if (partnerBankSummary.isNotBlank()) {
                        Text("${if (isEnglish) "Saved" else "सेव किया गया"}: $partnerBankSummary", fontSize = 12.sp, color = Color(0xFF047857), fontWeight = FontWeight.SemiBold)
                    }
                    OutlinedTextField(
                        value = partnerBankName,
                        onValueChange = { partnerBankName = it.take(100) },
                        label = { Text(if (isEnglish) "Bank Name" else "बैंक का नाम") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Text(if (isEnglish) "Account Type" else "खाते का प्रकार", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { partnerBankType = "savings" }, modifier = Modifier.weight(1f)) {
                            Text(if (isEnglish) { if (partnerBankType == "savings") "✓ Savings" else "Savings" } else { if (partnerBankType == "savings") "✓ बचत खाता" else "बचत खाता" })
                        }
                        OutlinedButton(onClick = { partnerBankType = "current" }, modifier = Modifier.weight(1f)) {
                            Text(if (isEnglish) { if (partnerBankType == "current") "✓ Current" else "Current" } else { if (partnerBankType == "current") "✓ चालू खाता" else "चालू खाता" })
                        }
                    }
                    OutlinedTextField(
                        value = partnerBankHolder,
                        onValueChange = { partnerBankHolder = it.take(100) },
                        label = { Text(if (isEnglish) "Account Holder Name" else "खाताधारक का नाम") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = partnerBankAccount,
                        onValueChange = { partnerBankAccount = it.filter(Char::isDigit).take(18) },
                        label = { Text(if (isEnglish) "Bank Account Number" else "बैंक खाता नंबर") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Next),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = partnerBankIfsc,
                        onValueChange = { partnerBankIfsc = it.uppercase().take(11) },
                        label = { Text(if (isEnglish) "IFSC Code" else "IFSC कोड") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Button(
                        onClick = {
                            bankScope.launch {
                                partnerBankSaving = true
                                partnerBankStatus = "बैंक अकाउंट सुरक्षित रूप से सेव हो रहा है..."
                                try {
                                    val user = FirebaseAuth.getInstance().currentUser ?: error("कृपया दोबारा लॉगिन करें।")
                                    val token = user.getIdToken(true).await().token ?: error("Secure sign-in token unavailable.")
                                    val result = withContext(Dispatchers.IO) {
                                        val connection = java.net.URL("https://quickfix-india.onrender.com/api/partners/bank-account").openConnection() as java.net.HttpURLConnection
                                        try {
                                            connection.requestMethod = "PUT"
                                            connection.doOutput = true
                                            connection.setRequestProperty("Authorization", "Bearer $token")
                                            connection.setRequestProperty("Content-Type", "application/json")
                                            connection.connectTimeout = 15000
                                            connection.readTimeout = 20000
                                            val payload = org.json.JSONObject()
                                                .put("bankName", partnerBankName.trim())
                                                .put("accountType", partnerBankType)
                                                .put("accountHolderName", partnerBankHolder.trim())
                                                .put("accountNumber", partnerBankAccount.filterNot { it.isWhitespace() })
                                                .put("ifsc", partnerBankIfsc.trim().uppercase())
                                            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                                            val status = connection.responseCode
                                            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
                                            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
                                            val json = org.json.JSONObject(body)
                                            if (status !in 200..299 || !json.optBoolean("success")) error(json.optString("error").ifBlank { "Bank account could not be saved (HTTP $status)." })
                                            json
                                        } finally { connection.disconnect() }
                                    }
                                    partnerBankSummary = "${result.optString("bankName")} • ${if (result.optString("accountType") == "current") "Current" else "Savings"} •••• ${result.optString("accountLast4")} • IFSC ${result.optString("ifsc")}"
                                    partnerBankAccount = ""
                                    partnerBankStatus = "बैंक अकाउंट सुरक्षित रूप से सेव हो गया। Payout अभी अलग से activate नहीं है।"
                                } catch (error: Exception) {
                                    partnerBankStatus = error.message ?: "बैंक अकाउंट सेव नहीं हो सका।"
                                } finally {
                                    partnerBankSaving = false
                                }
                            }
                        },
                        enabled = !partnerBankSaving && partnerBankName.isNotBlank() && partnerBankHolder.trim().length >= 2 && partnerBankAccount.length in 9..18 && partnerBankIfsc.matches(Regex("[A-Z]{4}0[A-Z0-9]{6}")),
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                    ) {
                        Text(if (partnerBankSaving) "Saving..." else "Save / Update Bank Account")
                    }
                    Text(partnerBankStatus, fontSize = 11.sp, color = TextSecondary)
                    Text("Account number server par AES-256-GCM se encrypted hota hai. Bank details save karne se payout/transfer activate nahi hota.", fontSize = 10.sp, color = Color(0xFFB45309))
                }
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (isEnglish) "My services / My work" else "मेरी सेवाएँ / मेरा काम", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    if (registeredTrades.isNotEmpty()) {
                        registeredTrades.chunked(2).forEach { rowTrades ->
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                rowTrades.forEach { trade ->
                                    Surface(color = Color(0xFFEFF6FF), shape = RoundedCornerShape(20.dp)) {
                                        Text(if (isEnglish) trade.replace("_", " ").replaceFirstChar { it.uppercase() } else partnerCategoryHindi(trade), modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), color = Color(0xFF1E40AF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                    }
                                }
                            }
                        }
                    } else {
                        Text(tradesLoadMessage, fontSize = 12.sp, color = TextSecondary)
                    }
                }
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(if (isEnglish) "Choose my booking radius" else "मेरी बुकिंग की दूरी चुनें", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text(if (isEnglish) "Jobs within your selected radius will appear. Maximum 15 km." else "आपकी चुनी हुई दूरी के अंदर के काम दिखेंगे. अधिकतम 15 km.", fontSize = 12.sp, color = TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                        listOf(1, 3, 5, 10, 15).forEach { radius ->
                            FilterChip(selected = selectedDispatchRadius == radius, onClick = { selectedDispatchRadius = radius }, label = { Text("$radius km") })
                        }
                    }
                    Button(
                        onClick = { locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                    ) { Text(if (isEnglish) "Save radius and my location" else "दूरी और मेरी लोकेशन सेव करें") }
                    if (locationSaveMessage.isNotBlank()) Text(locationSaveMessage, fontSize = 11.sp, color = TextSecondary)
                }
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFBFDBFE)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (isEnglish) "Share live GPS with customer" else "ग्राहक के साथ Live GPS साझा करें", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text("यह सुविधा केवल आपकी सक्रिय assigned booking के ग्राहक को आपकी लोकेशन दिखाती है। GPS हर 30 सेकंड में अपडेट होगा, जब तक Partner Portal खुला है।", fontSize = 11.sp, color = TextSecondary)
                    Text(if (hasActiveAssignedJob) "Active booking मिली है." else "Live sharing शुरू करने के लिए पहले कोई active assigned booking होनी चाहिए.", fontSize = 11.sp, color = if (hasActiveAssignedJob) Color(0xFF166534) else Color(0xFF9A3412))
                    Button(
                        onClick = {
                            requestingLiveShare = true
                            locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                        },
                        enabled = hasActiveAssignedJob && !isLiveLocationSharing,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                    ) { Text("मैं Live Location साझा करने की अनुमति देता/देती हूँ") }
                    OutlinedButton(
                        onClick = {
                            isLiveLocationSharing = false
                            requestingLiveShare = false
                        },
                        enabled = isLiveLocationSharing,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Live Location साझा करना बंद करें") }
                    Text(liveLocationStatus, fontSize = 11.sp, color = TextSecondary)
                }
            }
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
                    Text(if (isEnglish) "Partner Wallet" else "पार्टनर वॉलेट", fontSize = 13.sp, color = Color(0xFF94A3B8))
                    Text(if (isEnglish) "Wallet balance unavailable" else "वॉलेट बैलेंस उपलब्ध नहीं", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = Color.White)
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
                        Text(if (isEnglish) "Available Jobs" else "उपलब्ध काम", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                        TextButton(onClick = { viewModel.refreshPartnerJobs() }) { Text(if (isEnglish) "Refresh" else "रिफ्रेश करें") }
                    }
                    Text(partnerJobsStatus, fontSize = 11.sp, color = TextSecondary)
                    partnerJobs.filter { it.status == "requested" }.sortedByDescending { it.id == initialBookingId }.forEach { job ->
                        Divider(color = Color(0xFFE2E8F0))
                        Column(
                            modifier = if (job.id == initialBookingId) Modifier.bringIntoViewRequester(targetBookingRequester) else Modifier,
                            verticalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            if (job.id == initialBookingId) Text(if (isEnglish) "NOTIFICATION TARGET BOOKING" else "नोटिफिकेशन वाली बुकिंग", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                            Text(job.serviceTitle, fontWeight = FontWeight.SemiBold, color = TextPrimary, fontSize = 13.sp)
                            Text("काम: ${partnerCategoryHindi(job.category)} · ग्राहक: ${job.customerName}", fontSize = 11.sp, color = TextSecondary)
                            Text("Service price: ₹${job.price} · Total: ₹${job.totalAmount}", fontSize = 11.sp, color = TextSecondary)
                            if (job.lineItems.isNotEmpty()) {
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text("काम का अलग-अलग रेट / Item-wise rate", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = BrandBlue)
                                    job.lineItems.forEach { line ->
                                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                            Text("${line.serviceTitle} × ${line.quantity} ${line.billingUnit.replace('_', ' ')}", fontSize = 10.sp, color = TextSecondary, modifier = Modifier.weight(1f))
                                            Column(horizontalAlignment = Alignment.End) {
                                                Text("₹${line.lineTotalMinimum.toInt()}${if (line.lineTotalMaximum != line.lineTotalMinimum) "–₹${line.lineTotalMaximum.toInt()}" else ""} (₹${line.unitRateMinimum.toInt()}/unit)", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                if (line.appliedAdjustmentPercent < 0) Text(
                                                    if (isEnglish) "${kotlin.math.abs(line.appliedAdjustmentPercent)}% Admin rate decrease" else "एडमिन रेट में ${kotlin.math.abs(line.appliedAdjustmentPercent)}% कमी",
                                                    fontSize = 9.sp, color = Color(0xFF15803D)
                                                )
                                            }
                                        }
                                    }
                                    Text("हर अतिरिक्त काम/सामग्री के लिए ग्राहक की अलग मंजूरी जरूरी है।", fontSize = 10.sp, color = TextSecondary)
                                }
                            } else {
                                Text("इस पुरानी booking में item-wise approved rate snapshot उपलब्ध नहीं है।", fontSize = 10.sp, color = Color(0xFFB45309))
                            }
                            Button(
                                onClick = {
                                    acceptingJobId = job.id
                                    viewModel.acceptPartnerJob(job.id) { acceptingJobId = null }
                                },
                                enabled = acceptingJobId == null,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                            ) {
                                Text(if (isEnglish) { if (acceptingJobId == job.id) "Accepting..." else "Accept Job" } else { if (acceptingJobId == job.id) "स्वीकार हो रहा है..." else "काम स्वीकार करें" })
                            }
                        }
                    }
                    if (partnerJobsHasMore) {
                        TextButton(
                            onClick = { viewModel.loadMorePartnerJobs() },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(if (isEnglish) "Load more jobs" else "और काम देखें")
                        }
                    }
                }
            }

            // The server feed returns assignedBookings separately from new requests.
            val serverAssignedJobs = partnerJobs.filter { it.status != "requested" }.sortedByDescending { it.id == initialBookingId }
            Text(if (isEnglish) "Assigned Customer Bookings" else "आपको मिले ग्राहक के काम", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
            if (serverAssignedJobs.isEmpty() && myBookings.isEmpty()) {
                Text(if (isEnglish) "No bookings have been assigned to you yet." else "अभी कोई booking आपको नहीं मिली है।", fontSize = 12.sp, color = TextSecondary)
            }
            serverAssignedJobs.forEach { job ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = (if (job.id == initialBookingId) Modifier.bringIntoViewRequester(targetBookingRequester) else Modifier).fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (job.id == initialBookingId) Text(if (isEnglish) "NOTIFICATION TARGET BOOKING" else "नोटिफिकेशन वाली बुकिंग", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                        Text(job.id, fontWeight = FontWeight.Bold, color = BrandBlue, fontSize = 12.sp)
                        Text(job.serviceTitle, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Text("काम: ${partnerCategoryHindi(job.category)} · ग्राहक: ${job.customerName}", fontSize = 11.sp, color = TextSecondary)
                        Text("Status: ${job.status.replace("_", " ").uppercase()}", fontSize = 11.sp, color = TextSecondary)
                    }
                }
            }

            myBookings.forEach { booking ->
                val enteredOtp = enteredOtps[booking.id].orEmpty()
                val otpError = otpErrors[booking.id]
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFE2E8F0)),
                    modifier = (if (booking.id == initialBookingId) Modifier.bringIntoViewRequester(targetBookingRequester) else Modifier).fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (booking.id == initialBookingId) Text(if (isEnglish) "NOTIFICATION TARGET BOOKING" else "नोटिफिकेशन वाली बुकिंग", color = BrandBlue, fontWeight = FontWeight.Bold, fontSize = 10.sp)
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
                        Text("${if (isEnglish) "Customer" else "ग्राहक"}: ${booking.customerName}", fontSize = 12.sp, color = TextSecondary)
                        Text("${if (isEnglish) "Location" else "पता"}: ${booking.customerAddress}", fontSize = 11.sp, color = TextSecondary)
                        if (booking.status in listOf("assigned", "technician_en_route", "in_progress")) {
                            Divider(color = Color(0xFFFDA4AF))
                            Text(if (isEnglish) "SOS / Channel Partner Safety" else "SOS / चैनल पार्टनर सुरक्षा", fontWeight = FontWeight.Bold, color = Color(0xFF9F1239), fontSize = 12.sp)
                            Text(if (isEnglish) "The report is saved in QuickFix only. Emergency team/contact alerts are not connected." else "रिपोर्ट केवल QuickFix में सेव होगी। Emergency team/contact alerts अभी जुड़े नहीं हैं।", fontSize = 10.sp, color = Color(0xFF881337))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                Button(onClick = { viewModel.submitBookingSafetyReport(booking.id) { _, message -> sosStatus = message } },
                                    modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE11D48))) { Text("SOS Report") }
                                OutlinedButton(onClick = { context.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:112"))) },
                                    modifier = Modifier.weight(1f)) { Text("Call 112") }
                            }
                            if (sosStatus.isNotBlank()) Text(sosStatus, fontSize = 10.sp, color = TextSecondary)
                        }
                        Text(if (isEnglish) "Partner payout details are unavailable until server-side settlement is enabled." else "सर्वर से सुरक्षित भुगतान शुरू होने तक पार्टनर payout की जानकारी उपलब्ध नहीं है।", fontSize = 11.sp, color = TextSecondary)

                        // OTP Verification when assigned
                        if (booking.status in listOf("assigned", "technician_en_route")) {
                            Divider(color = Color(0xFFE2E8F0))
                            Text(if (isEnglish) "Enter the 6-digit Start OTP received from the customer:" else "ग्राहक से मिला 6 अंकों का Start OTP दर्ज करें:", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextPrimary)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedTextField(
                                    value = enteredOtp,
                                    onValueChange = {
                                        enteredOtps = enteredOtps + (booking.id to it.filter { char -> char in '0'..'9' }.take(6))
                                        otpErrors = otpErrors - booking.id
                                    },
                                    modifier = Modifier.weight(1f),
                                    placeholder = { Text(if (isEnglish) "6-digit OTP" else "6 अंकों का OTP") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                                    singleLine = true
                                )
                                Button(
                                    onClick = {
                                        viewModel.verifyStartOtp(booking.id, enteredOtp) { valid, message ->
                                            if (valid) {
                                                enteredOtps = enteredOtps - booking.id
                                                otpErrors = otpErrors - booking.id
                                            } else {
                                                otpErrors = otpErrors + (booking.id to message)
                                            }
                                        }
                                    },
                                    enabled = enteredOtp.length == 6,
                                    colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
                                ) {
                                    Text(if (isEnglish) "Verify OTP" else "OTP सत्यापित करें")
                                }
                            }
                            if (otpError != null) {
                                Text(otpError, color = Color(0xFFDC2626), fontSize = 11.sp)
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
                                Text("काम पूरा करें / Complete Job", fontWeight = FontWeight.Bold)
                            }
                            Text(firestoreStatus, color = TextSecondary, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}
