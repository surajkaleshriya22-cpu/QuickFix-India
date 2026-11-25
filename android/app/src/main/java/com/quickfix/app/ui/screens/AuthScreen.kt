package com.quickfix.app.ui.screens

import android.app.Activity
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.quickfix.app.data.model.AuthState
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import com.quickfix.app.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(
    navController: NavController,
    authViewModel: AuthViewModel,
    initialRole: UserRole = UserRole.CUSTOMER
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val authState by authViewModel.authState.collectAsState()
    val isEnglish = LocalQuickFixLanguage.current.value == "en"

    var selectedRole by remember { mutableStateOf(initialRole) }
    var isSignUp by remember { mutableStateOf(false) }

    // Customer / Common Fields
    var phone by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("Bengaluru") }
    var rememberMe by remember { mutableStateOf(true) }

    // Partner specific
    val selectedTrades = remember { mutableStateListOf("electrician") }
    var experienceYears by remember { mutableStateOf("7") }
    
    

    // OTP
    var otpCode by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            modifier = Modifier.size(32.dp),
                            shape = RoundedCornerShape(8.dp),
                            color = Color(0xFF2563EB)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("Q", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("QuickFix India", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFF1E3A8A))
                            Text(if (isEnglish) "Secure sign-in and account setup" else "सुरक्षित लॉगिन और खाता सेटअप", fontSize = 10.sp, color = Color.Gray)
                        }
                    }
                },
                actions = { QuickFixLanguageSelector() },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFFF8FAFC))
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Role Switcher Tabs
            if (authState !is AuthState.OtpSent) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color.White,
                    shadowElevation = 1.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        TabRoleButton(
                            title = if (isEnglish) "Customer" else "ग्राहक",
                            isSelected = selectedRole == UserRole.CUSTOMER,
                            onClick = { selectedRole = UserRole.CUSTOMER },
                            modifier = Modifier.weight(1f)
                        )
                        TabRoleButton(
                            title = if (isEnglish) "Partner" else "पार्टनर",
                            isSelected = selectedRole == UserRole.CHANNEL_PARTNER,
                            onClick = { selectedRole = UserRole.CHANNEL_PARTNER },
                            modifier = Modifier.weight(1f)
                        )
                        TabRoleButton(
                            title = if (isEnglish) "Admin" else "एडमिन",
                            isSelected = selectedRole == UserRole.ADMIN,
                            onClick = { selectedRole = UserRole.ADMIN },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Status feedback / Error
            when (val state = authState) {
                is AuthState.Loading -> {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = Color(0xFF2563EB))
                }
                is AuthState.Error -> {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = Color(0xFFFEF2F2),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF87171))
                    ) {
                        Text(
                            text = state.message,
                            color = Color(0xFFDC2626),
                            fontSize = 12.sp,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
                is AuthState.Authenticated -> {
                    LaunchedEffect(state.user) {
                        when (state.user.role) {
                            UserRole.CUSTOMER -> navController.navigate("customer_home")
                            UserRole.CHANNEL_PARTNER, UserRole.TECHNICIAN -> navController.navigate("technician_portal")
                            UserRole.ADMIN -> navController.navigate("admin_dashboard")
                        }
                    }
                }
                else -> {}
            }

            // Auth Input Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (authState is AuthState.OtpSent) {
                        // OTP VERIFICATION VIEW
                        Text(
                            text = "Enter Firebase SMS OTP",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF1E293B)
                        )
                        Text(
                            text = "Enter the SMS code sent by Firebase. No demo or fixed OTP is accepted.",
                            fontSize = 11.sp,
                            color = Color(0xFF2563EB)
                        )

                        OutlinedTextField(
                            value = otpCode,
                            onValueChange = { value -> otpCode = value.filter { it.isDigit() }.take(6) },
                            label = { Text(if (isEnglish) "Verification OTP" else "ओटीपी सत्यापन") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            enabled = otpCode.length == 6,
                            onClick = {
                                val pendingUser = User(
                                    phoneNumber = "+91 $phone",
                                    displayName = displayName,
                                    email = email,
                                    role = selectedRole,
                                    isPartnerRegistration = selectedRole == UserRole.CHANNEL_PARTNER && isSignUp,
                                    address = address,
                                    city = city,
                                    trades = if (selectedRole == UserRole.CHANNEL_PARTNER) selectedTrades.toList() else emptyList(),
                                    experienceYears = experienceYears.toIntOrNull() ?: 5,
                                )
                                authViewModel.verifyOtp(otpCode, pendingUser) { verifiedUser ->
                                    when (verifiedUser.role) {
                                        UserRole.CUSTOMER -> navController.navigate("customer_home")
                                        UserRole.CHANNEL_PARTNER, UserRole.TECHNICIAN -> navController.navigate("technician_portal")
                                        UserRole.ADMIN -> navController.navigate("admin_dashboard")
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(if (isEnglish) "Verify OTP & Login" else "ओटीपी जाँचें और लॉगिन करें", fontWeight = FontWeight.Bold)
                        }
                        TextButton(
                            enabled = activity != null && phone.filter { it.isDigit() }.length == 10,
                            onClick = {
                                otpCode = ""
                                val pendingUser = User(
                                    phoneNumber = "+91 $phone",
                                    displayName = displayName,
                                    email = email,
                                    role = selectedRole,
                                    isPartnerRegistration = selectedRole == UserRole.CHANNEL_PARTNER && isSignUp,
                                    address = address,
                                    city = city,
                                    trades = if (selectedRole == UserRole.CHANNEL_PARTNER) selectedTrades.toList() else emptyList(),
                                    experienceYears = experienceYears.toIntOrNull() ?: 5,
                                )
                                activity?.let { act ->
                                    authViewModel.sendOtp("+91 $phone", act, pendingUser)
                                }
                            },
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text(if (isEnglish) "Resend OTP" else "ओटीपी दोबारा भेजें", color = Color(0xFF2563EB), fontWeight = FontWeight.SemiBold)
                        }

                    } else if (selectedRole == UserRole.ADMIN) {
                        // Admin access is based only on an existing Firebase session
                        // carrying an Admin SDK-issued custom claim. No client passcode is accepted.
                        Text(if (isEnglish) "Admin Secure Login" else "एडमिन सुरक्षित लॉगिन", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(
                            "Admin access requires an already authenticated, authorized Firebase account with the server-issued admin permission. A passcode or phone number entered here cannot grant admin access.",
                            fontSize = 12.sp,
                            color = Color(0xFF64748B)
                        )
                        Button(
                            onClick = { authViewModel.verifyAdminPasscode("", "") { adminUser ->
                                navController.navigate("admin_dashboard") {
                                    popUpTo("auth") { inclusive = true }
                                }
                            } },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E3A8A)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(if (isEnglish) "Check Existing Admin Session" else "मौजूदा एडमिन सत्र जाँचें", fontWeight = FontWeight.Bold)
                        }
                        Text(
                            "If you are not already signed in, sign in through the authorized Firebase account first. Admin permission must be assigned securely by the project administrator.",
                            fontSize = 11.sp,
                            color = Color(0xFF92400E)
                        )
                    } else {
                        // CUSTOMER & PARTNER FORM
                        Text(
                            text = if (selectedRole == UserRole.CUSTOMER) {
                                if (isSignUp) "Customer Registration" else "Customer Sign In"
                            } else {
                                if (isSignUp) "Channel Partner Registration" else "Channel Partner Login"
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )

                        if (isSignUp && selectedRole == UserRole.CHANNEL_PARTNER) {
                            Text(
                                "Customer और Partner के लिए एक ही मोबाइल नंबर इस्तेमाल कर सकते हैं। आपका Customer अकाउंट बना रहेगा; Partner आवेदन अलग से जाँचा जाएगा।",
                                fontSize = 11.sp,
                                color = Color(0xFF047857)
                            )
                        }

                        if (isSignUp) {
                            OutlinedTextField(
                                value = displayName,
                                onValueChange = { displayName = it },
                                label = { Text(if (isEnglish) "Full Name" else "पूरा नाम") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = email,
                                onValueChange = { email = it },
                                label = { Text(if (isEnglish) "Email Address" else "ईमेल पता") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = address,
                                onValueChange = { address = it },
                                label = { Text(if (isEnglish) "Service Address" else "सेवा का पता") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            Text(if (isEnglish) "Operating City (choose city):" else "काम का शहर चुनें:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState())
                            ) {
                                val availableCities = listOf("Indore", "Bhopal", "Dewas", "Ujjain", "Bengaluru", "Mumbai", "Delhi-NCR")
                                availableCities.forEach { cityName ->
                                    FilterChip(
                                        selected = city == cityName,
                                        onClick = { city = cityName },
                                        label = { Text(cityName, fontSize = 11.sp) }
                                    )
                                }
                            }

                            if (selectedRole == UserRole.CHANNEL_PARTNER) {
                                Text(if (isEnglish) "KYC details are reviewed before activation. Any reserve payment must use a verified payment flow; this screen does not collect money." else "काम शुरू होने से पहले KYC की जाँच होगी। कोई भी रिज़र्व भुगतान केवल सुरक्षित भुगतान व्यवस्था से होगा; इस स्क्रीन पर पैसे नहीं लिए जाते।", fontSize = 11.sp, color = Color(0xFF92400E))
                                Text(if (isEnglish) "Select Channel Partner services (you can choose more than one):" else "चैनल पार्टनर की सेवाएँ चुनें (एक से अधिक चुन सकते हैं):", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                val partnerTrades = listOf(
                                    "electrician" to "इलेक्ट्रीशियन (बिजली मिस्त्री)",
                                    "plumber" to "प्लंबर (नलसाज़)",
                                    "technician" to "एसी / फ्रिज मैकेनिक",
                                    "welder" to "वेल्डर / फैब्रिकेटर",
                                    "mechanic" to "मैकेनिक (वाहन मिस्त्री)",
                                    "driver" to "ड्राइवर",
                                    "tourist_guide" to "पर्यटक गाइड",
                                    "contractor" to "ठेकेदार",
                                    "bike_taxi" to "क्विकफिक्स बाइक टैक्सी कैप्टन",
                                    "kaamkaaj_partner" to "कामकाज पार्टनर (सभी घरेलू काम)",
                                    "carpenter" to "बढ़ई",
                                    "painter" to "पेंटर (रंगाई-पुताई)",
                                    "gardener" to "माली",
                                    "pest_control" to "कीट नियंत्रण सेवा",
                                    "house_shifting" to "घर शिफ्टिंग सेवा",
                                    "car_wash" to "कार / बाइक वॉश पार्टनर",
                                    "transport" to "ट्रांसपोर्ट / सामान डिलीवरी पार्टनर"

                                )
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    partnerTrades.chunked(2).forEach { rowTrades ->
                                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            rowTrades.forEach { (tradeId, tradeLabel) ->
                                                FilterChip(
                                                    selected = tradeId in selectedTrades,
                                                    onClick = {
                                                        if (tradeId in selectedTrades) selectedTrades.remove(tradeId)
                                                        else selectedTrades.add(tradeId)
                                                    },
                                                    label = { Text(tradeLabel, fontSize = 11.sp) }
                                                )
                                            }
                                        }
                                    }
                                }
                                OutlinedTextField(
                                    value = experienceYears,
                                    onValueChange = { experienceYears = it.filter { ch -> ch.isDigit() }.take(2) },
                                    label = { Text(if (isEnglish) "Work Experience (years)" else "काम का अनुभव (वर्ष)") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                if (selectedTrades.isEmpty()) {
                                    Text(if (isEnglish) "Select at least one service." else "कम से कम एक सेवा चुनें।", color = Color(0xFFDC2626), fontSize = 11.sp)
                                }
                                Text(
                                    "Next step: enter your 10-digit mobile number below and tap Send Firebase Mobile OTP. Your partner profile is submitted only after Firebase verifies the OTP; KYC and payment setup happen later.",
                                    fontSize = 11.sp,
                                    color = Color(0xFF92400E)
                                )
                            }
                        }

                        OutlinedTextField(
                            value = phone,
                            onValueChange = { value -> phone = value.filter { it.isDigit() }.take(10) },
                            label = { Text(if (isEnglish) "Mobile Number for OTP (+91)" else "ओटीपी के लिए मोबाइल नंबर (+91)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
                            Text(if (isEnglish) "Keep me signed in" else "मुझे लॉगिन रखें", fontSize = 12.sp, color = Color.Gray)
                        }

                        Button(
                            enabled = phone.filter { it.isDigit() }.length == 10 &&
                                (!isSignUp || (displayName.trim().length >= 2 &&
                                    email.contains("@") &&
                                    (selectedRole != UserRole.CHANNEL_PARTNER || selectedTrades.isNotEmpty()))),
                            onClick = {
                                activity?.let { act ->
                                    val pendingUser = User(
                                        phoneNumber = "+91 $phone",
                                        displayName = displayName,
                                        email = email,
                                        role = selectedRole,
                                        address = address,
                                        city = city,
                                        trades = if (selectedRole == UserRole.CHANNEL_PARTNER) selectedTrades.toList() else emptyList(),
                                        experienceYears = experienceYears.toIntOrNull() ?: 5,
                                    )
                                    authViewModel.sendOtp("+91 $phone", act, pendingUser)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(if (isEnglish) "Send Mobile OTP" else "मोबाइल पर ओटीपी भेजें", fontWeight = FontWeight.Bold)
                        }

                        TextButton(
                            onClick = { isSignUp = !isSignUp },
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text(
                                if (isSignUp) "Already have an account? Sign In" else "New to QuickFix? Register Here",
                                fontSize = 12.sp,
                                color = Color(0xFF2563EB)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TabRoleButton(
    title: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .clickable { onClick() },
        color = if (isSelected) Color(0xFF2563EB) else Color.Transparent
    ) {
        Box(
            modifier = Modifier.padding(vertical = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = title,
                fontSize = 12.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                color = if (isSelected) Color.White else Color(0xFF64748B)
            )
        }
    }
}
