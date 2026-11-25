package com.quickfix.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.quickfix.app.data.model.AuthState
import com.quickfix.app.ui.screens.*
import com.quickfix.app.viewmodel.AuthViewModel
import com.quickfix.app.viewmodel.QuickFixViewModel
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.quickfix.app.ui.screens.PartnerRechargePaymentResult
import com.quickfix.app.ui.screens.LocalQuickFixLanguage

class MainActivity : ComponentActivity(), PaymentResultWithDataListener {
    override fun onPaymentSuccess(razorpayPaymentID: String?, paymentData: PaymentData?) {
        val paymentId = razorpayPaymentID ?: paymentData?.paymentId
        val orderId = paymentData?.orderId
        val signature = paymentData?.signature
        if (!paymentId.isNullOrBlank() && !orderId.isNullOrBlank() && !signature.isNullOrBlank()) {
            PartnerRechargePaymentResult.success(paymentId, orderId, signature)
        } else {
            PartnerRechargePaymentResult.failure("Razorpay payment response incomplete; subscription not activated.")
        }
    }

    override fun onPaymentError(code: Int, response: String?, paymentData: PaymentData?) {
        PartnerRechargePaymentResult.failure(response ?: "Payment cancelled or failed (code $code).")
    }

    private val quickFixViewModel: QuickFixViewModel by viewModels()
    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val languageState = remember {
                mutableStateOf(getSharedPreferences("quickfix_preferences", MODE_PRIVATE).getString("app_language", "hi") ?: "hi")
            }
            CompositionLocalProvider(LocalQuickFixLanguage provides languageState) {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    QuickFixNavHost(
                        quickFixViewModel = quickFixViewModel,
                        authViewModel = authViewModel
                    )
                }
            }
            }
        }
    }
}

@Composable
fun QuickFixNavHost(
    quickFixViewModel: QuickFixViewModel,
    authViewModel: AuthViewModel
) {
    val navController = rememberNavController()
    val authState by authViewModel.authState.collectAsState()

    // Session restoration is asynchronous. Redirect after Firebase profile loading finishes;
    // otherwise the initial customer browsing route can remain visible for a signed-in partner.
    LaunchedEffect(authState) {
        val authenticated = authState as? AuthState.Authenticated ?: return@LaunchedEffect
        val destination = when (authenticated.user.role) {
            com.quickfix.app.data.model.UserRole.CUSTOMER -> "customer_home"
            com.quickfix.app.data.model.UserRole.CHANNEL_PARTNER,
            com.quickfix.app.data.model.UserRole.TECHNICIAN -> "technician_portal"
            com.quickfix.app.data.model.UserRole.ADMIN -> "admin_dashboard"
        }
        if (navController.currentDestination?.route != destination) {
            navController.navigate(destination) {
                popUpTo(navController.graph.startDestinationId) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    // Remember logged in users: if authenticated, start at appropriate screen, otherwise auth_screen
    val startDest = when (val state = authState) {
        is AuthState.Authenticated -> when (state.user.role) {
            com.quickfix.app.data.model.UserRole.CUSTOMER -> "customer_home"
            com.quickfix.app.data.model.UserRole.CHANNEL_PARTNER,
            com.quickfix.app.data.model.UserRole.TECHNICIAN -> "technician_portal"
            com.quickfix.app.data.model.UserRole.ADMIN -> "admin_dashboard"
        }
        else -> "customer_home" // Allows browsing services with auth gate for booking
    }

    NavHost(navController = navController, startDestination = startDest) {
        composable("customer_home") {
            CustomerHomeScreen(navController = navController, viewModel = quickFixViewModel)
        }
        composable("auth_screen") {
            AuthScreen(navController = navController, authViewModel = authViewModel)
        }
        composable("profile_screen") {
            val user = (authState as? AuthState.Authenticated)?.user
            if (user != null) {
                ProfileScreen(navController = navController, authViewModel = authViewModel, user = user)
            } else {
                AuthScreen(navController = navController, authViewModel = authViewModel)
            }
        }
        composable("service_booking/{serviceId}") { backStackEntry ->
            val serviceId = backStackEntry.arguments?.getString("serviceId") ?: ""
            // Authenticate before booking check
            if (authState !is AuthState.Authenticated) {
                AuthScreen(navController = navController, authViewModel = authViewModel)
            } else {
                ServiceBookingScreen(serviceId = serviceId, navController = navController, viewModel = quickFixViewModel)
            }
        }
        composable("live_tracking/{bookingId}") { backStackEntry ->
            val bookingId = backStackEntry.arguments?.getString("bookingId") ?: ""
            LiveTrackingScreen(bookingId = bookingId, navController = navController, viewModel = quickFixViewModel)
        }
        composable("technician_portal") {
            TechnicianScreen(navController = navController, viewModel = quickFixViewModel)
        }
        composable("admin_login") {
            AdminLoginScreen(navController = navController, authViewModel = authViewModel)
        }
        composable("admin_dashboard") {
            val user = (authState as? AuthState.Authenticated)?.user
            val isWhitelisted = user?.email?.trim()?.lowercase() in listOf("surajkaleshriya22@gmail.com", "ops.admin@quickfix.in")
            if (user?.role == com.quickfix.app.data.model.UserRole.ADMIN && isWhitelisted) {
                AdminDashboardScreen(navController = navController, viewModel = quickFixViewModel)
            } else {
                AdminLoginScreen(navController = navController, authViewModel = authViewModel)
            }
        }
    }
}
