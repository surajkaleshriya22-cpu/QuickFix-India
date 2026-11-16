import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Booking,
  BookingStatus,
  CommissionSettings,
  CustomerUser,
  PayoutRecord,
  PaymentMethod,
  PaymentStatus,
  ServiceCategoryType,
  ServiceItem,
  Technician,
  ActiveRole,
  AppUser,
  UserRole,
  AdminMasterPaymentConfig,
  WalletTransaction,
  ServiceZone,
  GeofenceValidationResult
} from '../types';
import { isAuthorizedAdminEmail } from '../types';
import {
  CURRENT_CUSTOMER,
  INITIAL_COMMISSION_SETTINGS,
  INITIAL_SERVICES,
  INITIAL_ADMIN_PAYMENT_CONFIG
} from '../data/mockData';
import { INITIAL_SERVICE_ZONES, calculateBoundingBox } from '../data/serviceZones';
import {
  seedServiceZonesIfEmpty,
  calculateHaversineDistanceKm,
  updateTechnicianFirestoreStatus
} from '../services/geofenceService';
import { auth, db, testFirestoreConnection } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp, collection } from 'firebase/firestore';
import { getIdTokenResult, signOut, User as FirebaseUser } from 'firebase/auth';

interface QuickFixContextType {
  // Role & View Mode
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  viewMode: 'phone' | 'fullscreen';
  setViewMode: (mode: 'phone' | 'fullscreen') => void;
  showCodeInspector: boolean;
  setShowCodeInspector: (show: boolean) => void;
  showFirebaseConfig: boolean;
  setShowFirebaseConfig: (show: boolean) => void;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  showProfileDrawer: boolean;
  setShowProfileDrawer: (show: boolean) => void;

  // Authentication & Profile
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  authenticateFirebaseCustomer: (params: { firebaseUser: FirebaseUser; displayName: string; email: string; address?: string; city: string; rememberMe: boolean }) => Promise<{ success: boolean; message?: string }>;
  authenticateUser: (params: {
    displayName: string;
    phoneNumber: string;
    email: string;
    role: UserRole;
    address?: string;
    city: string;
    trades?: ServiceCategoryType[];
    rememberMe: boolean;
  }) => { success: boolean; message?: string };
  authenticateVerifiedAdmin: (params: {
    displayName: string;
    phoneNumber: string;
    email: string;
    city: string;
  }) => Promise<{ success: boolean; message?: string }>;
  registerNewPartner: (params: {
    displayName: string;
    phoneNumber: string;
    email: string;
    trades: ServiceCategoryType[];
    experienceYears: number;
    city: string;
    address?: string;
    rememberMe: boolean;
  }) => Promise<{ success: boolean; message?: string }>;
  logoutUser: () => Promise<void>;
  updateCustomerAddress: (newAddr: {
    label: 'Home' | 'Work' | 'Other';
    addressLine: string;
    city: string;
    pincode: string;
  }) => void;

  // City & Services
  currentCity: string;
  setCurrentCity: (city: string) => void;
  services: ServiceItem[];
  selectedCategory: 'all' | ServiceCategoryType;
  setSelectedCategory: (cat: 'all' | ServiceCategoryType) => void;

  // Customer State & Backward Compatibility
  customer: CustomerUser;
  isCustomerLoggedIn: boolean;
  loginCustomer: (phone: string, name?: string) => void;
  registerCustomer: (name: string, phone: string, email: string, address: string) => void;
  logoutCustomer: () => void;

  // Bookings
  bookings: Booking[];
  activeBookingId: string | null;
  setActiveBookingId: (id: string | null) => void;
  createBooking: (params: {
    serviceId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
    address: string;
    notes?: string;
    paymentMethod: PaymentMethod;
  }) => Booking;
  submitCustomerBooking: (params: { serviceId: string; scheduledDate: string; scheduledTimeSlot: string; address: string; notes?: string; paymentMethod: PaymentMethod }) => Promise<{ success: boolean; bookingId?: string; message?: string }>;
  updateBookingStatus: (bookingId: string, status: BookingStatus, otpProvided?: string) => { success: boolean; message?: string };
  addReview: (bookingId: string, rating: number, comment: string, tags: string[]) => void;

  // Technicians & Partner App
  technicians: Technician[];
  currentTechnician: Technician;
  isTechnicianLoggedIn: boolean;
  loginTechnician: (phone: string) => boolean;
  registerTechnician: (data: {
    name: string;
    phone: string;
    email: string;
    trades: ServiceCategoryType[];
    experienceYears: number;
    city: string;
    qualificationType?: 'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma';
    qualificationRegNumber?: string;
    qualificationInstitute?: string;
    kycDocType: 'Aadhaar' | 'PAN' | 'Skill India Certificate';
    kycDocNumber: string;
    upiId: string;
    initialDepositAmount?: number;
  }) => Promise<{ success: boolean; message?: string }>;
  logoutTechnician: () => void;
  serviceZones: ServiceZone[];
  toggleTechnicianOnline: (
    techId: string,
    coords?: { lat: number; lng: number }
  ) => { success: boolean; message?: string; requiresGeofence?: boolean; validation?: GeofenceValidationResult };
  validateAndSetTechnicianOnline: (
    techId: string,
    locationData: { lat: number; lng: number; zoneId: string; zoneName: string; distanceToCenterKm: number }
  ) => Promise<{ success: boolean; message: string }>;
  updateServiceZoneRadius: (zoneId: string, newRadiusKm: number) => { success: boolean; message: string };
  toggleServiceZoneActive: (zoneId: string) => { success: boolean; message: string };
  approveTechnicianKyc: (techId: string) => void;
  rejectTechnicianKyc: (techId: string) => void;
  approveTechnicianQualification: (techId: string) => void;
  rejectTechnicianQualification: (techId: string, reason?: string) => void;
  updateTechnicianCustomCommission: (technicianId: string, commissionPct: number | null) => { success: boolean; message: string };

