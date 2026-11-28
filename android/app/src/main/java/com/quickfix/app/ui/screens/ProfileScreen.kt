package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import com.quickfix.app.viewmodel.AuthViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    navController: NavController,
    authViewModel: AuthViewModel,
    user: User
) {
    val isEnglish = LocalQuickFixLanguage.current.value == "en"
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEnglish) "My KamXApp Account" else "मेरा KamXApp खाता", fontSize = 16.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = if (isEnglish) "Back" else "वापस जाएँ")
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
            // Profile Card
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                shadowElevation = 2.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF2563EB)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = user.displayName.take(1).ifEmpty { "Q" },
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Text(user.displayName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                    Text(user.phoneNumber, fontSize = 13.sp, color = Color.Gray)

                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = when (user.role) {
                            UserRole.ADMIN -> Color(0xFFFEE2E2)
                            UserRole.CHANNEL_PARTNER, UserRole.TECHNICIAN -> Color(0xFFDBEAFE)
                            UserRole.CUSTOMER -> Color(0xFFD1FAE5)
                        }
                    ) {
                        Text(
                            text = when (user.role) { UserRole.ADMIN -> if (isEnglish) "ADMIN" else "एडमिन"; UserRole.CHANNEL_PARTNER, UserRole.TECHNICIAN -> if (isEnglish) "CHANNEL PARTNER" else "चैनल पार्टनर"; UserRole.CUSTOMER -> if (isEnglish) "CUSTOMER" else "ग्राहक" },
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = when (user.role) {
                                UserRole.ADMIN -> Color(0xFF991B1B)
                                UserRole.CHANNEL_PARTNER, UserRole.TECHNICIAN -> Color(0xFF1E40AF)
                                UserRole.CUSTOMER -> Color(0xFF065F46)
                            }
                        )
                    }
                }
            }

            // User Info Details
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                shadowElevation = 1.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(if (isEnglish) "PROFILE DETAILS" else "प्रोफ़ाइल विवरण", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.Gray)

                    ProfileItemRow(icon = Icons.Default.Email, label = if (isEnglish) "Email" else "ईमेल", value = user.email.ifEmpty { if (isEnglish) "Not set" else "सेट नहीं है" })
                    ProfileItemRow(
                        icon = Icons.Default.Person,
                        label = if (isEnglish) "KamXApp ID" else "KamXApp आईडी",
                        value = user.quickFixId.ifEmpty { if (isEnglish) "ID not available — retry sign-in" else "आईडी उपलब्ध नहीं — दोबारा लॉगिन करें" }
                    )
                    ProfileItemRow(icon = Icons.Default.LocationOn, label = if (isEnglish) "Address" else "पता", value = user.address.ifEmpty { if (isEnglish) "Not set" else "सेट नहीं है" })
                    ProfileItemRow(icon = Icons.Default.Place, label = if (isEnglish) "City" else "शहर", value = user.city)

                    if (user.role == UserRole.CHANNEL_PARTNER || user.role == UserRole.TECHNICIAN) {
                        ProfileItemRow(icon = Icons.Default.Build, label = if (isEnglish) "Services" else "सेवाएँ", value = user.trades.joinToString(", "))
                        ProfileItemRow(icon = Icons.Default.CheckCircle, label = if (isEnglish) "KYC Status" else "KYC स्थिति", value = if (user.isVerified) { if (isEnglish) "Verified" else "सत्यापित" } else { if (isEnglish) "Pending Review" else "जाँच बाकी है" })
                    }
                }
            }

            if (user.role != UserRole.ADMIN) {
                EmergencyContactsSection(isEnglish = isEnglish)
            }

            // Logout Action
            Button(
                onClick = {
                    authViewModel.logout()
                    navController.navigate("auth_screen") {
                        popUpTo("customer_home") { inclusive = true }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.ExitToApp, contentDescription = if (isEnglish) "Sign out" else "लॉगआउट")
                Spacer(modifier = Modifier.width(8.dp))
                Text(if (isEnglish) "Sign Out of KamXApp" else "KamXApp से लॉगआउट करें", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun ProfileItemRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = label, tint = Color(0xFF2563EB), modifier = Modifier.size(20.dp))
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(label, fontSize = 10.sp, color = Color.Gray)
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color(0xFF1E293B))
        }
    }
}
