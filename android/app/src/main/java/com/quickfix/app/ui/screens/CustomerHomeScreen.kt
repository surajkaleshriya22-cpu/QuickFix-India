package com.quickfix.app.ui.screens

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import java.util.Locale
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

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
import androidx.compose.ui.platform.LocalContext
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
    val context = LocalContext.current
    var sosStatus by remember { mutableStateOf("") }
    val currentCity by viewModel.currentCity.collectAsState()
    val services by viewModel.services.collectAsState()
    val bookings by viewModel.bookings.collectAsState()
    val customerStartOtps by viewModel.customerStartOtps.collectAsState()
    val customerStartOtpStatus by viewModel.customerStartOtpStatus.collectAsState()

    var selectedCategory by remember { mutableStateOf("all") }
    var showCityMenu by remember { mutableStateOf(false) }
    var cityInput by remember(currentCity) { mutableStateOf(currentCity) }
    var voiceMessage by remember { mutableStateOf("") }
    val context = LocalContext.current
    val languagePrefs = remember { context.getSharedPreferences("quickfix_preferences", android.content.Context.MODE_PRIVATE) }
    val languageState = LocalQuickFixLanguage.current
    val appLanguage = languageState.value
    val isEnglish = appLanguage == "en"
    var hindiSpeaker by remember { mutableStateOf<TextToSpeech?>(null) }
    DisposableEffect(context) {
        val speaker = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                hindiSpeaker?.language = if (appLanguage == "en") Locale.US else Locale("hi", "IN")
            }
        }
        hindiSpeaker = speaker
        onDispose {
            speaker.stop()
            speaker.shutdown()
            hindiSpeaker = null
        }
    }
    LaunchedEffect(voiceMessage) {
        if (voiceMessage.isNotBlank()) {
            hindiSpeaker?.language = if (isEnglish) Locale.US else Locale("hi", "IN")
            hindiSpeaker?.speak(voiceMessage, TextToSpeech.QUEUE_FLUSH, null, "quickfix_voice_feedback")
        }
    }
    val voiceBookingLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spoken = result.data
                ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
                ?.firstOrNull()
                .orEmpty()
                .lowercase()
            val match = when {
                listOf("बिजली", "इलेक्ट्रिशियन", "electrician", "पंखा", "लाइट").any { spoken.contains(it) } -> "electrician"
                listOf("पानी", "नल", "पाइप", "प्लंबर", "plumber").any { spoken.contains(it) } -> "plumber"
                listOf("एसी", "ac", "एयर कंडीशनर").any { spoken.contains(it) } -> "ac_repair"
                listOf("फ्रिज", "रेफ्रिजरेटर").any { spoken.contains(it) } -> "fridge_repair"
                listOf("गाड़ी", "कार", "मैकेनिक").any { spoken.contains(it) } -> "mechanic"
                listOf("ड्राइवर", "driver").any { spoken.contains(it) } -> "driver"
                listOf("बाइक", "टैक्सी").any { spoken.contains(it) } -> "bike_taxi"
                listOf("सफाई", "घर की मदद", "मदद").any { spoken.contains(it) } -> "kaamkaaj_partner"
                else -> ""
            }
            if (match.isNotBlank()) {
                selectedCategory = match
                voiceMessage = "आपका काम चुना गया: $spoken"
            } else {
                voiceMessage = "काम समझ नहीं आया। फिर बोलें या नीचे से काम चुनें।"
            }
        } else {
            voiceMessage = "आवाज़ से काम चुनना रद्द हुआ।"
        }
    }
    fun startVoiceBooking() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (isEnglish) "en-IN" else "hi-IN")
            putExtra(RecognizerIntent.EXTRA_PROMPT, if (isEnglish) "Tell us what service you need." else "बताइए, आपको कौन-सा काम करवाना है?")
        }
        try {
            voiceBookingLauncher.launch(intent)
        } catch (_: Exception) {
            voiceMessage = "इस फोन में आवाज़ पहचानने की सुविधा उपलब्ध नहीं है।"
        }
    }
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
                                contentDescription = if (isEnglish) "City" else "शहर",
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
                                contentDescription = if (isEnglish) "Select City" else "शहर चुनें",
                                tint = Color(0xFF94A3B8)
                            )
                        }
                        Text(
                            if (isEnglish) "Choose your city" else "अपना शहर चुनें",
                            color = Color(0xFF94A3B8),
                            fontSize = 10.sp
                        )
                    }
                },
                actions = {
                    Box {
                        var showLanguageMenu by remember { mutableStateOf(false) }
                        TextButton(onClick = { showLanguageMenu = true }) {
                            Text(if (isEnglish) "EN" else "हिं", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                        DropdownMenu(expanded = showLanguageMenu, onDismissRequest = { showLanguageMenu = false }) {
                            DropdownMenuItem(text = { Text("हिंदी") }, onClick = {
                                languageState.value = "hi"
                                languagePrefs.edit().putString("app_language", "hi").apply()
                                showLanguageMenu = false
                            })
                            DropdownMenuItem(text = { Text("English") }, onClick = {
                                languageState.value = "en"
                                languagePrefs.edit().putString("app_language", "en").apply()
                                showLanguageMenu = false
                            })
                        }
                    }
                    IconButton(onClick = { navController.navigate("profile_screen") }) {
                        Icon(Icons.Default.AccountCircle, contentDescription = if (isEnglish) "Profile" else "प्रोफ़ाइल", tint = Color.White)
                    }
                    IconButton(onClick = { navController.navigate("admin_login") }) {
                        Icon(Icons.Default.AdminPanelSettings, contentDescription = if (isEnglish) "Admin" else "एडमिन", tint = Color(0xFF60A5FA))
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
                                label = { Text(if (isEnglish) "City" else "शहर") },
                                supportingText = { Text(if (isEnglish) "Enter any city in India. Service availability is confirmed when you book." else "भारत के किसी भी शहर का नाम लिख सकते हैं। सेवा उपलब्धता की पुष्टि बुकिंग के समय होगी।") }
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.End
                            ) {
                                TextButton(onClick = { cityInput = currentCity; showCityMenu = false }) {
                                    Text(if (isEnglish) "Cancel" else "रद्द करें")
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
                                    Text(if (isEnglish) "Save City" else "शहर सेव करें")
                                }
                            }
                        }
                    }
                }
            }

            if (activeBooking != null && activeBooking.status in listOf("assigned", "technician_en_route", "in_progress")) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF1F2)),
                        shape = RoundedCornerShape(14.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFDA4AF)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(if (isEnglish) "SOS / Customer safety" else "SOS / ग्राहक सुरक्षा", fontWeight = FontWeight.Bold, color = Color(0xFF9F1239))
                            Text(if (isEnglish) "This saves a safety report in QuickFix only. Emergency team/contact alerts are not connected." else "यह सुरक्षा रिपोर्ट केवल QuickFix में सेव करता है। Emergency team/contact alerts अभी जुड़े नहीं हैं।", fontSize = 11.sp, color = Color(0xFF881337))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                Button(onClick = { viewModel.submitBookingSafetyReport(activeBooking.id) { _, message -> sosStatus = message } },
                                    modifier = Modifier.weight(1f), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE11D48))) { Text("SOS Report") }
                                OutlinedButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, android.net.Uri.parse("tel:112"))) },
                                    modifier = Modifier.weight(1f)) { Text("Call 112") }
                            }
                            if (sosStatus.isNotBlank()) Text(sosStatus, fontSize = 11.sp, color = TextPrimary)
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
                            if (isEnglish) "What work do you need done?" else "आपको कौन-सा काम करवाना है?",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            if (isEnglish) "Choose your work. We will ask for the remaining details simply." else "अपना काम चुनें। बाकी जानकारी हम आसान तरीके से पूछेंगे।",
                            color = Color(0xFFDBEAFE),
                            fontSize = 11.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Button(
                            onClick = { startVoiceBooking() },
                            modifier = Modifier.fillMaxWidth().heightIn(min = 58.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Icon(Icons.Default.Mic, contentDescription = if (isEnglish) "Describe the work by voice" else "आवाज़ से काम बताएं", tint = BrandBlue)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (isEnglish) "Tell us what you need" else "बोलकर अपना काम बताइए", color = BrandBlue, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                        if (voiceMessage.isNotBlank()) {
                            Text(voiceMessage, color = Color.White, fontSize = 12.sp)
                        }
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
                                contentDescription = if (isEnglish) "Track booking" else "बुकिंग ट्रैक करें",
                                tint = BrandBlue
                            )
                        }
                    }
                }
            }

            // Large, easy-to-tap Hindi service tiles for first-time and low-literacy users.
            item {
                val categoryOptions = listOf(
                    "all" to if (isEnglish) "🧰\\nAll services" else "🧰\\nसभी काम",
                    "electrician" to if (isEnglish) "⚡\\nElectrical work" else "⚡\\nबिजली का काम",
                    "plumber" to if (isEnglish) "🔧\\nPlumbing" else "🔧\\nनल-पाइप का काम",
                    "ac_repair" to if (isEnglish) "❄️\\nAC repair" else "❄️\\nAC ठीक करवाएँ",
                    "fridge_repair" to if (isEnglish) "🧊\\nFridge repair" else "🧊\\nफ्रिज ठीक करवाएँ",
                    "appliance_repair" to if (isEnglish) "🛠️\\nHome appliance repair" else "🛠️\\nघर के सामान की मरम्मत",
                    "welder" to if (isEnglish) "🔥\\nWelding" else "🔥\\nवेल्डिंग का काम",
                    "mechanic" to if (isEnglish) "🚗\\nVehicle repair" else "🚗\\nगाड़ी ठीक करवाएँ",
                    "driver" to if (isEnglish) "🚕\\nBook a driver" else "🚕\\nड्राइवर बुलाएँ",
                    "tourist_guide" to if (isEnglish) "🧭\\nTourist guide" else "🧭\\nघूमने के लिए गाइड",
                    "contractor" to if (isEnglish) "🏗️\\nContractor" else "🏗️\\nठेकेदार",
                    "bike_taxi" to if (isEnglish) "🏍️\\nBike taxi" else "🏍️\\nबाइक से सफर",
                    "kaamkaaj_partner" to if (isEnglish) "🏠\\nHome help" else "🏠\\nघर के काम में मदद",
                    "carpenter" to if (isEnglish) "🪚\\nCarpenter" else "🪚\\nबढ़ई का काम",
                    "painter" to if (isEnglish) "🖌️\\nPainting" else "🖌️\\nपेंट का काम",
                    "gardener" to if (isEnglish) "🌱\\nGardener" else "🌱\\nमाली का काम",
                    "pest_control" to if (isEnglish) "🐜\\nPest control" else "🐜\\nकीड़े-मकोड़े हटाएँ",
                    "house_shifting" to if (isEnglish) "📦\\nHouse shifting" else "📦\\nघर का सामान शिफ्ट करें",
                    "car_wash" to if (isEnglish) "🚘\\nCar / bike washing" else "🚘\\nकार / बाइक वॉश",
                    "transport" to if (isEnglish) "🚚\\nGoods delivery / transport" else "🚚\\nसामान डिलीवरी / वाहन"

                )
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        if (isEnglish) "Tap a picture to choose a service" else "काम चुनने के लिए तस्वीर वाले बटन दबाएँ",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = TextPrimary
                    )
                    categoryOptions.chunked(2).forEach { pair ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            pair.forEach { (id, label) ->
                                Card(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(94.dp)
                                        .clickable { selectedCategory = id },
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (selectedCategory == id) Color(0xFFDBEAFE) else Color.White
                                    ),
                                    border = androidx.compose.foundation.BorderStroke(
                                        if (selectedCategory == id) 2.dp else 1.dp,
                                        if (selectedCategory == id) BrandBlue else Color(0xFFE2E8F0)
                                    ),
                                    shape = RoundedCornerShape(16.dp)
                                ) {
                                    Box(
                                        modifier = Modifier.fillMaxSize().padding(8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            label,
                                            fontSize = 15.sp,
                                            lineHeight = 21.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                    }
                                }
                            }
                            if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
                        }
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
                            Text(if (isEnglish) "Price after inspection" else "कीमत काम देखकर बताएँगे", fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = TextSecondary)
                            Button(
                                onClick = { navController.navigate("service_booking/${service.id}") },
                                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(if (isEnglish) "Choose service" else "काम चुनें", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
