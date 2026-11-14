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
  INITIAL_BOOKINGS,
  INITIAL_COMMISSION_SETTINGS,
  INITIAL_PAYOUTS,
  INITIAL_SERVICES,
  INITIAL_TECHNICIANS,
  INITIAL_CUSTOMERS,
  INITIAL_ADMIN_PAYMENT_CONFIG,
  INITIAL_WALLET_TRANSACTIONS
} from '../data/mockData';
import { INITIAL_SERVICE_ZONES, calculateBoundingBox } from '../data/serviceZones';
import {
  seedServiceZonesIfEmpty,
  calculateHaversineDistanceKm,
  updateTechnicianFirestoreStatus
} from '../services/geofenceService';
import { db, testFirestoreConnection } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { getIdTokenResult } from 'firebase/auth';

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
    kycDocType: 'Aadhaar' | 'PAN' | 'Skill India Certificate';
    kycDocNumber: string;
    qualificationType?: 'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma';
    qualificationRegNumber?: string;
    qualificationInstitute?: string;
    upiId: string;
    city: string;
    address?: string;
    initialDepositAmount?: number;
    rememberMe: boolean;
  }) => { success: boolean; message?: string };
  logoutUser: () => void;
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
  }) => { success: boolean; message?: string };
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
  const [technicians, setTechnicians] = useState<Technician[]>(INITIAL_TECHNICIANS);
  const [currentTechnician, setCurrentTechnician] = useState<Technician>(INITIAL_TECHNICIANS[0]);
  const [isTechnicianLoggedIn, setIsTechnicianLoggedIn] = useState(false);

  // Commissions & Payouts & Admin Gateway Control
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>(INITIAL_COMMISSION_SETTINGS);
  const [payouts, setPayouts] = useState<PayoutRecord[]>(INITIAL_PAYOUTS);
  const [adminPaymentConfig, setAdminPaymentConfig] = useState<AdminMasterPaymentConfig>(INITIAL_ADMIN_PAYMENT_CONFIG);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(INITIAL_WALLET_TRANSACTIONS);
  const [adminWalletBalance, setAdminWalletBalance] = useState<number>(4580);
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
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [activeBookingId, setActiveBookingId] = useState<string | null>('QF-7049');

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
  const authenticateUser = ({
    displayName,
    phoneNumber,
    email,
    role,
    address,
    city,
    trades,
    rememberMe
  }: {
    displayName: string;
    phoneNumber: string;
    email: string;
    role: UserRole;
    address?: string;
    city: string;
    trades?: ServiceCategoryType[];
    rememberMe: boolean;
  }): { success: boolean; message?: string } => {
    // The dedicated AdminLoginScreen verifies Firebase admin custom claims.
    // Never create an admin session through this synchronous demo helper.
    if (role === 'admin') {
      return { success: false, message: 'Demo admin login is disabled. Use secure Firebase Super Admin sign-in.' };
    }

    if (role === 'technician') {
      const normalizedPhone = phoneNumber.replace(/\D/g, '').replace(/^91/, '');
      const partner = technicians.find(t => t.phone.replace(/\D/g, '').replace(/^91/, '') === normalizedPhone);
      if (!partner || partner.isSuspended || !partner.isVerified) {
        return { success: false, message: 'Partner account not found, not yet verified, or suspended. Complete registration and wait for admin approval.' };
      }
    }

    const userObj: AppUser = {
      uid: `uid-${Date.now()}`,
      phoneNumber,
      displayName,
      email,
      role,
      address,
      city,
      trades,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(userObj);
    setIsAuthenticated(true);

    if (rememberMe) {
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(userObj));
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      } catch {
        // ignore
      }
    }

    if (role === 'customer') {
      setIsCustomerLoggedIn(true);
      setCustomer({
        id: userObj.uid,
        name: displayName,
        phone: phoneNumber,
        email,
        addresses: address
          ? [
              {
                id: `addr-${Date.now()}`,
                label: 'Home',
                addressLine: address,
                city,
                pincode: '560034'
              }
            ]
          : customer.addresses
      });
    } else if (role === 'technician') {
      const normalizedPhone = phoneNumber.replace(/\D/g, '').replace(/^91/, '');
      const match = technicians.find(t => t.phone.replace(/\D/g, '').replace(/^91/, '') === normalizedPhone);
      if (match && !match.isSuspended && match.isVerified) {
        setCurrentTechnician(match);
        setIsTechnicianLoggedIn(true);
      }
    }

    return { success: true };
  };

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

  const registerNewPartner = (params: {
    displayName: string;
    phoneNumber: string;
    email: string;
    trades: ServiceCategoryType[];
    experienceYears: number;
    kycDocType: 'Aadhaar' | 'PAN' | 'Skill India Certificate';
    kycDocNumber: string;
    qualificationType?: 'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma';
    qualificationRegNumber?: string;
    qualificationInstitute?: string;
    upiId: string;
    city: string;
    address?: string;
    initialDepositAmount?: number;
    rememberMe: boolean;
  }): { success: boolean; message?: string } => {
    // 1. Strict Trade Restriction: Only qualified electricians, plumbers, and AC/Fridge technicians
    const validTrades: ServiceCategoryType[] = ['electrician', 'plumber', 'ac_repair', 'fridge_repair'];
    const hasValidTrades =
      params.trades &&
      params.trades.length > 0 &&
      params.trades.every(t => validTrades.includes(t));

    if (!hasValidTrades) {
      return {
        success: false,
        message: 'Registration Denied: Only certified and qualified Electricians, Plumbers, and AC/Fridge Technicians are eligible to partner with QuickFix.'
      };
    }

    // 2. Minimum Experience Requirement: At least 2 years in field
    if (params.experienceYears < 2) {
      return {
        success: false,
        message: 'Minimum 2 years of certified field experience is mandatory for trade quality assurance.'
      };
    }

    // 3. Strict Minimum ₹2,000 Wallet Balance Gate for Registration Completion
    const initialDeposit = params.initialDepositAmount !== undefined ? Number(params.initialDepositAmount) : 2000;
    if (isNaN(initialDeposit) || initialDeposit < 2000) {
      return {
        success: false,
        message: 'Registration Denied: A minimum partner security deposit of ₹2,000 is strictly required in your wallet before registration can be completed.'
      };
    }

    const qualType = params.qualificationType || 'ITI Trade Certificate';
    const qualReg = params.qualificationRegNumber || params.kycDocNumber || 'ITI-VERIFY-PENDING';
    const qualInst = params.qualificationInstitute || `${params.city} Technical Trade Training Institute`;

    const newTech: Technician = {
      id: `tech-${Date.now()}`,
      name: params.displayName,
      phone: params.phoneNumber,
      email: params.email,
      trades: params.trades,
      experienceYears: params.experienceYears,
      city: params.city,
      rating: 5.0,
      totalJobsCompleted: 0,
      avatar: 'https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=150&auto=format&fit=crop&q=80',
      isOnline: false, // CANNOT go online until QuickFix Admin HQ clears the qualification audit
      isVerified: false,
      approvalStatus: 'pending_audit',
      qualificationType: qualType,
      qualificationRegNumber: qualReg,
      qualificationInstitute: qualInst,
      kycDocType: params.kycDocType,
      kycDocNumber: params.kycDocNumber,
      walletBalance: initialDeposit,
      securityDepositRequired: 2000,
      securityDepositPaid: true,
      withdrawableBalance: Math.max(0, initialDeposit - 2000), // Base ₹2,000 is permanently locked and non-withdrawable
      lifetimeCashCollected: 0,
      lifetimeCommissionPaid: 0,
      bankAccount: {
        accountNumber: '•••• •••• 9921',
        ifsc: 'HDFC0001200',
        upiId: params.upiId
      },
      todayEarnings: 0,
      totalEarnings: 0,
      pendingPayout: 0
    };

    const initialTxn: WalletTransaction = {
      id: `TXN-W${Date.now().toString().slice(-6)}`,
      technicianId: newTech.id,
      type: 'security_deposit',
      amount: initialDeposit,
      balanceAfter: initialDeposit,
      description: 'Mandatory Partner Security Deposit (₹2,000 Non-withdrawable Base Reserve)',
      timestamp: new Date().toISOString()
    };
    setWalletTransactions(prev => [initialTxn, ...prev]);

    setTechnicians(prev => [newTech, ...prev]);
    setCurrentTechnician(newTech);
    setIsTechnicianLoggedIn(true);

    // Sync to Firestore
    try {
      setDoc(doc(db, 'technicians', newTech.id), newTech).catch(err => {
        console.warn('Firestore technician sync (offline/rules):', err);
      });
      setDoc(doc(db, 'wallet_transactions', initialTxn.id), initialTxn).catch(err => {
        console.warn('Firestore transaction sync:', err);
      });
    } catch (e) {
      console.warn('Firestore sync err:', e);
    }

    const userObj: AppUser = {
      uid: newTech.id,
      phoneNumber: params.phoneNumber,
      displayName: params.displayName,
      email: params.email,
      role: 'technician',
      trades: params.trades,
      experienceYears: params.experienceYears,
      qualificationType: qualType,
      qualificationRegNumber: qualReg,
      qualificationInstitute: qualInst,
      approvalStatus: 'pending_audit',
      kycDocType: params.kycDocType,
      kycDocNumber: params.kycDocNumber,
      isVerified: false,
      upiId: params.upiId,
      city: params.city,
      address: params.address,
      createdAt: new Date().toISOString()
    };

    setCurrentUser(userObj);
    setIsAuthenticated(true);

    if (params.rememberMe) {
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(userObj));
      } catch {
        // ignore
      }
    }

    return { success: true };
  };

  const logoutUser = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsCustomerLoggedIn(false);
    setIsTechnicianLoggedIn(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
    } catch {
      // ignore
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
  const loginCustomer = (phone: string, name?: string) => {
    setIsCustomerLoggedIn(true);
    setCustomer(prev => ({
      ...prev,
      phone,
      name: name || prev.name
    }));
  };

  const registerCustomer = (name: string, phone: string, email: string, address: string) => {
    setIsCustomerLoggedIn(true);
    const newCust: CustomerUser = {
      id: `cust-${Date.now()}`,
      name,
      phone,
      email,
      addresses: [
        {
          id: `addr-${Date.now()}`,
          label: 'Home',
          addressLine: address,
          city: currentCity,
          pincode: '560034'
        }
      ]
    };
    setCustomer(newCust);
  };

  const logoutCustomer = () => {
    setIsCustomerLoggedIn(false);
  };

  // Technician Auth
  const loginTechnician = (phone: string) => {
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^91/, '');
    if (normalizedPhone.length !== 10) return false;

    const match = technicians.find(t => {
      const storedPhone = t.phone.replace(/\D/g, '').replace(/^91/, '');
      return storedPhone === normalizedPhone;
    });

    // Never fall back to the first/demo technician: an unknown phone must not
    // inherit another partner's profile, wallet, jobs, or permissions.
    if (!match || match.isSuspended || !match.isVerified) return false;

    setCurrentTechnician(match);
    setIsTechnicianLoggedIn(true);
    return true;
  };

  const registerTechnician = (data: {
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
  }): { success: boolean; message?: string } => {
    return registerNewPartner({
      displayName: data.name,
      phoneNumber: data.phone,
      email: data.email,
      trades: data.trades,
      experienceYears: data.experienceYears,
      kycDocType: data.kycDocType,
      kycDocNumber: data.kycDocNumber,
      qualificationType: data.qualificationType,
      qualificationRegNumber: data.qualificationRegNumber,
      qualificationInstitute: data.qualificationInstitute,
      upiId: data.upiId,
      city: data.city,
      initialDepositAmount: data.initialDepositAmount,
      rememberMe: true
    });
  };

  const logoutTechnician = () => {
    setIsTechnicianLoggedIn(false);
  };

  const toggleTechnicianOnline = (
    techId: string,
    coords?: { lat: number; lng: number }
  ): { success: boolean; message?: string; requiresGeofence?: boolean; validation?: GeofenceValidationResult } => {
    const tech = technicians.find(t => t.id === techId) || (currentTechnician.id === techId ? currentTechnician : null);
    if (!tech) return { success: false, message: 'Technician record not found' };

    // If currently Online, permit switching to Offline immediately
    if (tech.isOnline) {
      setTechnicians(prev =>
        prev.map(t => (t.id === techId ? { ...t, isOnline: false } : t))
      );
      if (currentTechnician.id === techId) {
        setCurrentTechnician(prev => ({ ...prev, isOnline: false }));
      }
      updateTechnicianFirestoreStatus(techId, false);
      return { success: true, message: 'Duty status set to Offline. You will not receive customer requests.' };
    }

    // Strict Gate 1: Non-approved or unverified technicians cannot go online or receive customer bookings!
    if (!tech.isVerified || tech.approvalStatus === 'pending_audit' || tech.approvalStatus === 'rejected') {
      return {
        success: false,
        message: 'Awaiting Trade Qualification Clearance: Your certificate is under audit by QuickFix Admin HQ. Only approved and verified technicians can go online.'
      };
    }

    // Strict Gate 2: Mandatory Minimum ₹2,000 Security Reserve Gate
    // Technicians cannot go online or take bookings unless they maintain at least ₹2,000 in their partner wallet.
    if ((tech.walletBalance ?? 0) < 2000) {
      const deficit = 2000 - (tech.walletBalance ?? 0);
      return {
        success: false,
        message: `Minimum ₹2,000 Security Reserve Required: Your current wallet balance is ₹${tech.walletBalance ?? 0}. You must maintain at least ₹2,000 to activate duty and receive customer calls. Please top-up ₹${deficit}.`
      };
    }

    // Strict Gate 3: Suspension check
    if (tech.isSuspended) {
      return {
        success: false,
        message: 'Partner account suspended. Please contact QuickFix HQ operations.'
      };
    }

    // Strict Gate 4: Geo-fencing Service Radius Gate
    // If coords are supplied, validate them against active service zones
    if (coords) {
      const activeZones = serviceZones.filter(z => z.isActive);
      const matchingZone = activeZones.find(
        z => calculateHaversineDistanceKm(coords.lat, coords.lng, z.center.lat, z.center.lng) <= z.radiusKm
      );

      if (!matchingZone) {
        const nearest = activeZones.reduce((prev, curr) => {
          const d1 = calculateHaversineDistanceKm(coords.lat, coords.lng, prev.center.lat, prev.center.lng);
          const d2 = calculateHaversineDistanceKm(coords.lat, coords.lng, curr.center.lat, curr.center.lng);
          return d1 < d2 ? prev : curr;
        }, activeZones[0] || serviceZones[0]);

        const dist = nearest
          ? calculateHaversineDistanceKm(coords.lat, coords.lng, nearest.center.lat, nearest.center.lng)
          : 0;

        return {
          success: false,
          requiresGeofence: true,
          message: `Geo-fence Restriction: You are ${dist} km away from ${nearest?.name || 'the operating hub'} (Service radius: ${nearest?.radiusKm || 20} km). QuickFix partners can only go Online within approved operating zones to guarantee our 1-Hour SLA.`
        };
      }

      // Inside zone! Grant Online status and record operating location
      const distToCenter = calculateHaversineDistanceKm(coords.lat, coords.lng, matchingZone.center.lat, matchingZone.center.lng);
      const locationData = {
        lat: coords.lat,
        lng: coords.lng,
        zoneId: matchingZone.id,
        zoneName: matchingZone.name,
        distanceToCenterKm: distToCenter
      };

      setTechnicians(prev =>
        prev.map(t => (t.id === techId ? { ...t, isOnline: true, currentLocation: locationData } : t))
      );
      if (currentTechnician.id === techId) {
        setCurrentTechnician(prev => ({ ...prev, isOnline: true, currentLocation: locationData }));
      }
      updateTechnicianFirestoreStatus(techId, true, locationData);
      return {
        success: true,
        message: `Duty Online: Verified inside ${matchingZone.name} (${distToCenter} km from center · 1-Hour SLA Active).`
      };
    }

    // If no coordinates provided in call, check if current stored location is inside a valid zone
    if (tech.currentLocation) {
      const activeZones = serviceZones.filter(z => z.isActive);
      const matchingZone = activeZones.find(
        z => calculateHaversineDistanceKm(tech.currentLocation!.lat, tech.currentLocation!.lng, z.center.lat, z.center.lng) <= z.radiusKm
      );
      if (matchingZone) {
        setTechnicians(prev =>
          prev.map(t => (t.id === techId ? { ...t, isOnline: true } : t))
        );
        if (currentTechnician.id === techId) {
          setCurrentTechnician(prev => ({ ...prev, isOnline: true }));
        }
        updateTechnicianFirestoreStatus(techId, true, tech.currentLocation);
        return { success: true, message: `Duty Online: Verified inside ${matchingZone.name}.` };
      }
    }

    // Needs geo-fence verification
    return {
      success: false,
      requiresGeofence: true,
      message: 'Geo-fence Verification Required: Confirm GPS location within operating service radius to go online.'
    };
  };

  const validateAndSetTechnicianOnline = async (
    techId: string,
    locationData: { lat: number; lng: number; zoneId: string; zoneName: string; distanceToCenterKm: number }
  ): Promise<{ success: boolean; message: string }> => {
    setTechnicians(prev =>
      prev.map(t => (t.id === techId ? { ...t, isOnline: true, currentLocation: locationData } : t))
    );
    if (currentTechnician.id === techId) {
      setCurrentTechnician(prev => ({ ...prev, isOnline: true, currentLocation: locationData }));
    }
    await updateTechnicianFirestoreStatus(techId, true, locationData);
    return {
      success: true,
      message: `Geo-fence Verified: Duty Online in ${locationData.zoneName} (${locationData.distanceToCenterKm} km from hub).`
    };
  };

  const updateServiceZoneRadius = (zoneId: string, newRadiusKm: number): { success: boolean; message: string } => {
    setServiceZones(prev =>
      prev.map(z => {
        if (z.id === zoneId) {
          const updated = {
            ...z,
            radiusKm: newRadiusKm,
            ...calculateBoundingBox(z.center.lat, z.center.lng, newRadiusKm)
          };
          setDoc(doc(db, 'service_zones', zoneId), updated, { merge: true }).catch(err => console.warn(err));
          return updated;
        }
        return z;
      })
    );
    return { success: true, message: `Operating radius updated to ${newRadiusKm} km.` };
  };

  const toggleServiceZoneActive = (zoneId: string): { success: boolean; message: string } => {
    let nextState = false;
    setServiceZones(prev =>
      prev.map(z => {
        if (z.id === zoneId) {
          nextState = !z.isActive;
          const updated = { ...z, isActive: nextState };
          setDoc(doc(db, 'service_zones', zoneId), updated, { merge: true }).catch(err => console.warn(err));
          return updated;
        }
        return z;
      })
    );
    return { success: true, message: `Service zone status toggled.` };
  };

  const approveTechnicianQualification = (techId: string) => {
    setTechnicians(prev =>
      prev.map(t =>
        t.id === techId
          ? {
              ...t,
              isVerified: true,
              approvalStatus: 'approved',
              rejectionReason: undefined
            }
          : t
      )
    );
    if (currentTechnician.id === techId) {
      setCurrentTechnician(prev => ({
        ...prev,
        isVerified: true,
        approvalStatus: 'approved',
        rejectionReason: undefined
      }));
    }
    if (currentUser && currentUser.uid === techId) {
      const updated: AppUser = {
        ...currentUser,
        isVerified: true,
        approvalStatus: 'approved'
      };
      setCurrentUser(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  const rejectTechnicianQualification = (techId: string, reason?: string) => {
    const rejectionNote = reason || 'Trade qualification certificate could not be validated with state/NSDC register.';
    setTechnicians(prev =>
      prev.map(t =>
        t.id === techId
          ? {
              ...t,
              isVerified: false,
              isOnline: false,
              approvalStatus: 'rejected',
              rejectionReason: rejectionNote
            }
          : t
      )
    );
    if (currentTechnician.id === techId) {
      setCurrentTechnician(prev => ({
        ...prev,
        isVerified: false,
        isOnline: false,
        approvalStatus: 'rejected',
        rejectionReason: rejectionNote
      }));
    }
    if (currentUser && currentUser.uid === techId) {
      const updated: AppUser = {
        ...currentUser,
        isVerified: false,
        approvalStatus: 'rejected'
      };
      setCurrentUser(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  const approveTechnicianKyc = (techId: string) => {
    approveTechnicianQualification(techId);
  };

  const rejectTechnicianKyc = (techId: string) => {
    rejectTechnicianQualification(techId);
  };

  // Admin Custom Commission Override Per Service Provider
  const updateTechnicianCustomCommission = (technicianId: string, commissionPct: number | null): { success: boolean; message: string } => {
    const targetTech = technicians.find(t => t.id === technicianId) || (currentTechnician.id === technicianId ? currentTechnician : null);
    if (!targetTech) return { success: false, message: 'Technician record not found' };

    const validPct = commissionPct !== null ? Math.max(0, Math.min(100, Math.round(commissionPct))) : undefined;

    setTechnicians(prev =>
      prev.map(t =>
        t.id === technicianId
          ? { ...t, customCommissionPct: validPct }
          : t
      )
    );

    if (currentTechnician.id === technicianId) {
      setCurrentTechnician(prev => ({
        ...prev,
        customCommissionPct: validPct
      }));
    }

    if (currentUser && currentUser.uid === technicianId) {
      const updated = {
        ...currentUser,
        customCommissionPct: validPct
      };
      setCurrentUser(updated);
      try {
        localStorage.setItem(LOCAL_STORAGE_AUTH_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    return {
      success: true,
      message: validPct !== undefined
        ? `Custom commission rate for ${targetTech.name} set to ${validPct}%.`
        : `Custom commission rate removed for ${targetTech.name}. Reset to category standard.`
    };
  };

  // Commission & Payouts & Admin Payment Control
  const updateCommissionSettings = (newSettings: Partial<CommissionSettings>) => {
    setCommissionSettings(prev => ({ ...prev, ...newSettings }));
  };

  const updateAdminPaymentConfig = (config: Partial<AdminMasterPaymentConfig>) => {
    setAdminPaymentConfig(prev => ({ ...prev, ...config }));
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

  const adminHoldPayout = (payoutId: string, reason: string): { success: boolean; message: string } => {
    const target = payouts.find(p => p.id === payoutId);
    if (!target) return { success: false, message: 'Payout record not found' };

    const updatedPayout: PayoutRecord = {
      ...target,
      status: 'on_hold',
      adminApprovalStatus: 'held_by_admin',
      adminNote: reason || 'Audit Hold: Job verification or document audit pending'
    };

    setPayouts(prev => prev.map(p => (p.id === payoutId ? updatedPayout : p)));

    try {
      updateDoc(doc(db, 'payouts', payoutId), {
        status: 'on_hold',
        adminApprovalStatus: 'held_by_admin',
        adminNote: updatedPayout.adminNote
      }).catch(err => console.warn('Firestore payout hold sync:', err));
    } catch (e) {
      console.warn('Firestore sync err:', e);
    }

    return { success: true, message: `Payout #${payoutId} has been placed on Admin Hold.` };
  };

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

  // Update Booking Status & Handle Real-Time Wallet / Commission Settlements
  const updateBookingStatus = (
    bookingId: string,
    newStatus: BookingStatus,
    otpProvided?: string
  ): { success: boolean; message?: string } => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return { success: false, message: 'Booking not found' };

    if (newStatus === 'in_progress' && otpProvided) {
      if (otpProvided.trim() !== booking.startOtp) {
        return { success: false, message: 'Invalid start OTP. Please ask the customer for the 4-digit code.' };
      }
    }

    const now = new Date().toISOString();
    const techId = booking.technicianId || currentTechnician.id;
    const tech = technicians.find(t => t.id === techId) || (currentTechnician.id === techId ? currentTechnician : null);

    // GATE 1: Service notification acceptance validation
    // Occurs when booking moves from unaccepted state (requested/assigned) to accepted (technician_en_route or in_progress)
    const isAcceptingJob = (newStatus === 'technician_en_route' || newStatus === 'in_progress') &&
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
          paymentStatus: newStatus === 'completed' ? 'paid' : b.paymentStatus,
          cashCommissionDeducted: newStatus === 'completed' && b.paymentMethod === 'cash' ? true : b.cashCommissionDeducted,
          paidAt: newStatus === 'completed' ? (b.paidAt || now) : b.paidAt
        };
        return updated;
      })
    );

    if (newStatus === 'completed' && booking.technicianId) {
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
  const [customers, setCustomers] = useState<CustomerUser[]>(INITIAL_CUSTOMERS);
  const [firestoreSyncStatus, setFirestoreSyncStatus] = useState({
    isConnected: false,
    lastSynced: 'Not checked',
    latencyMs: 0
  });

  const deleteCustomer = (customerId: string) => {
    setCustomers(prev => prev.filter(c => c.id !== customerId));
  };

  const toggleCustomerStatus = (customerId: string) => {
    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? { ...c, status: c.status === 'suspended' ? 'active' : 'suspended' }
          : c
      )
    );
  };

  const reassignBookingTechnician = (bookingId: string, technicianId: string) => {
    const tech = technicians.find(t => t.id === technicianId);
    if (!tech) return;
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId
          ? {
              ...b,
              technicianId: tech.id,
              technicianName: tech.name,
              technicianPhone: tech.phone,
              technicianRating: tech.rating,
              technicianAvatar: tech.avatar
            }
          : b
      )
    );
  };

  const deleteBooking = (bookingId: string) => {
    setBookings(prev => prev.filter(b => b.id !== bookingId));
  };

  const toggleTechnicianSuspension = (techId: string) => {
    setTechnicians(prev =>
      prev.map(t =>
        t.id === techId ? { ...t, isSuspended: !t.isSuspended } : t
      )
    );
  };

  const updateTechnicianRating = (techId: string, newRating: number) => {
    setTechnicians(prev =>
      prev.map(t => (t.id === techId ? { ...t, rating: newRating } : t))
    );
  };

  const disbursePayout = (payoutId: string) => {
    adminApprovePayout(payoutId);
  };

  const addCustomerReviewReply = (bookingId: string, reply: string) => {
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId && b.review
          ? {
              ...b,
              review: { ...b.review, adminReply: reply }
            }
          : b
      )
    );
  };

  const deleteReview = (bookingId: string) => {
    setBookings(prev =>
      prev.map(b => (b.id === bookingId ? { ...b, review: undefined } : b))
    );
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

  const updateBookingPaymentStatus = (bookingId: string, status: PaymentStatus, transactionRef?: string) => {
    // Payment success/refund states must come from a verified server callback,
    // never from a client-generated reference or a UI action.
    if (status === 'paid' || status === 'refunded') {
      console.warn('Ignored client-side payment state change for booking:', bookingId, transactionRef);
      return;
    }
    setBookings(prev =>
      prev.map(b => b.id === bookingId
        ? { ...b, paymentStatus: status, paidAt: undefined }
        : b
      )
    );
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
