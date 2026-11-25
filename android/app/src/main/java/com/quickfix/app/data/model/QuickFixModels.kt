package com.quickfix.app.data.model

data class ServiceItem(
    val id: String,
    val category: String, // Canonical ServiceCategoryType used by customer booking and partner dispatch
    val title: String,
    val hindiTitle: String? = null,
    val startingPrice: Int,
    val rating: Double,
    val warrantyDays: Int
)

data class BookingLineItem(
    val serviceId: String = "",
    val serviceTitle: String = "Service item",
    val quantity: Double = 0.0,
    val billingUnit: String = "",
    val lineTotalMinimum: Double = 0.0,
    val lineTotalMaximum: Double = 0.0,
    val materialsIncluded: Boolean = false
)

data class Booking(
    val id: String,
    val serviceTitle: String,
    val category: String,
    val customerName: String,
    val customerAddress: String,
    val status: String, // "requested", "assigned", "technician_en_route", "in_progress", "completed"
    val technicianName: String? = null,
    val startOtp: String = "",
    val price: Int = 199,
    val totalAmount: Int = 257,
    val technicianPayout: Int = 226,
    val adminCommission: Int = 31,
    val paymentStatus: String = "paid", // "paid", "pending", "refunded"
    val escrowStatus: String = "held_in_admin_escrow", // "held_in_admin_escrow", "released_to_technician", "refunded_to_customer"
    val refundAmount: Int = 0,
    val refundReason: String? = null,
    val customerLatitude: Double? = null,
    val customerLongitude: Double? = null,
    val lineItems: List<BookingLineItem> = emptyList()
)

data class CommissionSettings(
    val electricianCommissionPct: Int = 12,
    val plumberCommissionPct: Int = 15,
    val convenienceFee: Int = 29,
    val gstPct: Int = 18
)

data class AdminMasterPaymentConfig(
    val corporateEntity: String = "",
    val masterUpiVpa: String = "",
    val receivingBankName: String = "",
    val accountNumberMasked: String = "",
    val ifscCode: String = "",
    val accountHolderName: String = "",
    val gatewayProvider: String = "Not connected",
    val requireAdminPayoutApproval: Boolean = true,
    val escrowHoldUntilOtpVerified: Boolean = true,
    val tdsDeductionPct: Double = 0.0
)

data class PayoutRecord(
    val id: String,
    val technicianId: String,
    val technicianName: String,
    val amount: Int,
    val status: String, // "pending_approval", "held_in_escrow", "settled", "rejected"
    val requestedAt: String,
    val adminApprovalStatus: String = "pending", // "pending", "approved", "held", "rejected"
    val adminApprovedBy: String? = null,
    val adminNote: String? = null,
    val bankUtr: String? = null,
    val upiId: String
)