  // Admin Payment Control & Escrow
  adminPaymentConfig: AdminMasterPaymentConfig;
  updateAdminPaymentConfig: (config: Partial<AdminMasterPaymentConfig>) => void;
  adminApprovePayout: (payoutId: string) => { success: boolean; message: string };
  adminHoldPayout: (payoutId: string, reason: string) => { success: boolean; message: string };
  adminRejectPayout: (payoutId: string, reason: string) => { success: boolean; message: string };
  confirmPayoutSettlementWebhook: (payoutId: string, providerEventId: string, gatewayProvider?: string) => { success: boolean; message: string };
  adminIssueCustomerRefund: (bookingId: string, amount?: number, reason?: string) => { success: boolean; message: string };

  // Admin & Commissions & Partner Wallet
  commissionSettings: CommissionSettings;
  updateCommissionSettings: (settings: Partial<CommissionSettings>) => void;
  payouts: PayoutRecord[];
  requestPayout: (technicianId: string, amount: number) => { success: boolean; message: string };
  processPayout: (payoutId: string) => void;
  disbursePayout: (payoutId: string) => void;
  walletTransactions: WalletTransaction[];
  topupTechnicianWallet: (technicianId: string, amount: number) => { success: boolean; message: string };
  adminWalletBalance: number;

  // Admin Extended Management
  customers: CustomerUser[];
  deleteCustomer: (customerId: string) => void;
  toggleCustomerStatus: (customerId: string) => void;
  reassignBookingTechnician: (bookingId: string, technicianId: string) => void;
  deleteBooking: (bookingId: string) => void;
  toggleTechnicianSuspension: (techId: string) => void;
  updateTechnicianRating: (techId: string, newRating: number) => void;
  addCustomerReviewReply: (bookingId: string, reply: string) => void;
  deleteReview: (bookingId: string) => void;
  updateBookingPaymentStatus: (bookingId: string, status: PaymentStatus, transactionRef?: string) => void;
  firestoreSyncStatus: { isConnected: boolean; lastSynced: string; latencyMs: number };
  triggerFirestoreSync: () => Promise<void>;
}

const QuickFixContext = createContext<QuickFixContextType | undefined>(undefined);

const LOCAL_STORAGE_AUTH_KEY = 'quickfix_auth_session';

