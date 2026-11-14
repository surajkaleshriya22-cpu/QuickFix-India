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
    var tradeElectrician by remember { mutableStateOf(true) }
    var tradePlumber by remember { mutableStateOf(false) }
    var experienceYears by remember { mutableStateOf("7") }
    var kycNumber by remember { mutableStateOf("") }
    var upiId by remember { mutableStateOf("") }

    // Admin specific
    var adminPasscode by remember { mutableStateOf("") }

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
                            Text("Firebase Auth & Firestore Architecture", fontSize = 10.sp, color = Color.Gray)
                        }
                    }
                },
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
                            title = "Customer",
                            isSelected = selectedRole == UserRole.CUSTOMER,
                            onClick = { selectedRole = UserRole.CUSTOMER },
                            modifier = Modifier.weight(1f)
                        )
                        TabRoleButton(
                            title = "Partner",
                            isSelected = selectedRole == UserRole.TECHNICIAN,
                            onClick = { selectedRole = UserRole.TECHNICIAN },
                            modifier = Modifier.weight(1f)
                        )
                        TabRoleButton(
                            title = "Admin",
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
                            UserRole.TECHNICIAN -> navController.navigate("technician_portal")
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
                            text = "Enter 4-Digit Firebase SMS OTP",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = Color(0xFF1E293B)
                        )
                        OutlinedTextField(
                            value = otpCode,
                            onValueChange = { if (it.length <= 6) otpCode = it },
                            label = { Text("Verification OTP") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            onClick = {
                                val pendingUser = User(
                                    phoneNumber = "+91 $phone",
                                    displayName = displayName,
                                    email = email,
                                    role = selectedRole,
                                    address = address,
                                    city = city,
                                    trades = buildList {
                                        if (tradeElectrician) add("electrician")
                                        if (tradePlumber) add("plumber")
                                    },
                                    experienceYears = experienceYears.toIntOrNull() ?: 5,
                                    kycDocNumber = kycNumber,
                                    upiId = upiId
                                )
                                authViewModel.verifyOtp(otpCode, pendingUser) { verifiedUser ->
                                    when (verifiedUser.role) {
                                        UserRole.CUSTOMER -> navController.navigate("customer_home")
                                        UserRole.TECHNICIAN -> navController.navigate("technician_portal")
                                        UserRole.ADMIN -> navController.navigate("admin_dashboard")
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Verify OTP & Login", fontWeight = FontWeight.Bold)
                        }
                    } else if (selectedRole == UserRole.ADMIN) {
                        // ADMIN AUTHENTICATION
                        Text("HQ Administration Security Gate", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("Role-Based Access: Requires Master Administrative Passcode", fontSize = 11.sp, color = Color.Gray)

                        OutlinedTextField(
                            value = adminPasscode,
                            onValueChange = { adminPasscode = it },
                            label = { Text("Admin Security Passcode") },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text("Authorized Phone (+91)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            onClick = {
                                authViewModel.verifyAdminPasscode(adminPasscode, "+91 $phone") {
                                    navController.navigate("admin_dashboard")
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E3A8A)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Unlock Admin Console", fontWeight = FontWeight.Bold)
                        }
                    } else {
                        // CUSTOMER & PARTNER FORM
                        Text(
                            text = if (selectedRole == UserRole.CUSTOMER) {
                                if (isSignUp) "Customer Registration" else "Customer Sign In"
                            } else {
                                if (isSignUp) "Partner Trade & KYC Registration" else "Technician Partner Login"
                            },
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )

                        if (isSignUp) {
                            OutlinedTextField(
                                value = displayName,
                                onValueChange = { displayName = it },
                                label = { Text("Full Name") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = email,
                                onValueChange = { email = it },
                                label = { Text("Email Address") },
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = address,
                                onValueChange = { address = it },
                                label = { Text("Service Address") },
                                modifier = Modifier.fillMaxWidth()
                            )

                            Text("Operating City (शहर चुनें):", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
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

                            if (selectedRole == UserRole.TECHNICIAN) {
                                Text("Select Trade Services:", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    FilterChip(
                                        selected = tradeElectrician,
                                        onClick = { tradeElectrician = !tradeElectrician },
                                        label = { Text("Electrician") }
                                    )
                                    FilterChip(
                                        selected = tradePlumber,
                                        onClick = { tradePlumber = !tradePlumber },
                                        label = { Text("Plumber") }
                                    )
                                }
                                OutlinedTextField(
                                    value = kycNumber,
                                    onValueChange = { kycNumber = it },
                                    label = { Text("KYC Document Number (Aadhaar / Skill Cert)") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = upiId,
                                    onValueChange = { upiId = it },
                                    label = { Text("UPI ID for Instant Payouts") },
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }

                        OutlinedTextField(
                            value = phone,
                            onValueChange = { phone = it },
                            label = { Text("Indian Mobile Number (+91)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
                            Text("Remember logged-in session", fontSize = 12.sp, color = Color.Gray)
                        }

                        Button(
                            onClick = {
                                activity?.let { act ->
                                    authViewModel.sendOtp("+91 $phone", act)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Send Firebase Mobile OTP", fontWeight = FontWeight.Bold)
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
