package com.quickfix.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.quickfix.app.data.model.AuthState
import com.quickfix.app.data.model.User
import com.quickfix.app.data.model.UserRole
import com.quickfix.app.viewmodel.AuthViewModel

// Deep blue & dark slate styling for QuickFix HQ
private val DarkSlate950 = Color(0xFF020617)
private val DarkSlate900 = Color(0xFF0F172A)
private val Slate800 = Color(0xFF1E293B)
private val Slate700 = Color(0xFF334155)
private val BrandBlue = Color(0xFF2563EB)
private val BrandBlueLight = Color(0xFF3B82F6)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminLoginScreen(
    navController: NavController,
    authViewModel: AuthViewModel
) {
    val authState by authViewModel.authState.collectAsState()

    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var rememberMe by remember { mutableStateOf(true) }
    var localError by remember { mutableStateOf<String?>(null) }
    var failedCount by remember { mutableStateOf(0) }

    // If authenticated as admin, navigate directly to admin dashboard
    LaunchedEffect(authState) {
        if (authState is AuthState.Authenticated) {
            val user = (authState as AuthState.Authenticated).user
            if (user.role == UserRole.ADMIN) {
                navController.navigate("admin_dashboard") {
                    popUpTo("admin_login") { inclusive = true }
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "QuickFix Admin HQ",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 18.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.navigate("customer_home") }) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = "Back to Customer App",
                            tint = Color.White
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = DarkSlate950)
            )
        },
        containerColor = DarkSlate900
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Shield Icon & Subtitle
            Surface(
                modifier = Modifier.size(64.dp),
                shape = RoundedCornerShape(18.dp),
                color = BrandBlue.copy(alpha = 0.2f),
                border = androidx.compose.foundation.BorderStroke(1.dp, BrandBlue.copy(alpha = 0.5f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.Shield,
                        contentDescription = "Admin Shield",
                        tint = BrandBlueLight,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "Super Admin Gateway Lock",
                    color = Color.White,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold
                )
                Text(
                    "Zero-Trust Access: Restricted Exclusively to Whitelisted Admins",
                    color = Color(0xFF94A3B8),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Super Admin Whitelist Badge Card
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFF0F172A),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E3A8A))
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Authorized Super Admin Whitelist",
                            color = Color(0xFF93C5FD),
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                        Surface(
                            color = Color(0xFF10B981).copy(alpha = 0.2f),
                            shape = RoundedCornerShape(4.dp)
                        ) {
                            Text(
                                "STRICT LOCK",
                                color = Color(0xFF34D399),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    Text(
                        "Only Firebase accounts granted the admin security claim by the project administrator can access this console.",
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp
                    )

                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp),
                        color = DarkSlate950,
                        border = androidx.compose.foundation.BorderStroke(1.dp, Slate800)
                    ) {
                        Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text("1. surajkaleshriya22@gmail.com (Primary Super Admin Owner)", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace)
                            Text("2. ops.admin@quickfix.in (HQ Emergency Operations)", color = Color(0xFF94A3B8), fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }

            // Input Fields
            OutlinedTextField(
                value = email,
                onValueChange = {
                    email = it
                    localError = null
                },
                label = { Text("Whitelisted Admin Email") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = Color(0xFF64748B)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandBlue,
                    unfocusedBorderColor = Slate800,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedLabelColor = BrandBlueLight,
                    unfocusedLabelColor = Color(0xFF94A3B8)
                ),
                singleLine = true
            )

            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Registered Mobile Number") },
                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null, tint = Color(0xFF64748B)) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandBlue,
                    unfocusedBorderColor = Slate800,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedLabelColor = BrandBlueLight,
                    unfocusedLabelColor = Color(0xFF94A3B8)
                ),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone)
            )

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFF1E293B)
            ) {
                Text(
                    "Admin access is verified using Firebase Authentication and a server-issued admin claim. Static passcodes and PINs are not accepted.",
                    color = Color(0xFFBFDBFE),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(12.dp)
                )
            }

            // Remember Me
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = rememberMe,
                        onCheckedChange = { rememberMe = it },
                        colors = CheckboxDefaults.colors(checkedColor = BrandBlue)
                    )
                    Text("Remember Super Admin Session", color = Color(0xFFCBD5E1), fontSize = 11.sp)
                }
            }

            // Error Display
            val errorText = localError ?: (authState as? AuthState.Error)?.message
            if (errorText != null) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    color = Color(0xFF7F1D1D).copy(alpha = 0.5f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFDC2626))
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Error, contentDescription = null, tint = Color(0xFFF87171))
                        Text(errorText, color = Color(0xFFFECACA), fontSize = 11.sp, lineHeight = 15.sp)
                    }
                }
            }

            // Submit Button
            Button(
                onClick = {
                    val cleanEmail = email.trim().lowercase()
                    if (cleanEmail.isBlank()) {
                        localError = "Enter the email address of your signed-in Firebase administrator account."
                        return@Button
                    }

                    localError = null
                    authViewModel.verifyAdminPasscode(
                        email = cleanEmail,
                        passcode = "",
                        phone = phone,
                        onSuccess = {
                            navController.navigate("admin_dashboard") {
                                popUpTo("admin_login") { inclusive = true }
                            }
                        },
                        onError = { err ->
                            localError = err
                        }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("Authenticate & Unlock Admin HQ", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Icon(Icons.Default.ArrowForward, contentDescription = null)
                }
            }

            // Non-Admin info
            Text(
                "Non-admin accounts will be automatically rejected by the zero-trust gatekeeper.",
                color = Color(0xFF64748B),
                fontSize = 11.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}