export const QuickFixProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation & Role State
  const [activeRole, setActiveRole] = useState<ActiveRole>('customer');
  const [viewMode, setViewMode] = useState<'phone' | 'fullscreen'>('phone');
  const [showCodeInspector, setShowCodeInspector] = useState(false);
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  // Localization & Services
  const [currentCity, setCurrentCity] = useState('Bengaluru');
  const [services] = useState<ServiceItem[]>(INITIAL_SERVICES);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ServiceCategoryType>('all');

  // Unified Firebase Auth Session state
  // Local storage is not an authentication authority. Sessions must be re-established
  // by Firebase Authentication; in particular, never restore a client-stored admin role.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Customer State
  const [customer, setCustomer] = useState<CustomerUser>(CURRENT_CUSTOMER);
  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(false);

  // Technicians State
  // No sample partner records are loaded into the live admin or partner state.
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [currentTechnician, setCurrentTechnician] = useState<Technician>({
    id: '',
    name: '',
    phone: '',
    email: '',
    trades: [],
    experienceYears: 0,
    city: '',
    rating: 0,
    totalJobsCompleted: 0,
    avatar: '',
    isOnline: false,
    isVerified: false,
    kycDocType: 'PAN',
    kycDocNumber: '',
    walletBalance: 0,
    securityDepositRequired: 2000,
    securityDepositPaid: false,
    withdrawableBalance: 0,
    bankAccount: { accountNumber: '', ifsc: '', upiId: '' },
    todayEarnings: 0,
    totalEarnings: 0,
    pendingPayout: 0
  });
  const [isTechnicianLoggedIn, setIsTechnicianLoggedIn] = useState(false);

  // Commissions & Payouts & Admin Gateway Control
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>(INITIAL_COMMISSION_SETTINGS);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [adminPaymentConfig, setAdminPaymentConfig] = useState<AdminMasterPaymentConfig>({
    ...INITIAL_ADMIN_PAYMENT_CONFIG,
    merchantName: 'Payment account not configured',
    merchantVpa: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    gatewayProvider: 'Not configured',
    merchantId: '',
    escrowEnabled: false
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [adminWalletBalance, setAdminWalletBalance] = useState<number>(0);
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>(INITIAL_SERVICE_ZONES);

  // Initialize service zones from Firestore / seed defaults on boot
  useEffect(() => {
    seedServiceZonesIfEmpty().then((zones) => {
      if (zones && zones.length > 0) {
        setServiceZones(zones);
      }
    });
  }, []);

  // Bookings State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  // Sync customer details when currentUser changes
  useEffect(() => {
    if (currentUser && currentUser.role === 'customer') {
      setCustomer(prev => ({
        ...prev,
        name: currentUser.displayName,
        phone: currentUser.phoneNumber,
        email: currentUser.email,
        addresses: currentUser.address
          ? [
              {
                id: 'addr-main',
                label: 'Home',
                addressLine: currentUser.address,
                city: currentUser.city,
                pincode: currentUser.pincode || '560034'
              },
              ...prev.addresses.filter(a => a.label !== 'Home')
            ]
          : prev.addresses
      }));
    }
  }, [currentUser]);

  // Authentication Methods
  const authenticateFirebaseCustomer = async ({ firebaseUser, displayName, email, address, city, rememberMe }: { firebaseUser: FirebaseUser; displayName: string; email: string; address?: string; city: string; rememberMe: boolean }): Promise<{ success: boolean; message?: string }> => {
    try {
      const profileRef = doc(db, 'users', firebaseUser.uid);
      const existing = await getDoc(profileRef);
      if (existing.exists()) {
        const data = existing.data();
        if (data.role !== 'CUSTOMER' || data.isVerified !== false) {
          return { success: false, message: 'This phone number is not registered as a customer account. Please contact support.' };
        }
      } else {
        const profile: Record<string, unknown> = {
          uid: firebaseUser.uid,
          phoneNumber: firebaseUser.phoneNumber || '',
          displayName: displayName.trim() || 'QuickFix Customer',
          email: email.trim(),
          role: 'CUSTOMER',
          isVerified: false,
          // Firestore rules require a native timestamp, not an ISO string.
          createdAt: Timestamp.now()
        };
        if (address?.trim()) profile.address = address.trim();
        if (city.trim()) profile.city = city.trim();
        await setDoc(profileRef, profile);
      }

      const userObj: AppUser = {
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber || '',
        displayName: displayName.trim() || firebaseUser.displayName || 'QuickFix Customer',
        email: email.trim() || firebaseUser.email || '',
        role: 'customer',
        address: address?.trim() || undefined,
        city,
        createdAt: new Date().toISOString()
      };
      setCurrentUser(userObj);
      setIsAuthenticated(true);
      setIsCustomerLoggedIn(true);
      setCustomer(prev => ({
        ...prev,
        id: firebaseUser.uid,
        name: userObj.displayName,
        phone: userObj.phoneNumber,
        email: userObj.email,
        addresses: address?.trim() ? [{ id: 'addr-main', label: 'Home', addressLine: address.trim(), city, pincode: '560034' }, ...prev.addresses.filter(a => a.label !== 'Home')] : prev.addresses
      }));
      if (rememberMe) localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(userObj));
      else localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      setActiveRole('customer');
      return { success: true };
    } catch (error: any) {
      const code = typeof error?.code === 'string' ? error.code : 'unknown';
      // Log only the Firebase error code; never log phone numbers or profile data.
      console.warn('Firebase customer profile save failed:', code);
      const messages: Record<string, string> = {
        'permission-denied': 'Phone verified, but Firestore denied saving your profile. The latest firestore.rules must be published to the quickfix-india Firebase project.',
        'unauthenticated': 'Phone verified, but Firebase no longer sees an authenticated session. Refresh and sign in again.',
        'unavailable': 'Phone verified, but Firestore is temporarily unavailable. Check your internet and try again.',
        'already-exists': 'A profile already exists for this account. Sign out and sign in again.',
        'failed-precondition': 'Phone verified, but Firestore is not ready. Check that the default Firestore database exists.'
      };
      return {
        success: false,
        message: messages[code] || `Phone verified, but the customer profile could not be saved (Firestore: ${code}). Please retry; if it continues, share only this error code.`
      };
    }
  };

  const authenticateUser = (_params: {
    displayName: string;
    phoneNumber: string;
    email: string;
    role: UserRole;
    address?: string;
    city: string;
    trades?: ServiceCategoryType[];
    rememberMe: boolean;
  }): { success: boolean; message?: string } => ({
    success: false,
    message: 'Legacy demo sign-in is disabled. Use the verified Firebase customer or admin sign-in flow; no local-only session was created.'
  });

  const authenticateVerifiedAdmin = async ({
    displayName,
    phoneNumber,
    email,
    city
  }: {
    displayName: string;
    phoneNumber: string;
    email: string;
    city: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return { success: false, message: 'Firebase sign-in is required before admin access.' };
    }

    try {
      const tokenResult = await getIdTokenResult(firebaseUser, true);
      const verifiedEmail = (tokenResult.claims.email as string | undefined) || firebaseUser.email || '';
      if (
        tokenResult.claims.admin !== true ||
        verifiedEmail.trim().toLowerCase() !== email.trim().toLowerCase() ||
        !isAuthorizedAdminEmail(verifiedEmail)
      ) {
        return { success: false, message: 'Admin access denied: a server-issued admin claim and authorized email are required.' };
      }

      const adminUser: AppUser = {
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber || phoneNumber,
        displayName: firebaseUser.displayName || displayName,
        email: verifiedEmail,
        role: 'admin',
        city,
        createdAt: new Date().toISOString()
      };

      setCurrentUser(adminUser);
      setIsAuthenticated(true);
      setActiveRole('admin');
      // Firebase Authentication persistence is authoritative; never restore an admin role from localStorage.
      return { success: true };
    } catch (error) {
      console.warn('Firebase admin claim verification failed:', error);
      return { success: false, message: 'Unable to verify the Firebase administrator session.' };
    }
  };

  const registerNewPartner: QuickFixContextType['registerNewPartner'] = async (params) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return { success: false, message: 'Please verify your mobile number with Firebase OTP first.' };
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const response = await fetch('/api/partners/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          displayName: params.displayName,
          email: params.email,
          trades: params.trades,
          experienceYears: params.experienceYears,
          city: params.city,
          address: params.address || ''
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) return { success: false, message: result.error || 'Partner registration could not be completed.' };
      const partnerUser: AppUser = {
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber || params.phoneNumber,
        displayName: params.displayName.trim(),
        email: params.email.trim().toLowerCase(),
        role: 'technician',
        city: params.city.trim(),
        address: params.address?.trim() || '',
        trades: params.trades,
        experienceYears: params.experienceYears,
        approvalStatus: 'pending_audit',
        isVerified: false,
        createdAt: new Date().toISOString()
      };
      setCurrentUser(partnerUser);
      setIsAuthenticated(true);
      setIsTechnicianLoggedIn(false);
      setActiveRole('technician');
      return { success: true, message: result.message || 'Basic partner profile created. KYC approval is pending.' };
    } catch (error) {
      console.warn('Secure partner registration request failed:', error);
      return { success: false, message: 'Network or server error. Your partner profile was not confirmed; please try again.' };
    }
  };

  const logoutUser = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn('Firebase sign-out failed:', error);
      throw error;
    } finally {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsCustomerLoggedIn(false);
      setIsTechnicianLoggedIn(false);
      try {
        localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      } catch {
        // ignore
      }
    }
  };

  const updateCustomerAddress = (newAddr: {
    label: 'Home' | 'Work' | 'Other';
    addressLine: string;
    city: string;
    pincode: string;
  }) => {
    const item = {
      id: `addr-${Date.now()}`,
      ...newAddr
    };
    setCustomer(prev => ({
      ...prev,
      addresses: [item, ...prev.addresses]
    }));
    if (currentUser) {
      const updated = { ...currentUser, address: newAddr.addressLine };
      setCurrentUser(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  // Backward-compatible Customer Auth
  const loginCustomer = (_phone: string, _name?: string) => {
    // Legacy local-only sign-in is disabled; Firebase Authentication is required.
    setIsCustomerLoggedIn(false);
  };

  const registerCustomer = (_name: string, _phone: string, _email: string, _address: string) => {
    // Legacy local-only registration is disabled; no local customer account is created.
    setIsCustomerLoggedIn(false);
  };

  const logoutCustomer = () => {
    setIsCustomerLoggedIn(false);
  };

  // Technician Auth
  const loginTechnician = (_phone: string) => {
    // Partner authentication must be backed by Firebase identity and a
    // server-verified partner record. Never authenticate against mock data.
    setIsTechnicianLoggedIn(false);
    return false;
  };

  const registerTechnician = async (data: {
    name: string;
    phone: string;
    email: string;
    trades: ServiceCategoryType[];
    experienceYears: number;
    city: string;
    qualificationType?: 'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma';
    qualificationRegNumber?: string;
    qualificationInstitute?: string;
    kycDocType: 'Aadhaar' | 'PAN' | 'Skill India Certificate';
    kycDocNumber: string;
    upiId: string;
    initialDepositAmount?: number;
  }): Promise<{ success: boolean; message?: string }> => {
    // Legacy adapter: KYC identifiers, certificate numbers, UPI and deposits are not sent.
    return registerNewPartner({
      displayName: data.name,
      phoneNumber: data.phone,
      email: data.email,
      trades: data.trades,
      experienceYears: data.experienceYears,
      city: data.city,
      rememberMe: true
    });
  };

  const logoutTechnician = () => {
    setIsTechnicianLoggedIn(false);
  };

  const toggleTechnicianOnline = (
    _techId: string,
    _coords?: { lat: number; lng: number }
  ): { success: boolean; message?: string; requiresGeofence?: boolean; validation?: GeofenceValidationResult } => ({
    success: false,
    message: 'Partner online status is disabled until trusted server-side identity, verification, wallet reserve and GPS checks are deployed.'
  });

  const validateAndSetTechnicianOnline = async (
    _techId: string,
    _locationData: { lat: number; lng: number; zoneId: string; zoneName: string; distanceToCenterKm: number }
  ): Promise<{ success: boolean; message: string }> => ({
    success: false,
    message: 'GPS verification cannot activate a partner from the client. Trusted server-side verification is not configured.'
  });

  const updateServiceZoneRadius = (_zoneId: string, _newRadiusKm: number): { success: boolean; message: string } => ({
    success: false,
    message: 'Service-zone radius changes require trusted server-side admin authorization. No zone setting was changed.'
  });

  const toggleServiceZoneActive = (_zoneId: string): { success: boolean; message: string } => ({
    success: false,
    message: 'Service-zone changes require trusted server-side admin authorization. No zone setting was changed.'
  });

  const approveTechnicianQualification = (_techId: string) => {
    console.warn('KYC approval is disabled: document review and server-side admin authorization are not configured. No partner was verified.');
  };

  const rejectTechnicianQualification = (_techId: string, _reason?: string) => {
    console.warn('KYC rejection is disabled until trusted server-side admin authorization and an audit trail are configured. No partner record changed.');
  };

  const approveTechnicianKyc = (techId: string) => {
    approveTechnicianQualification(techId);
  };

  const rejectTechnicianKyc = (techId: string) => {
    rejectTechnicianQualification(techId);
  };

  // Admin Custom Commission Override Per Service Provider
  const updateTechnicianCustomCommission = (_technicianId: string, _commissionPct: number | null): { success: boolean; message: string } => ({
    success: false,
    message: 'Partner commission changes require trusted server-side admin authorization and audit logging. No rate was changed.'
  });

  // Commission & Payouts & Admin Payment Control
  const updateCommissionSettings = (_newSettings: Partial<CommissionSettings>) => {
    console.warn('Commission changes are disabled: trusted server-side admin authorization and audit logging are not configured. No settings changed.');
  };

  const updateAdminPaymentConfig = (_config: Partial<AdminMasterPaymentConfig>) => {
    console.warn('Payment configuration changes are disabled until a trusted server-side admin workflow is deployed. No settings changed.');
  };

  // Technician requests payout -> Held in Admin Escrow awaiting Admin Approval
  // Strict Enforcement: Cannot withdraw the mandatory ₹2,000 security reserve. Can ONLY withdraw amount above ₹2,000!
  const requestPayout = (_technicianId: string, _amount: number): { success: boolean; message: string } => {
    return {
      success: false,
      message: 'Payout requests are temporarily disabled until the secure server-side wallet ledger and payment provider are configured. No funds have been reserved or transferred.'
    };
  };

  const topupTechnicianWallet = (_technicianId: string, _amount: number): { success: boolean; message: string } => {
    return {
      success: false,
      message: 'Wallet top-ups are not enabled yet. Connect a verified payment provider and server-side ledger first. No wallet balance has been changed.'
    };
  };

  // Admin approves payout: marks as 'processing' awaiting payment provider webhook confirmation
  // CRITICAL: Does NOT mark settled immediately and does NOT generate fake UTRs
  const adminApprovePayout = (_payoutId: string): { success: boolean; message: string } => ({
    success: false,
    message: 'Payout release is disabled until a trusted server-side payment integration is deployed. No payout was approved or sent.'
  });

  const adminHoldPayout = (_payoutId: string, _reason: string): { success: boolean; message: string } => ({
    success: false,
    message: 'Payout hold changes require the trusted server-side audit workflow. No payout record was changed.'
  });

  // Admin rejects payout: strictly restores the reserved amount to the technician's wallet balance
  const adminRejectPayout = (_payoutId: string, _reason: string): { success: boolean; message: string } => ({
    success: false,
    message: 'Payout rejection and wallet reversal require an atomic server-side ledger transaction. No wallet balance was changed.'
  });

  // Payment Provider Webhook Confirmation: Only this marks payout as 'settled'
  const confirmPayoutSettlementWebhook = (
    _payoutId: string,
    _providerEventId: string,
    _gatewayProvider = 'Verified Payment Webhook'
  ): { success: boolean; message: string } => ({
    success: false,
    message: 'A browser or Android client cannot verify a payment webhook. Only the server can validate the provider signature and settle a payout.'
  });

  const adminIssueCustomerRefund = (
    _bookingId: string,
    _amount?: number,
    _reason?: string
  ): { success: boolean; message: string } => ({
    success: false,
    message: 'Refunds are disabled until a verified payment-provider refund API and server-side audit trail are configured. No refund was sent.'
  });

  const processPayout = (payoutId: string) => {
    adminApprovePayout(payoutId);
  };

  // Create Booking
  const createBooking = ({
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
    address,
    notes,
    paymentMethod
  }: {
    serviceId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
    address: string;
    notes?: string;
    paymentMethod: PaymentMethod;
  }): Booking => {
    const service = services.find(s => s.id === serviceId) || services[0];
    
    const cityPincodes: Record<string, string> = {
      'Indore': '452001',
      'Bhopal': '462016',
      'Ujjain': '456010',
      'Dewas': '455001',
      'Bengaluru': '560034',
      'Mumbai': '400053',
      'Delhi-NCR': '110048',
      'Hyderabad': '500033'
    };

    // Assignment is performed only by the trusted backend after partner
    // availability, verification, wallet and service-area checks.
    const visitingCharges = commissionSettings.platformConvenienceFee;
    const price = service.startingPrice;
    const discount = 20;
    const taxableSubtotal = price + visitingCharges - discount;
    const taxes = Math.round((taxableSubtotal * commissionSettings.gstPct) / 100);
    const totalAmount = taxableSubtotal + taxes;

    const categoryCommissionPct =
      service.category === 'electrician'
        ? commissionSettings.electricianCommissionPct
        : service.category === 'plumber'
        ? commissionSettings.plumberCommissionPct
        : service.category === 'ac_repair'
        ? (commissionSettings.acCommissionPct || 15)
        : (commissionSettings.fridgeCommissionPct || 15);

    // Partner-specific commission overrides are applied by the trusted backend
    // after a real partner has been assigned.
    const commissionPct = categoryCommissionPct;

    const adminCommission = Math.round((price * commissionPct) / 100) + visitingCharges;
    const technicianPayout = totalAmount - adminCommission;

    const newBookingId = `QF-${Math.floor(7050 + Math.random() * 900)}`;

    const newBooking: Booking = {
      id: newBookingId,
      serviceId: service.id,
      serviceTitle: service.title,
      category: service.category,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: address,
      city: currentCity,
      pincode: cityPincodes[currentCity] || '452001',
      scheduledDate,
      scheduledTimeSlot,
      notes,
      status: 'requested',
      startOtp: '',
      price,
      visitingCharges,
      discount,
      taxes,
      totalAmount,
      commissionRate: commissionPct,
      effectiveCommissionRate: commissionPct,
      adminCommission,
      technicianPayout,
      paymentMethod,
      // A booking is never marked paid by choosing UPI; only a verified gateway
      // webhook may confirm payment.
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    setBookings(prev => [newBooking, ...prev]);
    setActiveBookingId(newBooking.id);
    return newBooking;
  };

  // Persist a safe customer booking request. Assignment, OTP, payment and wallet
  // transitions remain server-owned; selecting UPI/cash never collects money.
  const submitCustomerBooking = async ({
    serviceId,
    scheduledDate,
    scheduledTimeSlot,
    address,
    notes,
    paymentMethod
  }: {
    serviceId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
    address: string;
    notes?: string;
    paymentMethod: PaymentMethod;
  }): Promise<{ success: boolean; bookingId?: string; message?: string }> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !isAuthenticated || currentUser?.role !== 'customer' || currentUser.uid !== firebaseUser.uid) {
      return { success: false, message: 'Please sign in with your verified customer account before booking.' };
    }
    if (!address.trim() || !scheduledDate.trim() || !scheduledTimeSlot.trim()) {
      return { success: false, message: 'Please select a service date, time slot and complete address.' };
    }
    const service = services.find(item => item.id === serviceId);
    if (!service) return { success: false, message: 'Selected service was not found. Please choose it again.' };

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          serviceId,
          scheduledDate,
          scheduledTimeSlot,
          address: address.trim(),
          notes: (notes || '').trim().slice(0, 500),
          paymentMethod
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.bookingId) {
        return { success: false, message: result.error || 'Secure booking could not be created. Please retry.' };
      }
      setActiveBookingId(result.bookingId);
      return { success: true, bookingId: result.bookingId };
    } catch (error: any) {
      console.warn('Customer booking request failed:', error?.message || error);
      return { success: false, message: 'Secure booking service is unavailable. Please check your internet and retry.' };
    }
  };

  // Update Booking Status & Handle Real-Time Wallet / Commission Settlements
  const updateBookingStatus = (
    bookingId: string,
    newStatus: BookingStatus,
    otpProvided?: string
  ): { success: boolean; message?: string } => {
    const requestedStatus: string = newStatus;
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found' };

    // Partner lifecycle transitions must be performed by a trusted server.
    // Client-side wallet deductions, OTP checks, and payment settlement are not authoritative.
    if (requestedStatus === 'technician_en_route' || requestedStatus === 'in_progress' || requestedStatus === 'completed') {
      return {
        success: false,
        message: 'This booking action is temporarily unavailable until secure server-side booking, OTP, and wallet processing is deployed. No booking status or funds were changed.'
      };
    }

    if (requestedStatus === 'in_progress') {
      if (!otpProvided || otpProvided.trim().length !== 4 || otpProvided.trim() !== booking.startOtp) {
        return { success: false, message: 'A valid 4-digit customer start OTP is required. No booking status was changed.' };
      }
    }

    const now = new Date().toISOString();
    const techId = booking.technicianId || currentTechnician.id;
    const tech = technicians.find(t => t.id === techId) || (currentTechnician.id === techId ? currentTechnician : null);

    // GATE 1: Service notification acceptance validation
    // Occurs when booking moves from unaccepted state (requested/assigned) to accepted (technician_en_route or in_progress)
    const isAcceptingJob = (requestedStatus === 'technician_en_route' || requestedStatus === 'in_progress') &&
      (booking.status === 'requested' || booking.status === 'assigned');

    if (isAcceptingJob && tech) {
      const currentTechBal = tech.walletBalance ?? 0;

      // REQUIREMENT 3: Service provider cannot accept service notification if wallet balance < 1000
      if (currentTechBal < 1000) {
        return {
          success: false,
          message: `Service Notification Acceptance Blocked: Service provider must maintain a minimum wallet balance of ₹1,000 to accept booking notifications. Current balance is ₹${currentTechBal}. Please recharge/top up your wallet.`
        };
      }

      // REQUIREMENT 2: Immediate commission auto-debit on acceptance (non-refundable irrespective of visit)
      if (!booking.acceptanceCommissionDebited) {
        const effectivePct = (typeof tech.customCommissionPct === 'number')
          ? tech.customCommissionPct
          : (booking.effectiveCommissionRate || booking.commissionRate);

        const commissionAmount = Math.round((booking.price * effectivePct) / 100) + booking.visitingCharges;
        const newBal = currentTechBal - commissionAmount;
        const isDepositMet = newBal >= 2000;
        const newWithdrawable = Math.max(0, newBal - 2000);

        // Deduct from technician's wallet
        setTechnicians(prev =>
          prev.map(t =>
            t.id === tech.id
              ? {
                  ...t,
                  walletBalance: newBal,
                  securityDepositPaid: isDepositMet,
                  withdrawableBalance: newWithdrawable,
                  lifetimeCommissionPaid: (t.lifetimeCommissionPaid ?? 0) + commissionAmount
                }
              : t
          )
        );

        if (currentTechnician.id === tech.id) {
          setCurrentTechnician(prev => ({
            ...prev,
            walletBalance: newBal,
            securityDepositPaid: isDepositMet,
            withdrawableBalance: newWithdrawable,
            lifetimeCommissionPaid: (prev.lifetimeCommissionPaid ?? 0) + commissionAmount
          }));
        }

        // Credit to Admin Platform Wallet
        setAdminWalletBalance(prev => prev + commissionAmount);

        // Record immediate acceptance auto-debit transaction
        const acceptTxn: WalletTransaction = {
          id: `TXN-W${Date.now().toString().slice(-6)}`,
          technicianId: tech.id,
          type: 'job_acceptance_commission',
          amount: commissionAmount,
          balanceAfter: newBal,
          bookingId: booking.id,
          description: `Platform commission auto-debited on accepting Service Notification #${booking.id} (${booking.serviceTitle} · 1-Hour SLA Limit)`,
          timestamp: now
        };
        setWalletTransactions(prev => [acceptTxn, ...prev]);

        // REQUIREMENT 1: 1-Hour Delivery SLA Deadline
        const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();

        setBookings(prev =>
          prev.map(b => {
            if (b.id !== bookingId) return b;
            return {
              ...b,
              status: newStatus,
              acceptedAt: now,
              serviceDeadline: deadline,
              acceptanceCommissionDebited: true,
              acceptanceCommissionAmount: commissionAmount,
              effectiveCommissionRate: effectivePct,
              commissionRate: effectivePct,
              adminCommission: commissionAmount,
              technicianPayout: b.totalAmount - commissionAmount
            };
          })
        );

        return { success: true };
      }
    }

    setBookings(prev =>
      prev.map(b => {
        if (b.id !== bookingId) return b;
        const updated: Booking = {
          ...b,
          status: newStatus,
          paymentStatus: b.paymentStatus,
          cashCommissionDeducted: b.cashCommissionDeducted,
          paidAt: b.paidAt
        };
        return updated;
      })
    );

    if (requestedStatus === 'completed' && booking.technicianId) {
      const isCash = booking.paymentMethod === 'cash';
      const commission = booking.adminCommission;
      const payout = booking.technicianPayout;

      if (booking.acceptanceCommissionDebited) {
        // Commission was ALREADY auto-debited upon acceptance!
        if (isCash) {
          // Cash booking: customer handed cash to technician. Commission already in admin wallet!
          setTechnicians(prev =>
            prev.map(t => {
              if (t.id !== booking.technicianId) return t;
              return {
                ...t,
                totalJobsCompleted: t.totalJobsCompleted + 1,
                todayEarnings: t.todayEarnings + payout,
                totalEarnings: t.totalEarnings + payout,
                lifetimeCashCollected: (t.lifetimeCashCollected ?? 0) + booking.totalAmount
              };
            })
          );

          if (currentTechnician.id === booking.technicianId) {
            setCurrentTechnician(prev => ({
              ...prev,
              totalJobsCompleted: prev.totalJobsCompleted + 1,
              todayEarnings: prev.todayEarnings + payout,
              totalEarnings: prev.totalEarnings + payout,
              lifetimeCashCollected: (prev.lifetimeCashCollected ?? 0) + booking.totalAmount
            }));
          }
        } else {
          // Online booking: customer paid online. Credit net technician payout to wallet
          setTechnicians(prev =>
            prev.map(t => {
              if (t.id !== booking.technicianId) return t;
              const currentBal = t.walletBalance ?? 0;
              const newBal = currentBal + payout;
              return {
                ...t,
                totalJobsCompleted: t.totalJobsCompleted + 1,
                todayEarnings: t.todayEarnings + payout,
                totalEarnings: t.totalEarnings + payout,
                pendingPayout: t.pendingPayout + payout,
                walletBalance: newBal,
                securityDepositPaid: newBal >= 2000,
                withdrawableBalance: Math.max(0, newBal - 2000)
              };
            })
          );

          if (currentTechnician.id === booking.technicianId) {
            setCurrentTechnician(prev => {
              const currentBal = prev.walletBalance ?? 0;
              const newBal = currentBal + payout;
              return {
                ...prev,
                totalJobsCompleted: prev.totalJobsCompleted + 1,
                todayEarnings: prev.todayEarnings + payout,
                totalEarnings: prev.totalEarnings + payout,
                pendingPayout: prev.pendingPayout + payout,
                walletBalance: newBal,
                securityDepositPaid: newBal >= 2000,
                withdrawableBalance: Math.max(0, newBal - 2000)
              };
            });
          }

          const creditTxn: WalletTransaction = {
            id: `TXN-W${Date.now().toString().slice(-6)}`,
            technicianId: booking.technicianId,
            type: 'online_payout_credit',
            amount: payout,
            balanceAfter: (currentTechnician.walletBalance ?? 0) + payout,
            bookingId: booking.id,
            description: `Net earnings credited for Online Job #${booking.id}`,
            timestamp: now
          };
          setWalletTransactions(prev => [creditTxn, ...prev]);
        }
      } else {
        // Fallback for bookings without upfront acceptance debit
        if (isCash) {
          setTechnicians(prev =>
            prev.map(t => {
              if (t.id !== booking.technicianId) return t;
              const currentBal = t.walletBalance ?? 0;
              const newBal = currentBal - commission;
              const isDepositMet = newBal >= 2000;
              const newWithdrawable = Math.max(0, newBal - 2000);
              const droppedBelowReserve = !isDepositMet;

              return {
                ...t,
                totalJobsCompleted: t.totalJobsCompleted + 1,
                todayEarnings: t.todayEarnings + payout,
                totalEarnings: t.totalEarnings + payout,
                walletBalance: newBal,
                securityDepositPaid: isDepositMet,
                withdrawableBalance: newWithdrawable,
                isOnline: droppedBelowReserve ? false : t.isOnline,
                lifetimeCashCollected: (t.lifetimeCashCollected ?? 0) + booking.totalAmount,
                lifetimeCommissionPaid: (t.lifetimeCommissionPaid ?? 0) + commission
              };
            })
          );

          if (currentTechnician.id === booking.technicianId) {
            setCurrentTechnician(prev => {
              const currentBal = prev.walletBalance ?? 0;
              const newBal = currentBal - commission;
              const isDepositMet = newBal >= 2000;
              return {
                ...prev,
                totalJobsCompleted: prev.totalJobsCompleted + 1,
                todayEarnings: prev.todayEarnings + payout,
                totalEarnings: prev.totalEarnings + payout,
                walletBalance: newBal,
                securityDepositPaid: isDepositMet,
                withdrawableBalance: Math.max(0, newBal - 2000),
                isOnline: !isDepositMet ? false : prev.isOnline,
                lifetimeCashCollected: (prev.lifetimeCashCollected ?? 0) + booking.totalAmount,
                lifetimeCommissionPaid: (prev.lifetimeCommissionPaid ?? 0) + commission
              };
            });
          }

          const deductionTxn: WalletTransaction = {
            id: `TXN-W${Date.now().toString().slice(-6)}`,
            technicianId: booking.technicianId,
            type: 'cash_commission_deduction',
            amount: commission,
            balanceAfter: (currentTechnician.walletBalance ?? 0) - commission,
            bookingId: booking.id,
            description: `Auto-commission deduction for Cash Booking #${booking.id} (Customer handed ₹${booking.totalAmount} in cash)`,
            timestamp: now
          };
          setWalletTransactions(prev => [deductionTxn, ...prev]);
          setAdminWalletBalance(prev => prev + commission);
        } else {
          setTechnicians(prev =>
            prev.map(t => {
              if (t.id !== booking.technicianId) return t;
              const currentBal = t.walletBalance ?? 0;
              const newBal = currentBal + payout;
              return {
                ...t,
                totalJobsCompleted: t.totalJobsCompleted + 1,
                todayEarnings: t.todayEarnings + payout,
                totalEarnings: t.totalEarnings + payout,
                pendingPayout: t.pendingPayout + payout,
                walletBalance: newBal,
                securityDepositPaid: newBal >= 2000,
                withdrawableBalance: Math.max(0, newBal - 2000)
              };
            })
          );

          if (currentTechnician.id === booking.technicianId) {
            setCurrentTechnician(prev => {
              const currentBal = prev.walletBalance ?? 0;
              const newBal = currentBal + payout;
              return {
                ...prev,
                totalJobsCompleted: prev.totalJobsCompleted + 1,
                todayEarnings: prev.todayEarnings + payout,
                totalEarnings: prev.totalEarnings + payout,
                pendingPayout: prev.pendingPayout + payout,
                walletBalance: newBal,
                securityDepositPaid: newBal >= 2000,
                withdrawableBalance: Math.max(0, newBal - 2000)
              };
            });
          }

          const creditTxn: WalletTransaction = {
            id: `TXN-W${Date.now().toString().slice(-6)}`,
            technicianId: booking.technicianId,
            type: 'online_payout_credit',
            amount: payout,
            balanceAfter: (currentTechnician.walletBalance ?? 0) + payout,
            bookingId: booking.id,
            description: `Net earnings credited for Online Job #${booking.id}`,
            timestamp: now
          };
          setWalletTransactions(prev => [creditTxn, ...prev]);
          setAdminWalletBalance(prev => prev + commission);
        }
      }
    }

    return { success: true };
  };

  // Customer Management
  // Customer management must be populated from verified Firestore records, not demo profiles.
  const [customers, setCustomers] = useState<CustomerUser[]>([]);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState({
    isConnected: false,
    lastSynced: 'Not checked',
    latencyMs: 0
  });

  const deleteCustomer = (_customerId: string) => {
    console.warn('Customer deletion requires trusted server-side admin authorization and an audit trail. No customer record was changed.');
  };

  const toggleCustomerStatus = (_customerId: string) => {
    console.warn('Customer suspension changes require trusted server-side admin authorization. No customer status changed.');
  };

  const reassignBookingTechnician = (_bookingId: string, _technicianId: string) => {
    console.warn('Booking assignment requires trusted server-side partner eligibility and atomic assignment checks. No booking was reassigned.');
  };

  const deleteBooking = (_bookingId: string) => {
    console.warn('Booking deletion requires trusted server-side admin authorization and an audit trail. No booking was deleted.');
  };

  const toggleTechnicianSuspension = (_techId: string) => {
    console.warn('Partner suspension changes require trusted server-side admin authorization. No partner status changed.');
  };

  const updateTechnicianRating = (_techId: string, _newRating: number) => {
    console.warn('Partner ratings must be derived from verified customer reviews. No rating was changed.');
  };

  const disbursePayout = (payoutId: string) => {
    adminApprovePayout(payoutId);
  };

  const addCustomerReviewReply = (_bookingId: string, _reply: string) => {
    console.warn('Review replies require a trusted persisted review workflow. No reply was saved.');
  };

  const deleteReview = (_bookingId: string) => {
    console.warn('Review moderation requires trusted server-side admin authorization and an audit trail. No review was deleted.');
  };

  const triggerFirestoreSync = async () => {
    setFirestoreSyncStatus(prev => ({ ...prev, lastSynced: 'Checking Firestore...', latencyMs: 0 }));
    const startedAt = performance.now();
    const connected = await testFirestoreConnection();
    const latencyMs = Math.round(performance.now() - startedAt);
    setFirestoreSyncStatus({
      isConnected: connected,
      lastSynced: connected
        ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Connection failed or access denied',
      latencyMs: connected ? latencyMs : 0
    });
  };

  // Add Review
  const addReview = (bookingId: string, rating: number, comment: string, tags: string[]) => {
    const rev = {
      rating,
      comment,
      tags,
      createdAt: new Date().toISOString()
    };

    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, review: rev } : b))
    );
  };

  const updateBookingPaymentStatus = (bookingId: string, _status: PaymentStatus, _transactionRef?: string) => {
    console.warn('All payment-state changes require a verified server-side payment event. No payment state changed for booking:', bookingId);
  };

  return (
    <QuickFixContext.Provider
      value={{
        activeRole,
        setActiveRole,
        viewMode,
        setViewMode,
        showCodeInspector,
        setShowCodeInspector,
        showFirebaseConfig,
        setShowFirebaseConfig,
        showAuthModal,
        setShowAuthModal,
        showProfileDrawer,
        setShowProfileDrawer,
        currentUser,
        isAuthenticated,
        authenticateUser,
        authenticateFirebaseCustomer,
        authenticateVerifiedAdmin,
        registerNewPartner,
        logoutUser,
        updateCustomerAddress,
        currentCity,
        setCurrentCity,
        services,
        selectedCategory,
        setSelectedCategory,
        customer,
        isCustomerLoggedIn,
        loginCustomer,
        registerCustomer,
        logoutCustomer,
        bookings,
        activeBookingId,
        setActiveBookingId,
        createBooking,
        submitCustomerBooking,
        updateBookingStatus,
        addReview,
        technicians,
        currentTechnician,
        isTechnicianLoggedIn,
        loginTechnician,
        registerTechnician,
        logoutTechnician,
        serviceZones,
        toggleTechnicianOnline,
        validateAndSetTechnicianOnline,
        updateServiceZoneRadius,
        toggleServiceZoneActive,
        approveTechnicianKyc,
        rejectTechnicianKyc,
        approveTechnicianQualification,
        rejectTechnicianQualification,
        updateTechnicianCustomCommission,
        commissionSettings,
        updateCommissionSettings,
        adminPaymentConfig,
        updateAdminPaymentConfig,
        adminApprovePayout,
        adminHoldPayout,
        adminRejectPayout,
        confirmPayoutSettlementWebhook,
        adminIssueCustomerRefund,
        payouts,
        requestPayout,
        processPayout,
        disbursePayout,
        walletTransactions,
        topupTechnicianWallet,
        adminWalletBalance,
        customers,
        deleteCustomer,
        toggleCustomerStatus,
        reassignBookingTechnician,
        deleteBooking,
        toggleTechnicianSuspension,
        updateTechnicianRating,
        addCustomerReviewReply,
        deleteReview,
        updateBookingPaymentStatus,
        firestoreSyncStatus,
        triggerFirestoreSync
      }}
    >
      {children}
    </QuickFixContext.Provider>
  );
};

export const useQuickFix = () => {
  const context = useContext(QuickFixContext);
  if (!context) {
    throw new Error('useQuickFix must be used within a QuickFixProvider');
  }
  return context;
};
