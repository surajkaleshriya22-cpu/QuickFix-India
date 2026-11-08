export type ServiceCategoryType = 'electrician' | 'plumber' | 'ac_repair' | 'fridge_repair';

export interface ServiceItem {
  id: string;
  category: ServiceCategoryType;
  title: string;
  hindiTitle?: string;
  description: string;
  startingPrice: number;
  durationMinutes: number;
  rating: number;
  reviewsCount: number;
  warrantyDays: number;
  badge?: string;
  included: string[];
}

export type BookingStatus = 
  | 'requested'
  | 'assigned'
  | 'technician_en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cash';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Booking {
  id: string;
  serviceId: string;
  serviceTitle: string;
  category: ServiceCategoryType;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  city: string;
  pincode: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  notes?: string;
  status: BookingStatus;
  technicianId?: string;
  technicianName?: string;
  technicianPhone?: string;
  technicianRating?: number;
  technicianAvatar?: string;
  technicianEtaMinutes?: number;
  technicianCurrentLocation?: { lat: number; lng: number };
  startOtp: string;
  price: number;
  visitingCharges: number;
  discount: number;
  taxes: number; // GST 18%
  totalAmount: number;
  commissionRate: number; // e.g. 15%
  adminCommission: number;
  technicianPayout: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashCommissionDeducted?: boolean;
  acceptedAt?: string;
  serviceDeadline?: string; // 1-hour SLA delivery deadline (acceptedAt + 60 mins)
  acceptanceCommissionDebited?: boolean;
  acceptanceCommissionAmount?: number;
  effectiveCommissionRate?: number;
  escrowStatus?: 'held_in_admin_escrow' | 'released_to_technician' | 'refunded_to_customer';
  refundReason?: string;
  refundedAt?: string;
  refundAmount?: number;
  transactionRef?: string;
  paidAt?: string;
  createdAt: string;
  review?: {
    rating: number;
    comment: string;
    tags: string[];
    createdAt: string;
    adminReply?: string;
  };
}

export interface WalletTransaction {
  id: string;
  technicianId: string;
  type: 'security_deposit' | 'topup' | 'cash_commission_deduction' | 'online_payout_credit' | 'withdrawal' | 'job_acceptance_commission' | 'payout_reversal';
  amount: number;
  balanceAfter: number;
  bookingId?: string;
  description: string;
  timestamp: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  email: string;
  trades: ServiceCategoryType[];
  experienceYears: number;
  city: string;
  rating: number;
  totalJobsCompleted: number;
  avatar: string;
  isOnline: boolean;
  isVerified: boolean;
  isSuspended?: boolean;
  customCommissionPct?: number; // Per-technician commission rate override set by Admin HQ
  kycDocType: 'Aadhaar' | 'PAN' | 'Skill India Certificate';
  kycDocNumber: string;
  qualificationType?: 'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma';
  qualificationRegNumber?: string;
  qualificationInstitute?: string;
  approvalStatus?: 'approved' | 'pending_audit' | 'rejected';
  rejectionReason?: string;
  walletBalance: number; // Current wallet balance (minimum ₹2000 required for duty)
  securityDepositRequired: number; // Mandatory ₹2,000 security reserve
  securityDepositPaid: boolean;
  withdrawableBalance: number; // walletBalance - 2000 (only balance above ₹2000 can be withdrawn)
  lifetimeCashCollected?: number;
  lifetimeCommissionPaid?: number;
  bankAccount: {
    accountNumber: string;
    ifsc: string;
    upiId: string;
  };
  todayEarnings: number;
  totalEarnings: number;
  pendingPayout: number;
  currentLocation?: {
    lat: number;
    lng: number;
    address?: string;
    zoneId?: string;
    zoneName?: string;
    distanceToCenterKm?: number;
    lastUpdated?: string;
  };
}

export interface ServiceZone {
  id: string;
  name: string;
  city: string;
  center: {
    lat: number;
    lng: number;
  };
  radiusKm: number;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  isActive: boolean;
  description?: string;
  coverageAreas?: string[];
  maxActiveTechnicians?: number;
  createdAt?: string;
}

export interface GeofenceValidationResult {
  allowed: boolean;
  insideZone?: ServiceZone | null;
  distanceKm: number;
  nearestZone?: ServiceZone | null;
  minDistanceToAllowedZoneKm: number;
  technicianLocation: {
    lat: number;
    lng: number;
    address?: string;
  };
  reason?: string;
}

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  status?: 'active' | 'suspended';
  totalBookings?: number;
  totalSpent?: number;
  addresses: {
    id: string;
    label: 'Home' | 'Work' | 'Other';
    addressLine: string;
    city: string;
    pincode: string;
  }[];
}

export interface CommissionSettings {
  electricianCommissionPct: number; // e.g. 12%
  plumberCommissionPct: number;     // e.g. 15%
  acCommissionPct: number;          // e.g. 15%
  fridgeCommissionPct: number;      // e.g. 15%
  minSecurityDeposit: number;       // ₹2,000 mandatory reserve
  platformConvenienceFee: number;   // e.g. ₹29
  gstPct: number;                   // 18%
  minPayoutThreshold: number;       // e.g. ₹500
}

export interface AdminMasterPaymentConfig {
  merchantName: string;
  merchantVpa: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  gatewayProvider: string;
  merchantId: string;
  escrowEnabled: boolean;
  manualApprovalRequired: boolean;
  payoutSchedule: 'instant_on_admin_approval' | 'daily_batch' | 'weekly';
  tdsDeductionPct: number;
}

export interface PayoutRecord {
  id: string;
  technicianId: string;
  technicianName: string;
  amount: number;
  upiId: string;
  status: 'pending' | 'processing' | 'settled' | 'failed' | 'on_hold' | 'rejected';
  adminApprovalStatus?: 'pending_approval' | 'approved_and_released' | 'held_by_admin' | 'rejected_by_admin';
  adminApprovedBy?: string;
  adminApprovedAt?: string;
  adminNote?: string;
  requestedAt: string;
  settledAt?: string;
  referenceNumber: string;
  providerEventId?: string;
  payoutProvider?: string;
  webhookConfirmedAt?: string;
  reversalTxnId?: string;
}

export type ActiveRole = 'customer' | 'technician' | 'admin';
export type UserRole = 'customer' | 'technician' | 'admin';

export interface AppUser {
  uid: string;
  phoneNumber: string;
  displayName: string;
  email: string;
  role: UserRole;
  address?: string;
  city: string;
  pincode?: string;
  // Partner specific fields
  trades?: ServiceCategoryType[];
  experienceYears?: number;
  kycDocType?: 'Aadhaar' | 'PAN' | 'Skill India Certificate';
  kycDocNumber?: string;
  qualificationType?: 'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma';
  qualificationRegNumber?: string;
  qualificationInstitute?: string;
  approvalStatus?: 'approved' | 'pending_audit' | 'rejected';
  isVerified?: boolean;
  customCommissionPct?: number;
  walletBalance?: number;
  securityDepositPaid?: boolean;
  withdrawableBalance?: number;
  upiId?: string;
  createdAt: string;
}

export interface AuthSession {
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  rememberMe: boolean;
}

export const AUTHORIZED_ADMIN_EMAILS = [
  'surajkaleshriya22@gmail.com', // Primary Owner & Super Administrator
  'ops.admin@quickfix.in'         // HQ Central Operations
] as const;

export const isAuthorizedAdminEmail = (email: string): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (AUTHORIZED_ADMIN_EMAILS as readonly string[]).includes(clean);
};
