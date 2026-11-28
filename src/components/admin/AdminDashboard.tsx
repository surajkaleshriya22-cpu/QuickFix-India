import React, { useState } from 'react';
import {
  TrendingUp,
  Percent,
  Users,
  ShieldCheck,
  Shield,
  CheckCircle,
  XCircle,
  IndianRupee,
  Layers,
  Settings,
  Sliders,
  FileText,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  UserCheck,
  UserX,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Star,
  Zap,
  Wrench,
  Check,
  X,
  ArrowRight,
  Eye,
  Send,
  MessageSquare,
  Lock,
  Unlock,
  Radio,
  Flame,
  KeyRound,
  Trash2,
  RefreshCw,
  Award,
  ChevronRight,
  CreditCard,
  Wallet,
  BarChart3,
  PieChart,
  Download,
  Receipt,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Save,
  Landmark,
  Building,
  RotateCcw,
  AlertOctagon,
  Wind,
  Snowflake,
  Navigation
} from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { BookingStatus, ServiceCategoryType, CustomerUser, Technician, Booking, PaymentStatus, PaymentMethod } from '../../types';
import { PendingPayoutsSection } from './PendingPayoutsSection';
import { AdminRateCardsSection } from './AdminRateCardsSection';
import { AdminKycReviewSection } from './AdminKycReviewSection';
import { AdminPartnerRechargeSection } from './AdminPartnerRechargeSection';
import { AdminSafetyIncidentsSection } from './AdminSafetyIncidentsSection';
import { AdminComplaintsSection } from './AdminComplaintsSection';
import { auth } from '../../lib/firebase';

const INDIAN_BANK_OPTIONS = [
  'State Bank of India (SBI)', 'HDFC Bank', 'ICICI Bank', 'Punjab National Bank (PNB)',
  'Axis Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India',
  'Bank of India', 'Indian Bank', 'Central Bank of India', 'Indian Overseas Bank',
  'UCO Bank', 'Bank of Maharashtra', 'IDBI Bank', 'Yes Bank', 'Kotak Mahindra Bank',
  'IndusInd Bank', 'Federal Bank', 'AU Small Finance Bank', 'Other'
] as const;

export const AdminDashboard: React.FC = () => {
  const {
    bookings,
    technicians,
    customers,
    commissionSettings,
    updateCommissionSettings,
    adminPaymentConfig,
    updateAdminPaymentConfig,
    adminApprovePayout,
    adminHoldPayout,
    adminRejectPayout,
    adminIssueCustomerRefund,
    payouts,
    processPayout,
    disbursePayout,
    approveTechnicianKyc,
    rejectTechnicianKyc,
    approveTechnicianQualification,
    rejectTechnicianQualification,
    toggleTechnicianSuspension,
    updateTechnicianRating,
    updateTechnicianCustomCommission,
    reassignBookingTechnician,
    updateBookingStatus,
    deleteBooking,
    deleteCustomer,
    toggleCustomerStatus,
    addCustomerReviewReply,
    deleteReview,
    updateBookingPaymentStatus,
    firestoreSyncStatus,
    triggerFirestoreSync,
    currentUser,
    authenticateUser,
    logoutUser,
    setShowAuthModal,
    setActiveRole,
    walletTransactions,
    adminWalletBalance,
    serviceZones,
    updateServiceZoneRadius,
    toggleServiceZoneActive
  } = useQuickFix();

  // Active Admin Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'customers' | 'technicians' | 'bookings' | 'commissions' | 'reviews' | 'firebase' | 'rates' | 'kyc' | 'partner_recharge' | 'safety' | 'complaints'
  >('overview');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFixLookupId, setQuickFixLookupId] = useState('');
  const [quickFixLookup, setQuickFixLookup] = useState<any>(null);
  const [quickFixLookupError, setQuickFixLookupError] = useState('');
  const [quickFixLookupLoading, setQuickFixLookupLoading] = useState(false);
  const [techFilterTrade, setTechFilterTrade] = useState<'all' | ServiceCategoryType>('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number | 'all'>('all');

  const lookupQuickFixAccount = async () => {
    const id = quickFixLookupId.trim().toUpperCase();
    if (!/^QF[CP]-\d{8}$/.test(id)) {
      setQuickFixLookupError('Enter a valid ID, e.g. QFC-12345678 or QFP-12345678.');
      setQuickFixLookup(null);
      return;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setQuickFixLookupError('Admin Firebase sign-in is required.');
      return;
    }
    setQuickFixLookupLoading(true);
    setQuickFixLookupError('');
    setQuickFixLookup(null);
    try {
      const token = await firebaseUser.getIdToken(true);
      const response = await fetch('/api/admin/customer-care/' + encodeURIComponent(id), {
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Account record could not be found.');
      setQuickFixLookup(result);
    } catch (error) {
      setQuickFixLookupError(error instanceof Error ? error.message : 'Customer Care lookup failed.');
    } finally {
      setQuickFixLookupLoading(false);
    }
  };

  // Payment & Commission Management States
  const [paymentSubTab, setPaymentSubTab] = useState<'history' | 'payouts' | 'admin_account' | 'reports' | 'settings' | 'geofence'>('history');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'pending' | 'failed' | 'refunded'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'upi' | 'card' | 'cash' | 'netbanking'>('all');
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState<'all' | 'electrician' | 'plumber'>('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'monthly'>('daily');
  const [simulatorAmount, setSimulatorAmount] = useState<number>(500);
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);
  const [statusUpdateNoticeMsg, setStatusUpdateNoticeMsg] = useState('');

  // Admin Master Account & Gateway Control Form
  const [adminMerchantName, setAdminMerchantName] = useState(adminPaymentConfig.merchantName);
  const [adminVpa, setAdminVpa] = useState(adminPaymentConfig.merchantVpa);
  const [adminBankName, setAdminBankName] = useState(adminPaymentConfig.bankName);
  const [adminAccountNo, setAdminAccountNo] = useState(adminPaymentConfig.bankAccountNumber);
  const [adminAccountHolder, setAdminAccountHolder] = useState('');
  const [adminAccountType, setAdminAccountType] = useState<'savings' | 'current'>('savings');
  const [adminIfsc, setAdminIfsc] = useState(adminPaymentConfig.bankIfsc);
  const [adminGateway, setAdminGateway] = useState(adminPaymentConfig.gatewayProvider);
  const [adminEscrowEnabled, setAdminEscrowEnabled] = useState(adminPaymentConfig.escrowEnabled);
  const [adminManualApproval, setAdminManualApproval] = useState(adminPaymentConfig.manualApprovalRequired);
  const [adminConfigSavedMsg, setAdminConfigSavedMsg] = useState('');
  const [savedBankSummary, setSavedBankSummary] = useState<{ bankName: string; accountType: string; accountLast4: string; ifsc: string; accountHolderName: string } | null>(null);

  // Refund & Hold state
  const [refundBookingTarget, setRefundBookingTarget] = useState<Booking | null>(null);
  const [refundReasonInput, setRefundReasonInput] = useState('');
  const [refundSuccessMsg, setRefundSuccessMsg] = useState('');
  const [activeHoldPayoutId, setActiveHoldPayoutId] = useState<string | null>(null);
  const [holdReasonInput, setHoldReasonInput] = useState('');

  // Interactive Commission Form
  const [elecRate, setElecRate] = useState(commissionSettings.electricianCommissionPct);
  const [plumbRate, setPlumbRate] = useState(commissionSettings.plumberCommissionPct);
  const [acRate, setAcRate] = useState(commissionSettings.acCommissionPct || 15);
  const [fridgeRate, setFridgeRate] = useState(commissionSettings.fridgeCommissionPct || 15);
  const [convFee, setConvFee] = useState(commissionSettings.platformConvenienceFee);
  const [minPayout, setMinPayout] = useState(commissionSettings.minPayoutThreshold || 500);
  const [saveMessage, setSaveMessage] = useState('');

  // Reassignment Modal state
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);

  // Review reply state
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});

  // Admin login passcode state
  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [pendingPartners, setPendingPartners] = useState<Array<{
    uid: string; displayName?: string; email?: string; phoneNumber?: string;
    city?: string; trades?: string[]; experienceYears?: number;
    createdAt?: string; approvalStatus?: string; kycStatus?: string;
    dispatchRadiusKm?: number | null; dispatchLocationConfigured?: boolean;
  }>>([]);
  const [channelPartnerDirectory, setChannelPartnerDirectory] = useState<Array<{
    uid: string; displayName?: string; phoneNumber?: string; email?: string; role?: string;
    city?: string; serviceArea?: { state?: string; district?: string; tehsil?: string };
    trades?: string[]; approvalStatus?: string; kycStatus?: string;
    isVerified?: boolean; isOnline?: boolean; isSuspended?: boolean;
    securityDepositPaid?: boolean; walletBalance?: number | null;
    dispatchEligible?: boolean; dispatchReady?: boolean; dispatchRadiusKm?: number | null; dispatchLocationConfigured?: boolean;
    createdAt?: string | null;
  }>>([]);
  const [partnerDirectoryFilter, setPartnerDirectoryFilter] = useState<'all' | 'approved' | 'active' | 'pending'>('all');
  const [partnerDirectoryLoading, setPartnerDirectoryLoading] = useState(false);
  const [partnerReviewLoading, setPartnerReviewLoading] = useState(false);
  const [partnerReviewBusyUid, setPartnerReviewBusyUid] = useState<string | null>(null);
  const [partnerReviewMessage, setPartnerReviewMessage] = useState('');
  const [partnerReviewError, setPartnerReviewError] = useState('');
  const [adminServerAuthStatus, setAdminServerAuthStatus] = useState<'checking' | 'authorized' | 'denied' | 'unavailable'>('checking');

  // Coverage summaries are derived only from the profiles returned by the secure
  // admin directory API. They are not estimates of total market/provider coverage.
  const partnerCoverageByCategory = Object.entries(channelPartnerDirectory.reduce<Record<string, number>>((counts, partner) => {
    const categories = Array.isArray(partner.trades) && partner.trades.length > 0
      ? partner.trades : ['Category not specified'];
    categories.forEach((category) => {
      const label = String(category || '').trim() || 'Category not specified';
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const partnerCoverageByDistrict = Object.entries(channelPartnerDirectory.reduce<Record<string, number>>((counts, partner) => {
    const area = partner.serviceArea;
    const district = area?.district?.trim();
    const state = area?.state?.trim();
    const label = district ? `${district}${state ? `, ${state}` : ''}` : (partner.city?.trim() || 'Area not specified');
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);


  // Primary Metrics Calculations
  const totalCustomers = customers.length;
  const totalElectricians = technicians.filter(t => t.trades.includes('electrician')).length;
  const totalPlumbers = technicians.filter(t => t.trades.includes('plumber')).length;
  const totalAcTechs = technicians.filter(t => t.trades.includes('ac_repair')).length;
  const totalFridgeTechs = technicians.filter(t => t.trades.includes('fridge_repair')).length;
  const totalBookings = bookings.length;
  const totalRevenueGMV = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const totalCommissionCut = bookings.reduce((sum, b) => sum + b.adminCommission, 0);
  const totalDisbursedNet = bookings.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.technicianPayout, 0);
  const pendingKycCount = technicians.filter(t => !t.isVerified).length;

  // Granular Payment & Commission Calculations
  const paidBookings = bookings.filter(b => b.paymentStatus === 'paid');
  const pendingBookings = bookings.filter(b => b.paymentStatus === 'pending');
  const failedBookings = bookings.filter(b => b.paymentStatus === 'failed');

  const totalPaymentsReceived = paidBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const countPaymentsReceived = paidBookings.length;

  const totalPendingPayments = pendingBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const countPendingPayments = pendingBookings.length;

  const totalFailedPayments = failedBookings.reduce((sum, b) => sum + b.totalAmount, 0);

  const totalTechnicianPayments = paidBookings.reduce((sum, b) => sum + b.technicianPayout, 0);
  const technicianWalletPending = technicians.reduce((sum, t) => sum + t.pendingPayout, 0);

  const totalPlatformCommission = paidBookings.reduce((sum, b) => sum + b.adminCommission, 0);

  const handleAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError('Demo passcode login is disabled. Admin access requires a signed-in Firebase account with a verified admin custom claim.');
  };

  const handleSaveCommission = (e: React.FormEvent) => {
    e.preventDefault();
    updateCommissionSettings({
      electricianCommissionPct: Number(elecRate),
      plumberCommissionPct: Number(plumbRate),
      acCommissionPct: Number(acRate),
      fridgeCommissionPct: Number(fridgeRate),
      platformConvenienceFee: Number(convFee),
      minPayoutThreshold: Number(minPayout)
    });
    setSaveMessage('NOT SAVED: Commission settings require a trusted server-side admin workflow. No changes were saved.');
    setTimeout(() => setSaveMessage(''), 3500);
  };

  const handlePaymentStatusChange = (bookingId: string, newStatus: PaymentStatus) => {
    updateBookingPaymentStatus(bookingId, newStatus);
    setStatusUpdateNoticeMsg(`NOT UPDATED: Payment status changes require a verified server-side payment event. Booking ${bookingId} was not changed.`);
    setTimeout(() => setStatusUpdateNoticeMsg(''), 3500);
  };

  // Group bookings for Daily Revenue Report
  const dailyGroups = React.useMemo(() => {
    const groups: Record<string, {
      date: string;
      displayDate: string;
      bookings: Booking[];
      totalGmv: number;
      paidGmv: number;
      pendingGmv: number;
      failedGmv: number;
      commission: number;
      techPayout: number;
    }> = {};

    bookings.forEach(b => {
      const dateKey = b.createdAt ? b.createdAt.split('T')[0] : 'date-unavailable';
      if (!groups[dateKey]) {
        const parsedDate = dateKey === 'date-unavailable' ? null : new Date(`${dateKey}T00:00:00`);
        const display = parsedDate && !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Date unavailable';

        groups[dateKey] = {
          date: dateKey,
          displayDate: display,
          bookings: [],
          totalGmv: 0,
          paidGmv: 0,
          pendingGmv: 0,
          failedGmv: 0,
          commission: 0,
          techPayout: 0
        };
      }
      groups[dateKey].bookings.push(b);
      groups[dateKey].totalGmv += b.totalAmount;
      if (b.paymentStatus === 'paid') {
        groups[dateKey].paidGmv += b.totalAmount;
        groups[dateKey].commission += b.adminCommission;
        groups[dateKey].techPayout += b.technicianPayout;
      } else if (b.paymentStatus === 'pending') {
        groups[dateKey].pendingGmv += b.totalAmount;
      } else if (b.paymentStatus === 'failed') {
        groups[dateKey].failedGmv += b.totalAmount;
      }
    });

    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [bookings]);

  // Group bookings for Monthly Revenue Report
  const monthlyGroups = React.useMemo(() => {
    const groups: Record<string, {
      month: string;
      label: string;
      bookings: Booking[];
      totalGmv: number;
      paidGmv: number;
      pendingGmv: number;
      failedGmv: number;
      commission: number;
      techPayout: number;
      elecGmv: number;
      plumbGmv: number;
    }> = {};

    bookings.forEach(b => {
      const monthKey = b.createdAt ? b.createdAt.substring(0, 7) : 'month-unavailable';
      const parsedMonth = monthKey === 'month-unavailable' ? null : new Date(`${monthKey}-01T00:00:00`);
      const label = parsedMonth && !Number.isNaN(parsedMonth.getTime())
        ? parsedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'Date unavailable';

      if (!groups[monthKey]) {
        groups[monthKey] = {
          month: monthKey,
          label,
          bookings: [],
          totalGmv: 0,
          paidGmv: 0,
          pendingGmv: 0,
          failedGmv: 0,
          commission: 0,
          techPayout: 0,
          elecGmv: 0,
          plumbGmv: 0
        };
      }
      groups[monthKey].bookings.push(b);
      groups[monthKey].totalGmv += b.totalAmount;
      if (b.category === 'electrician') groups[monthKey].elecGmv += b.totalAmount;
      if (b.category === 'plumber') groups[monthKey].plumbGmv += b.totalAmount;

      if (b.paymentStatus === 'paid') {
        groups[monthKey].paidGmv += b.totalAmount;
        groups[monthKey].commission += b.adminCommission;
        groups[monthKey].techPayout += b.technicianPayout;
      } else if (b.paymentStatus === 'pending') {
        groups[monthKey].pendingGmv += b.totalAmount;
      } else if (b.paymentStatus === 'failed') {
        groups[monthKey].failedGmv += b.totalAmount;
      }
    });

    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
  }, [bookings]);

  // Filtered payment transactions
  const filteredTransactions = bookings.filter(b => {
    const matchesStatus = paymentStatusFilter === 'all' || b.paymentStatus === paymentStatusFilter;
    const matchesMethod = paymentMethodFilter === 'all' || b.paymentMethod === paymentMethodFilter;
    const matchesCategory = paymentCategoryFilter === 'all' || b.category === paymentCategoryFilter;
    const query = paymentSearchQuery.trim().toLowerCase();
    const matchesQuery = !query ||
      b.id.toLowerCase().includes(query) ||
      b.customerName.toLowerCase().includes(query) ||
      b.customerPhone.toLowerCase().includes(query) ||
      (b.technicianName && b.technicianName.toLowerCase().includes(query)) ||
      (b.transactionRef && b.transactionRef.toLowerCase().includes(query)) ||
      b.serviceTitle.toLowerCase().includes(query);
    return matchesStatus && matchesMethod && matchesCategory && matchesQuery;
  });

  const handleSendReviewReply = (bookingId: string) => {
    const text = replyTextMap[bookingId];
    if (!text || !text.trim()) return;
    addCustomerReviewReply(bookingId, text.trim());
    setStatusUpdateNoticeMsg('NOT SAVED: Review replies require a trusted persisted admin workflow. Your text has been kept in the input.');
  };


  const checkAdminServerAuthorization = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setAdminServerAuthStatus('denied');
      setPartnerReviewError('Firebase admin session not found. Sign in with the authorized admin account.');
      return false;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/admin/health', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        if (result.success && result.authorization === 'server_verified_admin_claim') {
          setAdminServerAuthStatus('authorized');
          return true;
        }
      }
      setAdminServerAuthStatus(response.status === 403 || response.status === 401 ? 'denied' : 'unavailable');
      setPartnerReviewError(response.status === 403
        ? 'This Firebase account does not have the server-side admin custom claim.'
        : response.status === 401
          ? 'Admin session expired. Sign in again.'
          : 'Secure admin service is unavailable. Check the Render backend configuration.');
      return false;
    } catch {
      setAdminServerAuthStatus('unavailable');
      setPartnerReviewError('Could not reach the secure admin service. Check the backend connection.');
      return false;
    }
  };

  const loadPendingPartners = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setPartnerReviewError('Firebase admin session not found. Please sign in again.');
      return;
    }
    setPartnerReviewLoading(true);
    setPartnerReviewError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/admin/partners/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Pending partner list could not be loaded.');
      }
      setPendingPartners(Array.isArray(result.partners) ? result.partners : []);
    } catch (error: any) {
      setPartnerReviewError(error?.message || 'Unable to load pending partners.');
    } finally {
      setPartnerReviewLoading(false);
    }
  };

  const loadChannelPartnerDirectory = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setPartnerReviewError('Firebase admin session not found. Please sign in again.');
      return;
    }
    setPartnerDirectoryLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/admin/partners', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Channel Partner directory could not be loaded.');
      }
      setChannelPartnerDirectory(Array.isArray(result.partners) ? result.partners : []);
    } catch (error: any) {
      setPartnerReviewError(error?.message || 'Unable to load Channel Partner directory.');
    } finally {
      setPartnerDirectoryLoading(false);
    }
  };

  const reviewPendingPartner = async (partnerUid: string, decision: 'approve_profile' | 'reject') => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      setPartnerReviewError('Firebase admin session not found. Please sign in again.');
      return;
    }
    let reason: string | undefined;
    if (decision === 'reject') {
      reason = window.prompt('Rejection reason (required):')?.trim();
      if (!reason) return;
      if (reason.length > 500) {
        setPartnerReviewError('Reason must be 500 characters or less.');
        return;
      }
    }
    setPartnerReviewBusyUid(partnerUid);
    setPartnerReviewError('');
    setPartnerReviewMessage('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/admin/partners/${encodeURIComponent(partnerUid)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, ...(reason ? { reason } : {}) })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Partner review could not be saved.');
      }
      setPartnerReviewMessage(decision === 'approve_profile'
        ? 'Basic profile review approved. KYC and qualification are still pending.'
        : 'Partner profile rejected.');
      await loadPendingPartners();
    } catch (error: any) {
      setPartnerReviewError(error?.message || 'Partner review failed.');
    } finally {
      setPartnerReviewBusyUid(null);
    }
  };

  React.useEffect(() => {
    if (currentUser?.role !== 'admin' || paymentSubTab !== 'admin_account') return;
    let cancelled = false;
    const loadSavedBank = async () => {
      try {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return;
        const token = await firebaseUser.getIdToken();
        const response = await fetch('/api/admin/payment-bank', { headers: { Authorization: 'Bearer ' + token } });
        const result = await response.json();
        if (!response.ok || !result.success || cancelled) return;
        if (result.configured) {
          setSavedBankSummary({ bankName: result.bankName, accountType: result.accountType || 'savings', accountLast4: result.accountLast4, ifsc: result.ifsc, accountHolderName: result.accountHolderName });
          setAdminBankName(result.bankName || '');
          setAdminAccountType(result.accountType === 'current' ? 'current' : 'savings');
          setAdminAccountHolder(result.accountHolderName || '');
          setAdminIfsc(result.ifsc || '');
          setAdminAccountNo('');
        } else {
          setSavedBankSummary(null);
        }
      } catch {
        if (!cancelled) setAdminConfigSavedMsg('Saved bank details could not be loaded. Please retry.');
      }
    };
    void loadSavedBank();
    return () => { cancelled = true; };
  }, [paymentSubTab, currentUser?.uid, currentUser?.role]);

  React.useEffect(() => {
    if (currentUser?.role !== 'admin') return;
    let cancelled = false;
    const verifyAndLoad = async () => {
      const authorized = await checkAdminServerAuthorization();
      if (authorized && !cancelled && activeTab === 'technicians') {
        await Promise.all([loadPendingPartners(), loadChannelPartnerDirectory()]);
      }
    };
    void verifyAndLoad();
    return () => { cancelled = true; };
  }, [activeTab, currentUser?.uid, currentUser?.role]);

  // Role Gate: Protect console if current user is not logged in as Admin
  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-5 font-sans">
        <div className="w-full max-w-sm bg-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-md">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">KamXApp Admin HQ</h3>
            <p className="text-xs text-slate-400 mt-1">
              Role-Based Access Control: Restricted to platform executives and dispatch managers.
            </p>
          </div>

          <form onSubmit={handleAdminUnlock} className="space-y-3 pt-1 text-xs text-left">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                Admin Security Passcode
              </label>
              <input
                type="password"
                required
                value={adminKeyInput}
                onChange={e => setAdminKeyInput(e.target.value)}
                placeholder="Demo passcode disabled"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-white font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {adminAuthError && (
                <p className="text-[11px] text-red-400 font-semibold mt-1.5">{adminAuthError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/30 transition-all active:scale-98"
            >
              Unlock Administration Console
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="text-amber-300">Demo passcode login disabled</span>
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-blue-400 hover:underline font-semibold"
            >
              Sign In via Mobile OTP
            </button>
          </div>
        </div>
      </div>
    );
  }




  // Filter Bookings
  const filteredBookings = bookings.filter(b => {
    const matchesSearch =
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.serviceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.city && b.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.customerAddress && b.customerAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.technicianName && b.technicianName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = bookingStatusFilter === 'all' || b.status === bookingStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter Technicians
  const filteredTechs = technicians.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.phone.includes(searchQuery) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTrade = techFilterTrade === 'all' || t.trades.includes(techFilterTrade);
    return matchesSearch && matchesTrade;
  });

  // Filter Customers
  const filteredCustomers = customers.filter(c => {
    const matchesAddress = c.addresses.some(a =>
      a.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.addressLine.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      matchesAddress
    );
  });

  // Filter Reviews
  const reviewedBookings = bookings.filter(b => b.review !== undefined).filter(b => {
    if (reviewRatingFilter === 'all') return true;
    return b.review?.rating === reviewRatingFilter;
  });

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col min-h-0 font-sans">
      {/* Top Header - Dark Blue Theme */}
      <header className="sticky top-0 bg-slate-950 border-b border-slate-800 px-4 py-3 z-30 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
              HQ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight">KamXApp Operations HQ</h2>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-700/60 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  <span>PREVIEW MODE</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Preview dashboard · live dispatch and financial ledger are not connected.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Firestore sync pill */}
            <button
              onClick={() => triggerFirestoreSync()}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-300 font-mono transition-colors"
              title="Click to Ping Firebase Firestore"
            >
              <RotateCw className="w-3 h-3 text-blue-400" />
              <span>{firestoreSyncStatus.latencyMs}ms</span>
            </button>

            {/* Back to Customer App */}
            <button
              onClick={() => setActiveRole('customer')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700/60 text-[10px] font-semibold transition-colors"
              title="Return to Customer App"
            >
              <span>Customer App</span>
            </button>

            {/* Logout button */}
            <button
              onClick={() => logoutUser()}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
              title="Lock Admin Console"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
          <button
            onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => { setActiveTab('customers'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Customers ({totalCustomers})</span>
          </button>

          <button
            onClick={() => { setActiveTab('technicians'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 relative ${
              activeTab === 'technicians'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Technicians ({technicians.length})</span>
            {pendingKycCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => { setActiveTab('bookings'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'bookings'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Bookings ({totalBookings})</span>
          </button>

          <button
            onClick={() => { setActiveTab('commissions'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'commissions'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Commissions & Payouts</span>
          </button>

          <button
            onClick={() => { setActiveTab('reviews'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'reviews'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>Reviews ({reviewedBookings.length})</span>
          </button>

          <button
            onClick={() => { setActiveTab('rates'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'rates' ? 'bg-emerald-700 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>Location Rates</span>
          </button>

          <button
            onClick={() => { setActiveTab('kyc'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'kyc' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>KYC Review</span>
          </button>

          <button
            onClick={() => { setActiveTab('partner_recharge'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'partner_recharge' ? 'bg-emerald-700 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Partner Recharge</span>
          </button>

          <button
            onClick={() => { setActiveTab('complaints'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'complaints' ? 'bg-amber-700 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Complaints</span>
          </button>

          <button
            onClick={() => { setActiveTab('safety'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'safety' ? 'bg-rose-700 text-white shadow-xs font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Safety / SOS</span>
          </button>

          <button
            onClick={() => { setActiveTab('firebase'); setSearchQuery(''); }}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
              activeTab === 'firebase'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-300 fill-current" />
            <span>Firestore</span>
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'rates' && <AdminRateCardsSection />}
        {activeTab === 'kyc' && <AdminKycReviewSection />}
        {activeTab === 'partner_recharge' && <AdminPartnerRechargeSection />}
        {activeTab === 'safety' && <AdminSafetyIncidentsSection />}
        {activeTab === 'complaints' && <AdminComplaintsSection />}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* 5 Primary KPIs Requested */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {/* Total Customers */}
              <div
                onClick={() => setActiveTab('customers')}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-blue-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Customers</span>
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-extrabold text-white font-mono">{totalCustomers}</div>
                <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span>Phone verification status is not available in this preview</span>
                </div>
              </div>

              {/* Total Electricians */}
              <div
                onClick={() => { setActiveTab('technicians'); setTechFilterTrade('electrician'); }}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-amber-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Electricians</span>
                  <Zap className="w-4 h-4 text-amber-400 fill-current" />
                </div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono">{totalElectricians}</div>
                <div className="text-[10px] text-slate-400">
                  {technicians.filter(t => t.trades.includes('electrician') && t.isOnline).length} Active on duty
                </div>
              </div>

              {/* Total Plumbers */}
              <div
                onClick={() => { setActiveTab('technicians'); setTechFilterTrade('plumber'); }}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-cyan-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Plumbers</span>
                  <Wrench className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-extrabold text-cyan-400 font-mono">{totalPlumbers}</div>
                <div className="text-[10px] text-slate-400">
                  {technicians.filter(t => t.trades.includes('plumber') && t.isOnline).length} Active on duty
                </div>
              </div>

              {/* Total Bookings */}
              <div
                onClick={() => setActiveTab('bookings')}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-blue-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Bookings</span>
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-white font-mono">{totalBookings}</div>
                <div className="text-[10px] text-slate-400">
                  {bookings.filter(b => b.status === 'completed').length} Fulfilled · {bookings.filter(b => b.status !== 'completed').length} Active
                </div>
              </div>

              {/* Total Revenue GMV */}
              <div
                onClick={() => setActiveTab('commissions')}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-emerald-500 transition-all space-y-1.5 md:col-span-2"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Gross Revenue (GMV)</span>
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">₹{totalRevenueGMV}</div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Platform Commission Cut: <strong className="text-blue-400 font-mono">₹{totalCommissionCut}</strong></span>
                  <span>Disbursed to Partners: <strong className="text-emerald-400 font-mono">₹{totalDisbursedNet}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Live Activity Banner */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ActivityPulse className="w-3.5 h-3.5 text-blue-400" />
                  <span>Recent Marketplace Orders</span>
                </span>
                <button
                  onClick={() => setActiveTab('bookings')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <span>Manage All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {bookings.slice(0, 4).map(b => (
                  <div
                    key={b.id}
                    className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-400">{b.id}</span>
                        <span className="font-bold text-white">{b.serviceTitle}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {b.customerName} · {b.city} · Assigned to {b.technicianName || 'Pending'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-white block">₹{b.totalAmount}</span>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                        b.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* KYC Pending Queue Highlight */}
            {pendingKycCount > 0 && (
              <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">
                      {pendingKycCount} Technician Application{pendingKycCount > 1 ? 's' : ''} Awaiting KYC Verification
                    </h4>
                    <p className="text-[11px] text-slate-400">Review trade credentials and government identification.</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('technicians')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-xs"
                >
                  Review Queue
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MANAGE CUSTOMERS ================= */}
        {activeTab === 'customers' && (
          <div className="space-y-3">
            <section className="bg-slate-950 border border-blue-700/60 rounded-2xl p-4 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-white">Customer Care — KamXApp ID Search</h3>
                <p className="text-[10px] text-slate-400 mt-1">Enter a customer's or Channel Partner's permanent ID to open their verified account record and service history.</p>
              </div>
              <div className="flex gap-2">
                <input value={quickFixLookupId} onChange={e => setQuickFixLookupId(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === 'Enter') void lookupQuickFixAccount(); }}
                  placeholder="QFC-12345678 / QFP-12345678"
                  className="min-w-0 flex-1 text-xs px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono uppercase" />
                <button type="button" onClick={() => void lookupQuickFixAccount()} disabled={quickFixLookupLoading}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
                  {quickFixLookupLoading ? 'Searching…' : 'Search ID'}
                </button>
              </div>
              {quickFixLookupError && <p className="text-xs text-rose-400">{quickFixLookupError}</p>}
              {quickFixLookup?.profile && (
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-extrabold text-blue-300">{quickFixLookup.profile.quickFixId}</span>
                    <span className="text-[10px] text-emerald-300">{quickFixLookup.profile.accountType === 'CHANNEL_PARTNER' ? 'Channel Partner' : 'Customer'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-slate-500 block">Name</span><span className="text-white">{quickFixLookup.profile.displayName}</span></div>
                    <div><span className="text-slate-500 block">Phone</span><span className="text-white">{quickFixLookup.profile.phoneNumber}</span></div>
                    <div><span className="text-slate-500 block">Email</span><span className="text-white break-all">{quickFixLookup.profile.email || '—'}</span></div>
                    <div><span className="text-slate-500 block">City / Status</span><span className="text-white">{quickFixLookup.profile.city || '—'} / {quickFixLookup.profile.accountStatus}</span></div>
                    <div><span className="text-slate-500 block">Approval / KYC</span><span className="text-white">{quickFixLookup.profile.approvalStatus} / {quickFixLookup.profile.kycStatus}</span></div>
                    {quickFixLookup.profile.walletBalance !== null && <div><span className="text-slate-500 block">Wallet balance</span><span className="text-white">₹{quickFixLookup.profile.walletBalance}</span></div>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><span className="text-slate-500 block">Identity verified</span><span className="text-white">{quickFixLookup.profile.isVerified ? 'Yes' : 'No'}</span></div>
                    {quickFixLookup.profile.accountType === 'CHANNEL_PARTNER' && <div><span className="text-slate-500 block">Duty status</span><span className="text-white">{quickFixLookup.profile.isOnline ? 'Online' : 'Offline'}</span></div>}
                  </div>
                  <div className="text-[11px] text-slate-300"><span className="text-slate-500">Address:</span> {quickFixLookup.profile.address || 'Not provided'}</div>
                  {quickFixLookup.profile.trades?.length > 0 && <div className="text-[11px] text-slate-300"><span className="text-slate-500">Services:</span> {quickFixLookup.profile.trades.join(', ')}</div>}
                  <div className="border-t border-slate-700 pt-2">
                    <div className="text-[11px] font-bold text-white mb-2">Service / Booking History ({quickFixLookup.bookingCount})</div>
                    {quickFixLookup.bookings?.length ? quickFixLookup.bookings.map((booking: any) => (
                      <div key={booking.bookingId} className="py-2 border-b border-slate-800 last:border-0 text-[10px] flex items-start justify-between gap-2">
                        <div><div className="text-slate-200">{booking.serviceTitle || 'Service booking'}</div><div className="text-slate-500">{booking.bookingId} · {booking.role} · {booking.scheduledDate || 'Date not set'}</div></div>
                        <div className="text-right"><div className="text-slate-200">{booking.status}</div><div className="text-slate-400">{booking.paymentStatus}{booking.totalAmount !== null ? ' · ₹' + booking.totalAmount : ''}</div></div>
                      </div>
                    )) : <p className="text-[10px] text-slate-500">No linked booking records were found.</p>}
                  </div>
                  {quickFixLookup.partnerRechargeHistory?.length > 0 && (
                    <div className="border-t border-slate-700 pt-2">
                      <div className="text-[11px] font-bold text-white mb-1">Partner Recharge History</div>
                      {quickFixLookup.partnerRechargeHistory.map((item: any) => (
                        <div key={item.id} className="text-[10px] text-slate-300 py-1 flex justify-between gap-2">
                          <span>{item.status} · {item.durationDays ?? '—'} days</span>
                          <span>{item.amountPaise !== null ? '₹' + (item.amountPaise / 100).toFixed(2) : 'Amount unavailable'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {quickFixLookup.kycSubmissions?.length > 0 && (
                    <div className="border-t border-slate-700 pt-2">
                      <div className="text-[11px] font-bold text-white mb-1">KYC Submission History</div>
                      {quickFixLookup.kycSubmissions.map((item: any) => (
                        <div key={item.submissionId} className="text-[10px] text-slate-300 py-1">
                          <div>{item.documentType} · {item.status}</div>
                          <div className="text-slate-500">Submitted: {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : '—'} · Reviewed: {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : 'Pending'}</div>
                          <div className="text-slate-500">Retention: {item.documentExpiryStatus}{item.documentDeletedAt ? ' · Deleted ' + new Date(item.documentDeletedAt).toLocaleDateString() : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {quickFixLookup.kycAudit?.length > 0 && (
                    <div className="border-t border-slate-700 pt-2">
                      <div className="text-[11px] font-bold text-white mb-1">KYC Review Activity</div>
                      {quickFixLookup.kycAudit.slice(0, 20).map((item: any) => (
                        <div key={item.id} className="text-[10px] text-slate-400 py-1">{item.event}{item.decision ? ' · ' + item.decision : ''}{item.reason ? ' — ' + item.reason : ''}</div>
                      ))}
                    </div>
                  )}
                  {quickFixLookup.supportTickets?.length > 0 && (
                    <div className="border-t border-slate-700 pt-2">
                      <div className="text-[11px] font-bold text-white mb-1">Customer Complaints / Support Tickets</div>
                      {quickFixLookup.supportTickets.map((ticket: any) => (
                        <div key={ticket.ticketId} className="rounded-lg border border-slate-700 p-2 my-1 text-[10px]">
                          <div className="flex justify-between gap-2 text-slate-200"><span>{ticket.subject}</span><span className="uppercase">{ticket.status}</span></div>
                          <div className="text-slate-500">{ticket.ticketId} · {ticket.category} · {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'Date unavailable'}</div>
                          <p className="text-slate-300 mt-1 whitespace-pre-wrap">{ticket.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {quickFixLookup.walletLedgerStatus === 'not_integrated' && (
                    <div className="border-t border-slate-700 pt-2 text-[10px] text-amber-300">
                      Wallet balance is shown above. A transaction ledger is not yet connected to wallet credit/debit operations, so no transaction history is claimed here.
                    </div>
                  )}
                  {quickFixLookup.accountAudit?.length > 0 && (
                    <div className="border-t border-slate-700 pt-2">
                      <div className="text-[11px] font-bold text-white mb-1">Account Activity / Admin History</div>
                      {quickFixLookup.accountAudit.slice(0, 20).map((item: any) => (
                        <div key={item.id} className="text-[10px] text-slate-400 py-1">{item.action}{item.reason ? ' — ' + item.reason : ''}</div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-amber-300">Sensitive KYC documents and full bank details are intentionally hidden from this summary.</p>
                </div>
              )}
            </section>
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search customers by name, phone, email..."
                  className="w-full text-xs pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
                />
              </div>
              <span className="text-xs font-semibold text-slate-400">{filteredCustomers.length} Customers</span>
            </div>

            <div className="space-y-2.5">
              {filteredCustomers.map(cust => (
                <div
                  key={cust.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-base">
                        {cust.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{cust.name}</h4>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            cust.status === 'suspended'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}>
                            {cust.status || 'Active'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{cust.phone}</span>
                          <span>·</span>
                          <span>{cust.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block">Lifetime Value</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        ₹{cust.totalSpent || 1240} ({cust.totalBookings || 3} orders)
                      </span>
                    </div>
                  </div>

                  {/* Primary address */}
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span className="truncate">{cust.addresses[0]?.addressLine || 'Bangalore primary residence'}</span>
                  </div>

                  {/* Customer Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => toggleCustomerStatus(cust.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        cust.status === 'suspended'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900'
                          : 'bg-slate-900 text-amber-400 border border-slate-800 hover:bg-amber-950'
                      }`}
                    >
                      {cust.status === 'suspended' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      <span>{cust.status === 'suspended' ? 'Reactivate Account' : 'Suspend Customer'}</span>
                    </button>

                    <button
                      onClick={() => deleteCustomer(cust.id)}
                      className="px-2.5 py-1 text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Archive</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 3: MANAGE TECHNICIANS ================= */}
        {activeTab === 'technicians' && (
          <div className="space-y-3">
            <section className="bg-slate-950 border border-blue-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Pending Channel Partner Profiles</h3>
                  <p className={`text-[10px] mt-1 ${adminServerAuthStatus === 'authorized' ? 'text-emerald-400' : adminServerAuthStatus === 'checking' ? 'text-amber-300' : 'text-rose-300'}`}>Server admin authorization: {adminServerAuthStatus === 'authorized' ? 'Verified' : adminServerAuthStatus === 'checking' ? 'Checking…' : adminServerAuthStatus === 'denied' ? 'Not authorized' : 'Unavailable'}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Basic profile review only. Approval does not verify KYC, qualifications, or enable job acceptance.</p>
                </div>
                <button onClick={() => void loadPendingPartners()} disabled={partnerReviewLoading} className="px-3 py-2 rounded-lg bg-slate-800 text-xs text-white disabled:opacity-50">
                  {partnerReviewLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {partnerReviewError && <p role="alert" className="text-xs text-rose-300 bg-rose-950/40 p-2 rounded-lg">{partnerReviewError}</p>}
              {partnerReviewMessage && <p role="status" className="text-xs text-emerald-300 bg-emerald-950/40 p-2 rounded-lg">{partnerReviewMessage}</p>}
              {!partnerReviewLoading && pendingPartners.length === 0 && !partnerReviewError && (
                <p className="text-xs text-slate-400">No pending partner profiles found.</p>
              )}
              {pendingPartners.map(partner => (
                <div key={partner.uid} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{partner.displayName || 'Name not provided'}</p>
                      <p className="text-[11px] text-slate-400">{partner.city || 'City not provided'} · {partner.experienceYears ?? 0} years experience</p>
                    </div>
                    <span className="text-[10px] rounded-full px-2 py-1 bg-amber-950 text-amber-300 border border-amber-800">Pending review</span>
                  </div>
                  <p className="text-[11px] text-slate-300">Trades: {(partner.trades || []).join(', ') || 'Not provided'}</p>
                  <p className="text-[11px] text-slate-300">
                    Booking radius: {partner.dispatchRadiusKm ? `${partner.dispatchRadiusKm} km` : 'Not set'}
                    {' · '}
                    GPS pin: {partner.dispatchLocationConfigured ? 'Saved' : 'Not saved'}
                  </p>
                  <p className="text-[10px] text-slate-500">KYC status: {partner.kycStatus || 'not submitted'}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button disabled={partnerReviewBusyUid === partner.uid} onClick={() => void reviewPendingPartner(partner.uid, 'approve_profile')} className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white disabled:opacity-50">
                      {partnerReviewBusyUid === partner.uid ? 'Saving…' : 'Approve Basic Profile'}
                    </button>
                    <button disabled={partnerReviewBusyUid === partner.uid} onClick={() => void reviewPendingPartner(partner.uid, 'reject')} className="px-3 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 text-xs font-bold text-white disabled:opacity-50">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </section>
            <section className="bg-slate-950 border border-emerald-800/50 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">All Channel Partners</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Registered partner directory · up to 200 profiles</p>
                </div>
                <button onClick={() => void loadChannelPartnerDirectory()} disabled={partnerDirectoryLoading} className="px-3 py-2 rounded-lg bg-slate-800 text-xs text-white disabled:opacity-50">
                  {partnerDirectoryLoading ? 'Loading…' : 'Refresh list'}
                </button>
              </div>
              {channelPartnerDirectory.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-slate-200">Category-wise partner count</h4>
                    <p className="text-[10px] text-slate-500">Loaded profiles only · a partner may appear in more than one category</p>
                    <div className="space-y-1.5">
                      {partnerCoverageByCategory.slice(0, 10).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-slate-300 truncate">{category}</span>
                          <span className="font-bold text-white tabular-nums">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                    <h4 className="text-xs font-bold text-slate-200">District / city-wise partner count</h4>
                    <p className="text-[10px] text-slate-500">Top 12 areas in the loaded directory · missing districts fall back to city</p>
                    <div className="space-y-1.5">
                      {partnerCoverageByDistrict.map(([area, count]) => (
                        <div key={area} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-slate-300 truncate">{area}</span>
                          <span className="font-bold text-white tabular-nums">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {([
                  ['all', 'All'],
                  ['approved', 'Approved'],
                  ['active', 'Dispatch ready'],
                  ['pending', 'Pending']
                ] as const).map(([value, label]) => (
                  <button key={value} onClick={() => setPartnerDirectoryFilter(value)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border ${partnerDirectoryFilter === value ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
                    {label} ({channelPartnerDirectory.filter(partner => value === 'all' ||
                      (value === 'approved' && partner.approvalStatus === 'approved') ||
                      (value === 'active' && partner.dispatchReady === true) ||
                      (value === 'pending' && partner.approvalStatus === 'pending_audit')).length})
                  </button>
                ))}
              </div>
              {partnerDirectoryLoading && channelPartnerDirectory.length === 0 && <p className="text-xs text-slate-400">Loading partner records…</p>}
              {!partnerDirectoryLoading && channelPartnerDirectory.length === 0 && <p className="text-xs text-slate-400">No registered Channel Partner records found.</p>}
              {channelPartnerDirectory.filter(partner => partnerDirectoryFilter === 'all' ||
                (partnerDirectoryFilter === 'approved' && ['approved', 'basic_profile_approved'].includes(partner.approvalStatus || '')) ||
                (partnerDirectoryFilter === 'active' && partner.dispatchEligible === true) ||
                (partnerDirectoryFilter === 'pending' && partner.approvalStatus === 'pending_audit')
              ).map(partner => (
                <div key={partner.uid} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{partner.displayName || 'Name not provided'}</p>
                      <p className="text-[11px] text-slate-400">{partner.phoneNumber || 'Phone not provided'} · {partner.city || 'City not provided'}</p>
                    </div>
                    <span className={`text-[10px] rounded-full px-2 py-1 border ${partner.dispatchEligible ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-amber-950 text-amber-300 border-amber-800'}`}>
                      {partner.dispatchReady ? 'Dispatch ready' : partner.approvalStatus || 'Not dispatch ready'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">Category: {(partner.trades || []).join(', ') || 'Not specified'}</p>
                  <p className="text-[11px] text-slate-400">Area: {[partner.serviceArea?.tehsil, partner.serviceArea?.district, partner.serviceArea?.state].filter(Boolean).join(', ') || partner.city || 'Not provided'}</p>
                  <p className="text-[11px] text-slate-300">KYC: {partner.kycStatus || 'not submitted'} · Verified: {partner.isVerified ? 'Yes' : 'No'} · Online: {partner.isOnline ? 'Yes' : 'No'}</p>
                  <p className="text-[11px] text-slate-300">Booking radius: {partner.dispatchRadiusKm ? `${partner.dispatchRadiusKm} km` : 'Not set'} · GPS pin: {partner.dispatchLocationConfigured ? 'Saved' : 'Not saved'}</p>
                  <p className="text-[10px] text-slate-500">Wallet: {partner.walletBalance === null || partner.walletBalance === undefined ? 'Not available' : `₹${partner.walletBalance}`} · Account: {partner.role || 'CHANNEL_PARTNER'}</p>
                </div>
              ))}
              <p className="text-[10px] text-slate-500">Dispatch ready means the server eligibility checks pass: approved, KYC verified, online and not suspended. GPS is shown separately.</p>
            </section>
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setTechFilterTrade('all')}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    techFilterTrade === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({technicians.length})
                </button>
                <button
                  onClick={() => setTechFilterTrade('electrician')}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    techFilterTrade === 'electrician' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Electricians ({totalElectricians})
                </button>
                <button
                  onClick={() => setTechFilterTrade('plumber')}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    techFilterTrade === 'plumber' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Plumbers ({totalPlumbers})
                </button>
                <button
                  onClick={() => setTechFilterTrade('ac_repair')}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    techFilterTrade === 'ac_repair' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AC Repair ({totalAcTechs})
                </button>
                <button
                  onClick={() => setTechFilterTrade('fridge_repair')}
                  className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    techFilterTrade === 'fridge_repair' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Fridge Repair ({totalFridgeTechs})
                </button>
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter name, phone..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Technicians List */}
            <div className="space-y-3">
              {filteredTechs.map(tech => (
                <div
                  key={tech.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center font-bold text-blue-400 text-lg">
                        {tech.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{tech.name}</h4>
                          {tech.approvalStatus === 'approved' || (tech.isVerified && tech.approvalStatus !== 'rejected') ? (
                            <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.2 rounded-full flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span>Certified & Verified</span>
                            </span>
                          ) : tech.approvalStatus === 'rejected' ? (
                            <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold px-2 py-0.2 rounded-full flex items-center gap-1">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              <span>Qualification Rejected</span>
                            </span>
                          ) : (
                            <span className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold px-2 py-0.2 rounded-full flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Qualification Audit Required</span>
                            </span>
                          )}
                          {tech.isSuspended && (
                            <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold px-2 py-0.2 rounded-full">
                              Suspended
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>{tech.phone}</span>
                          <span>·</span>
                          <span>{tech.city}</span>
                          <span>·</span>
                          <span className="text-amber-400 font-bold flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-current" />
                            <span>{tech.rating}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase">Wallet:</span>
                        <span className="font-mono font-bold text-white text-xs">
                          ₹{tech.walletBalance ?? 0}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Cash Coll: ₹{tech.lifetimeCashCollected ?? 0} · Comm Cut: ₹{tech.lifetimeCommissionPaid ?? 0}
                      </div>
                    </div>
                  </div>

                  {/* Trade Badges & Qualification Details Card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Authorized Trade:</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                          {tech.experienceYears} Years Exp
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tech.trades.map(tr => (
                          <span
                            key={tr}
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] flex items-center gap-1 ${
                              tr === 'electrician'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : tr === 'plumber'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : tr === 'ac_repair'
                                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            }`}
                          >
                            {tr === 'electrician' ? (
                              <Zap className="w-2.5 h-2.5" />
                            ) : tr === 'plumber' ? (
                              <Wrench className="w-2.5 h-2.5" />
                            ) : tr === 'ac_repair' ? (
                              <Wind className="w-2.5 h-2.5" />
                            ) : (
                              <Snowflake className="w-2.5 h-2.5" />
                            )}
                            <span>{tr.replace(/_/g, ' ')}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Trade Qualification Certificate Card */}
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                          <Award className="w-3 h-3 text-blue-400" />
                          <span>Trade Certificate / License:</span>
                        </span>
                        <span className="text-[9px] text-blue-300 font-semibold truncate max-w-[140px]">
                          {tech.qualificationType || tech.kycDocType}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-blue-300 truncate">
                        {tech.qualificationRegNumber || tech.kycDocNumber}
                      </div>
                      {tech.qualificationInstitute && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {tech.qualificationInstitute}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Per-Technician Commission Customizer by Admin HQ */}
                  {(() => {
                    const defaultCategoryPct = tech.trades.includes('electrician')
                      ? commissionSettings.electricianCommissionPct
                      : tech.trades.includes('plumber')
                      ? commissionSettings.plumberCommissionPct
                      : tech.trades.includes('ac_repair')
                      ? (commissionSettings.acCommissionPct || 15)
                      : (commissionSettings.fridgeCommissionPct || 15);

                    return (
                      <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-800 text-amber-400 flex items-center justify-center shrink-0">
                            <Percent className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">Platform Commission Cut:</span>
                              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                                tech.customCommissionPct !== undefined
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}>
                                {tech.customCommissionPct !== undefined ? `${tech.customCommissionPct}% (Admin Custom Override)` : `${defaultCategoryPct}% (Default Category Rate)`}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Admin can increase or decrease commission percentage for {tech.name}. Deducted upon job acceptance.
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const currentRate = tech.customCommissionPct ?? defaultCategoryPct;
                              const newRate = Math.max(1, currentRate - 1);
                              updateTechnicianCustomCommission(tech.id, newRate);
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                            title="Decrease commission by 1%"
                          >
                            - 1%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const currentRate = tech.customCommissionPct ?? defaultCategoryPct;
                              const newRate = Math.min(50, currentRate + 1);
                              updateTechnicianCustomCommission(tech.id, newRate);
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                            title="Increase commission by 1%"
                          >
                            + 1%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const customPrompt = prompt(`Enter custom commission percentage for ${tech.name} (1 to 50):`, (tech.customCommissionPct ?? defaultCategoryPct).toString());
                              if (customPrompt !== null && !isNaN(Number(customPrompt))) {
                                const val = Math.round(Number(customPrompt));
                                updateTechnicianCustomCommission(tech.id, Math.max(1, Math.min(50, val)));
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          >
                            Set Custom %
                          </button>
                          {tech.customCommissionPct !== undefined && (
                            <button
                              type="button"
                              onClick={() => updateTechnicianCustomCommission(tech.id, null)}
                              className="px-2 py-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-lg text-[10px] font-semibold border border-slate-700 transition-colors cursor-pointer"
                              title="Reset to category standard commission"
                            >
                              Reset Default
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sensitive partner actions stay unavailable until backed by audited server APIs. */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 gap-2">
                    <p className="text-[11px] text-amber-300">
                      KYC certification, suspension changes and rating overrides are disabled until secure server-side review and audit workflows are deployed.
                    </p>
                    <span className="text-[11px] font-mono text-slate-500">UPI: {tech.bankAccount.upiId}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 4: MANAGE BOOKINGS ================= */}
        {activeTab === 'bookings' && (
          <div className="space-y-3">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto no-scrollbar">
                {['all', 'requested', 'assigned', 'technician_en_route', 'in_progress', 'completed'].map(st => (
                  <button
                    key={st}
                    onClick={() => setBookingStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors capitalize ${
                      bookingStatusFilter === st
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'All' : st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>

              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Order ID / Customer..."
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Bookings List */}
            <div className="space-y-3">
              {filteredBookings.map(b => (
                <div
                  key={b.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-400 text-sm">{b.id}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          b.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : b.status === 'technician_en_route'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800 animate-pulse'
                            : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}>
                          {b.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.2 rounded font-mono">
                          OTP: {b.startOtp}
                        </span>
                        {b.acceptanceCommissionDebited && (
                          <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
                            Upfront Commission Debited
                          </span>
                        )}
                        {(b.status === 'technician_en_route' || b.status === 'in_progress') && (
                          <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            <span>1-Hour Delivery SLA</span>
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-white text-sm mt-1">{b.serviceTitle}</h4>
                      <p className="text-slate-400 mt-0.5">
                        Client: <strong className="text-slate-200">{b.customerName}</strong> ({b.customerPhone})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase block">Total / Cut</span>
                      <span className="font-mono font-bold text-emerald-400 text-base">₹{b.totalAmount}</span>
                      <span className="text-[10px] text-blue-400 block font-mono">Platform: ₹{b.adminCommission}</span>
                    </div>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-slate-300 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{b.customerAddress} ({b.city})</span>
                    </div>
                    {b.notes && (
                      <div className="text-[11px] text-slate-400 italic">"{b.notes}"</div>
                    )}
                  </div>

                  {/* Assigned Technician & Reassign trigger */}
                  <div className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Assigned Partner:</span>
                      <span className="font-bold text-white">
                        {b.technicianName || 'Unassigned / Open Pool'}
                      </span>
                      {b.technicianPhone && (
                        <span className="text-slate-400 text-[11px] ml-1.5">({b.technicianPhone})</span>
                      )}
                    </div>

                    <button
                      onClick={() => setReassignBookingId(b.id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Reassign Partner
                    </button>
                  </div>

                  {/* Status Dispatch Override Controls */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 gap-2">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-500 font-semibold">Change Status:</span>
                      {(['assigned', 'technician_en_route', 'in_progress', 'completed'] as BookingStatus[]).map(st => (
                        <button
                          key={st}
                          onClick={() => updateBookingStatus(b.id, st, b.startOtp)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase transition-colors ${
                            b.status === st
                              ? 'bg-blue-600 text-white font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {st.replace(/technician_/g, '').replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => deleteBooking(b.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Cancel Booking"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Reassignment Modal */}
            {reassignBookingId && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="w-full max-w-sm bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">Reassign Booking {reassignBookingId}</h3>
                    <button
                      onClick={() => setReassignBookingId(null)}
                      className="w-7 h-7 rounded-full bg-slate-900 text-slate-400 hover:text-white flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">Select an online verified technician to dispatch:</p>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {technicians.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          reassignBookingTechnician(reassignBookingId, t.id);
                          setReassignBookingId(null);
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-800 hover:border-blue-500 hover:bg-slate-900 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-white">{t.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{t.trades.join(', ')} · {t.city}</div>
                        </div>
                        <span className="text-amber-400 font-bold">{t.rating} ★</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: PAYMENT & COMMISSION MANAGEMENT ================= */}
        {activeTab === 'commissions' && (
          <div className="space-y-4">
            {/* Header with Firestore Sync Badge */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-emerald-400" />
                  <span>Payment & Commission Management</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time payment settlements, platform revenue splits, daily/monthly audit reports & Firestore sync
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-300">Firestore Realtime:</span>
                  <span className="text-emerald-400 font-bold">{firestoreSyncStatus.latencyMs}ms</span>
                </div>
                <button
                  onClick={() => triggerFirestoreSync()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Payments</span>
                </button>
              </div>
            </div>

            {/* Backend action notice: no success is implied for disabled client-side mutations. */}
            {statusUpdateNoticeMsg && (
              <div role="status" className="p-3 bg-amber-950/80 border border-amber-700 rounded-xl text-amber-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{statusUpdateNoticeMsg}</span>
              </div>
            )}

            {/* 4 Financial KPI Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Total Payments Received */}
              <div
                onClick={() => { setPaymentSubTab('history'); setPaymentStatusFilter('paid'); }}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-emerald-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Total Payments Received</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                  ₹{totalPaymentsReceived.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="text-emerald-300 font-semibold">{countPaymentsReceived} Paid Orders</span>
                  <span className="text-[10px] text-slate-500">Realized Cash</span>
                </div>
              </div>

              {/* Pending Payments */}
              <div
                onClick={() => { setPaymentSubTab('history'); setPaymentStatusFilter('pending'); }}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-amber-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Pending Payments</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-amber-400 font-mono">
                  ₹{totalPendingPayments.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="text-amber-300 font-semibold">{countPendingPayments} Pending</span>
                  <span className="text-[10px] text-slate-500">COD / In-Transit</span>
                </div>
              </div>

              {/* Technician Payments */}
              <div
                onClick={() => setPaymentSubTab('payouts')}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-blue-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Technician Payments</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-blue-400 font-mono">
                  ₹{totalTechnicianPayments.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Earned by Partners</span>
                  <span className="font-mono text-cyan-300 text-[10px]">₹{technicianWalletPending} in Wallets</span>
                </div>
              </div>

              {/* Platform Commission */}
              <div
                onClick={() => setPaymentSubTab('settings')}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-md cursor-pointer hover:border-purple-500 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-[10px] uppercase font-bold tracking-wider">Platform Commission</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-purple-400 font-mono">
                  ₹{totalPlatformCommission.toLocaleString('en-IN')}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="text-purple-300 font-semibold">Net Platform Margin</span>
                  <span className="text-[10px] text-slate-500">Elec {elecRate}% · Plumb {plumbRate}%</span>
                </div>
              </div>
            </div>

            {/* Sub-Navigation Pill Bar */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs overflow-x-auto no-scrollbar">
              <button
                onClick={() => setPaymentSubTab('history')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  paymentSubTab === 'history'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Booking Payments & Refunds ({bookings.length})</span>
              </button>

              <button
                onClick={() => setPaymentSubTab('payouts')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  paymentSubTab === 'payouts'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Technician Payouts & Approvals</span>
                {payouts.filter(p => p.adminApprovalStatus === 'pending_approval' || p.status === 'processing').length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold animate-pulse">
                    {payouts.filter(p => p.adminApprovalStatus === 'pending_approval' || p.status === 'processing').length} PENDING
                  </span>
                )}
              </button>

              <button
                onClick={() => setPaymentSubTab('admin_account')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  paymentSubTab === 'admin_account'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                <span>Admin Master Account & Gateway</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-bold">
                  ACTIVE
                </span>
              </button>

              <button
                onClick={() => setPaymentSubTab('reports')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  paymentSubTab === 'reports'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Daily & Monthly Reports</span>
              </button>

              <button
                onClick={() => setPaymentSubTab('settings')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  paymentSubTab === 'settings'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Commission Settings</span>
              </button>

              <button
                onClick={() => setPaymentSubTab('geofence')}
                className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  paymentSubTab === 'geofence'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Navigation className="w-3.5 h-3.5 text-blue-400" />
                <span>Service Radius Zones ({serviceZones.length})</span>
              </button>
            </div>

            {/* ================= SUB-TAB 1: BOOKING-WISE PAYMENT HISTORY ================= */}
            {paymentSubTab === 'history' && (
              <div className="space-y-3">
                {/* Search & Filter Toolbar */}
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={paymentSearchQuery}
                        onChange={e => setPaymentSearchQuery(e.target.value)}
                        placeholder="Search Booking ID, Customer, Phone, Technician, UTR..."
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 font-mono"
                      />
                      {paymentSearchQuery && (
                        <button
                          onClick={() => setPaymentSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                      {(['all', 'electrician', 'plumber'] as const).map(cat => (
                        <button
                          key={cat}
                          onClick={() => setPaymentCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg font-medium capitalize transition-colors ${
                            paymentCategoryFilter === cat
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {cat === 'all' ? 'All Trades' : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status & Method Filters Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    {/* Payment Status Filter Buttons */}
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-semibold mr-1">Status:</span>
                      <button
                        onClick={() => setPaymentStatusFilter('all')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                          paymentStatusFilter === 'all'
                            ? 'bg-slate-800 text-white font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        All ({bookings.length})
                      </button>
                      <button
                        onClick={() => setPaymentStatusFilter('paid')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                          paymentStatusFilter === 'paid'
                            ? 'bg-emerald-600 text-white font-bold'
                            : 'text-emerald-400 hover:bg-emerald-950/60'
                        }`}
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Paid ({paidBookings.length})</span>
                      </button>
                      <button
                        onClick={() => setPaymentStatusFilter('pending')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                          paymentStatusFilter === 'pending'
                            ? 'bg-amber-600 text-white font-bold'
                            : 'text-amber-400 hover:bg-amber-950/60'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>Pending ({pendingBookings.length})</span>
                      </button>
                      <button
                        onClick={() => setPaymentStatusFilter('failed')}
                        className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                          paymentStatusFilter === 'failed'
                            ? 'bg-rose-600 text-white font-bold'
                            : 'text-rose-400 hover:bg-rose-950/60'
                        }`}
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Failed ({failedBookings.length})</span>
                      </button>
                    </div>

                    {/* Payment Method Filter */}
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500 font-semibold mr-1">Method:</span>
                      {(['all', 'upi', 'card', 'cash', 'netbanking'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setPaymentMethodFilter(m)}
                          className={`px-2 py-0.5 rounded text-[11px] uppercase font-mono font-semibold transition-colors ${
                            paymentMethodFilter === m
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-400 hover:text-white hover:bg-slate-900'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Transactions List */}
                <div className="space-y-3">
                  {filteredTransactions.length === 0 ? (
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 space-y-2">
                      <Receipt className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-sm font-semibold text-slate-300">No payment transactions match your filters.</p>
                      <button
                        onClick={() => {
                          setPaymentStatusFilter('all');
                          setPaymentMethodFilter('all');
                          setPaymentCategoryFilter('all');
                          setPaymentSearchQuery('');
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    filteredTransactions.map(b => (
                      <div
                        key={b.id}
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 text-xs hover:border-slate-700 transition-all"
                      >
                        {/* Transaction Top Row */}
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-400 text-sm">{b.id}</span>
                              {/* Status Badge */}
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                b.paymentStatus === 'paid'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                  : b.paymentStatus === 'pending'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-700 animate-pulse'
                                  : 'bg-rose-950 text-rose-300 border border-rose-700'
                              }`}>
                                {b.paymentStatus === 'paid' && <CheckCircle className="w-2.5 h-2.5" />}
                                {b.paymentStatus === 'pending' && <Clock className="w-2.5 h-2.5" />}
                                {b.paymentStatus === 'failed' && <XCircle className="w-2.5 h-2.5" />}
                                <span>{b.paymentStatus}</span>
                              </span>

                              {/* Method Badge */}
                              <span className="text-[10px] font-mono uppercase bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded">
                                {b.paymentMethod}
                              </span>

                              {/* Category Badge */}
                              <span className="text-[10px] uppercase font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/60 px-1.5 py-0.5 rounded">
                                {b.category}
                              </span>
                            </div>

                            <h4 className="font-bold text-white text-sm mt-1">{b.serviceTitle}</h4>
                            <p className="text-slate-400 mt-0.5">
                              Customer: <strong className="text-slate-200">{b.customerName}</strong> ({b.customerPhone})
                            </p>
                          </div>

                          {/* Amounts Column */}
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase block font-semibold">Total Invoiced</span>
                            <span className="font-mono font-bold text-white text-base">₹{b.totalAmount}</span>
                            <div className="flex items-center justify-end gap-2 text-[10px] mt-0.5 font-mono">
                              <span className="text-purple-400">Commission: ₹{b.adminCommission} ({b.commissionRate}%)</span>
                              <span className="text-slate-600">|</span>
                              <span className="text-emerald-400">Tech: ₹{b.technicianPayout}</span>
                            </div>
                          </div>
                        </div>

                        {/* Reference and Timestamp Bar */}
                        <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-slate-500">Transaction Ref:</span>
                            <span className="text-blue-300 font-semibold">{b.transactionRef || 'Pending Gateway Allocation'}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span>Booked: {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            {b.paidAt && (
                              <span className="text-emerald-400">
                                Paid: {new Date(b.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            <span>Partner: <strong className="text-slate-200">{b.technicianName || 'Unassigned'}</strong></span>
                          </div>
                        </div>

                        {/* Payment Actions Row */}
                        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-800 gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] text-amber-300">
                              Payment actions are disabled. KamXApp has no verified payment gateway or escrow settlement connected; this screen does not confirm receipt, refund, or custody of funds.
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* View Invoice / Receipt Button */}
                            <button
                              onClick={() => setSelectedReceiptBooking(b)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-blue-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Receipt className="w-3.5 h-3.5 text-blue-400" />
                              <span>View Tax Invoice</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ================= SUB-TAB 2: DAILY & MONTHLY REVENUE REPORTS ================= */}
            {paymentSubTab === 'reports' && (
              <div className="space-y-4">
                {/* Report Switcher & Highlights */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-400" />
                      <span>Revenue Intelligence & Financial Audit Reports</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Aggregated GMV, platform commission splits, technician earnings and volume analytics
                    </p>
                  </div>

                  <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setReportPeriod('daily')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        reportPeriod === 'daily'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Daily Reports ({dailyGroups.length} Days)
                    </button>
                    <button
                      onClick={() => setReportPeriod('monthly')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                        reportPeriod === 'monthly'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Monthly Reports ({monthlyGroups.length} Months)
                    </button>
                  </div>
                </div>

                {/* DAILY REPORT VIEW */}
                {reportPeriod === 'daily' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 text-[11px] block">Average Daily GMV</span>
                        <span className="text-xl font-bold font-mono text-emerald-400">
                          ₹{Math.round(totalRevenueGMV / (dailyGroups.length || 1))}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Across {dailyGroups.length} recorded service dates</span>
                      </div>
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 text-[11px] block">Highest Revenue Day</span>
                        <span className="text-xl font-bold font-mono text-blue-400">
                          ₹{Math.max(...dailyGroups.map(d => d.totalGmv))}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Peak day volume</span>
                      </div>
                      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 text-[11px] block">Realized Cash Ratio</span>
                        <span className="text-xl font-bold font-mono text-purple-400">
                          {Math.round((totalPaymentsReceived / (totalRevenueGMV || 1)) * 100)}%
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Payment realization efficiency</span>
                      </div>
                    </div>

                    {/* Daily Breakdown Cards */}
                    <div className="space-y-3">
                      {dailyGroups.map(group => {
                        const paidCount = group.bookings.filter(b => b.paymentStatus === 'paid').length;
                        const pendingCount = group.bookings.filter(b => b.paymentStatus === 'pending').length;
                        const failedCount = group.bookings.filter(b => b.paymentStatus === 'failed').length;
                        const realizationPct = Math.round((group.paidGmv / (group.totalGmv || 1)) * 100);

                        return (
                          <div
                            key={group.date}
                            className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                              <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-blue-400" />
                                <span className="font-bold text-white text-sm">{group.displayDate}</span>
                                <span className="bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded">
                                  {group.bookings.length} Orders
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-slate-400">Realized: <strong className="text-emerald-400 font-mono">₹{group.paidGmv}</strong></span>
                                <span className="text-slate-400">Pending: <strong className="text-amber-400 font-mono">₹{group.pendingGmv}</strong></span>
                                <span className="text-slate-400">Total GMV: <strong className="text-white font-mono text-sm">₹{group.totalGmv}</strong></span>
                              </div>
                            </div>

                            {/* Proportional Volume Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>Realization: {realizationPct}%</span>
                                <span>{paidCount} Paid · {pendingCount} Pending · {failedCount} Failed</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden flex">
                                <div style={{ width: `${realizationPct}%` }} className="bg-emerald-500 h-full" title="Paid" />
                                <div style={{ width: `${Math.round((group.pendingGmv / (group.totalGmv || 1)) * 100)}%` }} className="bg-amber-500 h-full" title="Pending" />
                                <div style={{ width: `${Math.round((group.failedGmv / (group.totalGmv || 1)) * 100)}%` }} className="bg-rose-500 h-full" title="Failed" />
                              </div>
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono">
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-sans block">Platform Commission</span>
                                <span className="text-sm font-bold text-purple-400">₹{group.commission}</span>
                              </div>
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-sans block">Technician Share</span>
                                <span className="text-sm font-bold text-blue-400">₹{group.techPayout}</span>
                              </div>
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-sans block">Pending Inflow</span>
                                <span className="text-sm font-bold text-amber-400">₹{group.pendingGmv}</span>
                              </div>
                              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                                <span className="text-[10px] text-slate-500 uppercase font-sans block">Failed Value</span>
                                <span className="text-sm font-bold text-rose-400">₹{group.failedGmv}</span>
                              </div>
                            </div>

                            {/* Mini Orders List */}
                            <div className="text-[11px] text-slate-400 flex flex-wrap gap-2 pt-1">
                              {group.bookings.map(b => (
                                <span
                                  key={b.id}
                                  onClick={() => setSelectedReceiptBooking(b)}
                                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded cursor-pointer font-mono text-slate-300 flex items-center gap-1"
                                >
                                  <span>{b.id}</span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    b.paymentStatus === 'paid' ? 'bg-emerald-400' : b.paymentStatus === 'pending' ? 'bg-amber-400' : 'bg-rose-400'
                                  }`} />
                                  <span>₹{b.totalAmount}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MONTHLY REPORT VIEW */}
                {reportPeriod === 'monthly' && (
                  <div className="space-y-4">
                    {monthlyGroups.map(m => {
                      const paidOrders = m.bookings.filter(b => b.paymentStatus === 'paid').length;
                      const aov = Math.round(m.totalGmv / (m.bookings.length || 1));
                      const realizationRate = Math.round((m.paidGmv / (m.totalGmv || 1)) * 100);

                      return (
                        <div
                          key={m.month}
                          className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div>
                              <h4 className="text-base font-bold text-white flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <span>{m.label}</span>
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Consolidated performance for {m.bookings.length} service requests
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Billed GMV</span>
                              <span className="text-2xl font-extrabold text-emerald-400 font-mono">₹{m.totalGmv.toLocaleString('en-IN')}</span>
                            </div>
                          </div>

                          {/* 4 Monthly Metrics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Realized Cash</span>
                              <span className="text-base font-bold text-emerald-400">₹{m.paidGmv.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">{paidOrders} Orders Paid</span>
                            </div>

                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Platform Net Commission</span>
                              <span className="text-base font-bold text-purple-400">₹{m.commission.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                                {Math.round((m.commission / (m.paidGmv || 1)) * 100)}% Platform Margin
                              </span>
                            </div>

                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Technicians Disbursed</span>
                              <span className="text-base font-bold text-blue-400">₹{m.techPayout.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">Direct Partner Share</span>
                            </div>

                            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                              <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Avg Order Value (AOV)</span>
                              <span className="text-base font-bold text-white">₹{aov}</span>
                              <span className="text-[10px] text-slate-400 font-sans block mt-0.5">{realizationRate}% Realization</span>
                            </div>
                          </div>

                          {/* Category Revenue Breakdown */}
                          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span>Trade Contribution Breakdown</span>
                              <span className="text-slate-400 font-normal">Electrician vs Plumber GMV</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                                <span className="text-slate-400 block text-[11px]">⚡ Electrician Services</span>
                                <span className="font-mono font-bold text-amber-400 text-sm">₹{m.elecGmv}</span>
                                <span className="text-[10px] text-slate-500 block">
                                  {Math.round((m.elecGmv / (m.totalGmv || 1)) * 100)}% of month GMV
                                </span>
                              </div>

                              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                                <span className="text-slate-400 block text-[11px]">🔧 Plumber Services</span>
                                <span className="font-mono font-bold text-cyan-400 text-sm">₹{m.plumbGmv}</span>
                                <span className="text-[10px] text-slate-500 block">
                                  {Math.round((m.plumbGmv / (m.totalGmv || 1)) * 100)}% of month GMV
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================= SUB-TAB 3: COMMISSION PERCENTAGE SETTINGS & SIMULATOR ================= */}
            {paymentSubTab === 'settings' && (
              <div className="space-y-4">
                {/* Form to Configure Rates */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Percent className="w-4 h-4 text-blue-400" />
                      <span>Category Commission Rate Architecture</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure category-wise percentage cuts and platform convenience fees with instant Firestore persistence.
                    </p>
                  </div>

                  <form onSubmit={handleSaveCommission} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="font-bold text-slate-200 block">
                          Electrician Platform Commission (%)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="40"
                            value={elecRate}
                            onChange={e => setElecRate(Number(e.target.value))}
                            className="w-24 p-2 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400">% retained from electrical repair bookings</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="30"
                          value={elecRate}
                          onChange={e => setElecRate(Number(e.target.value))}
                          className="w-full accent-blue-500 mt-1"
                        />
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="font-bold text-slate-200 block">
                          Plumber Platform Commission (%)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="40"
                            value={plumbRate}
                            onChange={e => setPlumbRate(Number(e.target.value))}
                            className="w-24 p-2 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400">% retained from plumbing service bookings</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="30"
                          value={plumbRate}
                          onChange={e => setPlumbRate(Number(e.target.value))}
                          className="w-full accent-blue-500 mt-1"
                        />
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="font-bold text-slate-200 block">
                          AC Repair Platform Commission (%)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="40"
                            value={acRate}
                            onChange={e => setAcRate(Number(e.target.value))}
                            className="w-24 p-2 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400">% retained from AC jet clean & repair bookings</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="30"
                          value={acRate}
                          onChange={e => setAcRate(Number(e.target.value))}
                          className="w-full accent-blue-500 mt-1"
                        />
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="font-bold text-slate-200 block">
                          Fridge / Freezer Platform Commission (%)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="40"
                            value={fridgeRate}
                            onChange={e => setFridgeRate(Number(e.target.value))}
                            className="w-24 p-2 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400">% retained from refrigerator gas/cooling bookings</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="30"
                          value={fridgeRate}
                          onChange={e => setFridgeRate(Number(e.target.value))}
                          className="w-full accent-blue-500 mt-1"
                        />
                      </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="font-bold text-slate-200 block">
                          Platform Visiting & Convenience Fee (₹)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="199"
                            value={convFee}
                            onChange={e => setConvFee(Number(e.target.value))}
                            className="w-24 p-2 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400">Fixed convenience fee added to customer invoice</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <label className="font-bold text-slate-200 block">
                          Minimum Payout Threshold (₹)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="100"
                            max="2000"
                            step="50"
                            value={minPayout}
                            onChange={e => setMinPayout(Number(e.target.value))}
                            className="w-24 p-2 rounded-xl border border-slate-700 bg-slate-950 text-white font-mono font-bold text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                          <span className="text-slate-400">Minimum wallet balance for UPI withdrawal</span>
                        </div>
                      </div>
                    </div>

                    {saveMessage && (
                      <div role="status" className="p-3 bg-amber-950 border border-amber-700 rounded-xl text-amber-200 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>{saveMessage}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors shadow-xs flex items-center gap-2"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Preview only — commission changes are not saved</span>
                    </button>
                  </form>
                </div>

                {/* Interactive Real-Time Commission Simulator */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Live Order Fee Split Simulator</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Test how an order is divided between Platform Commission, GST 18%, and Technician Net Take-Home
                    </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">Simulate Job Base Amount:</span>
                      <span className="font-mono font-bold text-white text-base">₹{simulatorAmount}</span>
                    </div>

                    <input
                      type="range"
                      min="100"
                      max="3000"
                      step="50"
                      value={simulatorAmount}
                      onChange={e => setSimulatorAmount(Number(e.target.value))}
                      className="w-full accent-emerald-500"
                    />

                    {/* Calculation breakdown */}
                    {(() => {
                      const base = simulatorAmount;
                      const fee = convFee;
                      const taxes = Math.round((base + fee) * 0.18);
                      const totalCustomerPays = base + fee + taxes;
                      const elecCut = Math.round(base * (elecRate / 100)) + fee;
                      const elecTechTakeHome = totalCustomerPays - elecCut - taxes;
                      const plumbCut = Math.round(base * (plumbRate / 100)) + fee;
                      const plumbTechTakeHome = totalCustomerPays - plumbCut - taxes;

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 font-mono">
                          {/* Electrician split */}
                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                            <span className="font-sans font-bold text-amber-400 text-xs block">
                              Electrician Job ({elecRate}% rate)
                            </span>
                            <div className="flex justify-between text-slate-400">
                              <span>Customer Pays:</span>
                              <strong className="text-white">₹{totalCustomerPays}</strong>
                            </div>
                            <div className="flex justify-between text-purple-300">
                              <span>Platform Retained:</span>
                              <strong>₹{elecCut}</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>GST (18% Govt):</span>
                              <strong>₹{taxes}</strong>
                            </div>
                            <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800 font-bold text-sm">
                              <span>Tech Net Take-Home:</span>
                              <span>₹{elecTechTakeHome}</span>
                            </div>
                          </div>

                          {/* Plumber split */}
                          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                            <span className="font-sans font-bold text-cyan-400 text-xs block">
                              Plumber Job ({plumbRate}% rate)
                            </span>
                            <div className="flex justify-between text-slate-400">
                              <span>Customer Pays:</span>
                              <strong className="text-white">₹{totalCustomerPays}</strong>
                            </div>
                            <div className="flex justify-between text-purple-300">
                              <span>Platform Retained:</span>
                              <strong>₹{plumbCut}</strong>
                            </div>
                            <div className="flex justify-between text-slate-400">
                              <span>GST (18% Govt):</span>
                              <strong>₹{taxes}</strong>
                            </div>
                            <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800 font-bold text-sm">
                              <span>Tech Net Take-Home:</span>
                              <span>₹{plumbTechTakeHome}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ================= SUB-TAB 4: TECHNICIAN PAYOUTS & ESCROW APPROVALS ================= */}
            {paymentSubTab === 'payouts' && (
              <PendingPayoutsSection
                onNotify={(msg) => {
                  setStatusUpdateNoticeMsg(msg);
                  setTimeout(() => setStatusUpdateNoticeMsg(''), 4500);
                }}
              />
            )}

            {/* ================= SUB-TAB 5: ADMIN MASTER ACCOUNT & GATEWAY CONFIG ================= */}
            {paymentSubTab === 'admin_account' && (
              <div className="space-y-4">
                {/* Overview Header */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-indigo-400" />
                      <span>Admin Master Account & Payment Gateway Routing</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Payment routing is not configured. This app does not collect or hold customer funds.
                    </p>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-xs font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>ESCROW NOT CONFIGURED</span>
                  </span>
                </div>

                {/* Success Notification */}
                {adminConfigSavedMsg && (
                  <div role="status" className="p-3 bg-amber-950/80 border border-amber-700 rounded-xl text-amber-200 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>{adminConfigSavedMsg}</span>
                  </div>
                )}

                {/* Current Active Routing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Master Platform UPI</div>
                    <div className="text-base font-bold text-indigo-400 font-mono">Not configured</div>
                    <p className="text-[11px] text-slate-500">No live UPI routing is configured.</p>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Settlement Bank Account</div>
                    <div className="text-sm font-bold text-white">{savedBankSummary?.bankName || 'No bank account saved'}</div>
                    <div className="text-xs font-mono text-slate-300">A/C: {savedBankSummary ? '•••• ' + savedBankSummary.accountLast4 : 'Not configured'} · {savedBankSummary?.accountType === 'current' ? 'Current' : 'Savings'}</div>
                    <div className="text-[11px] font-mono text-slate-500">IFSC: {savedBankSummary?.ifsc || 'Not configured'}</div>
                  </div>

                  <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Gateway & Escrow Mode</div>
                    <div className="text-sm font-bold text-amber-300">Not configured</div>
                    <div className="text-[11px] text-slate-400">Merchant ID: not connected</div>
                    <div className="text-[10px] text-indigo-300 font-semibold">Server-side payout approval: not configured</div>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                  <h5 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    <span>Configure Corporate Merchant & Escrow Rules</span>
                  </h5>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Corporate Entity Name</label>
                      <input
                        type="text"
                        value={adminMerchantName}
                        onChange={e => setAdminMerchantName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Master Platform Receiving UPI VPA</label>
                      <input
                        type="text"
                        value={adminVpa}
                        onChange={e => setAdminVpa(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Select Settlement Bank</label>
                      <select
                        value={adminBankName}
                        onChange={e => setAdminBankName(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="">Choose your bank</option>
                        {INDIAN_BANK_OPTIONS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Account Type</label>
                      <select value={adminAccountType} onChange={e => setAdminAccountType(e.target.value as 'savings' | 'current')} className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium">
                        <option value="savings">Savings Account</option>
                        <option value="current">Current Account</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Account Holder Name</label>
                      <input type="text" value={adminAccountHolder} onChange={e => setAdminAccountHolder(e.target.value)} maxLength={100} autoComplete="off" className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium" />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">New Bank Account Number</label>
                      <input
                        type="text"
                        value={adminAccountNo}
                        onChange={e => setAdminAccountNo(e.target.value)}
                        placeholder={savedBankSummary ? "Enter new number to replace •••• " + savedBankSummary.accountLast4 : "Enter account number"}
                        inputMode="numeric"
                        autoComplete="off"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Bank IFSC Code</label>
                      <input
                        type="text"
                        value={adminIfsc}
                        onChange={e => setAdminIfsc(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-400 block mb-1">Payment Gateway Engine</label>
                      <select
                        value={adminGateway}
                        onChange={e => setAdminGateway(e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Razorpay Escrow & Cashfree Payouts API">Razorpay Escrow & Cashfree Payouts API</option>
                        <option value="Paytm Business & Payouts API">Paytm Business & Payouts API</option>
                        <option value="Direct Bank IMPS / NEFT Integration">Direct Bank IMPS / NEFT Integration</option>
                      </select>
                    </div>
                  </div>

                  {/* Security Toggles */}
                  <div className="pt-3 border-t border-slate-800 space-y-3 text-xs">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={adminManualApproval}
                        onChange={e => setAdminManualApproval(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                      />
                      <div>
                        <strong className="text-white block">Manual payout approval (preview only)</strong>
                        <span className="text-slate-400 text-[11px]">
                          Payout release is disabled until a trusted server-side payment and ledger workflow is deployed.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
                      <input
                        type="checkbox"
                        checked={adminEscrowEnabled}
                        onChange={e => setAdminEscrowEnabled(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                      />
                      <div>
                        <strong className="text-white block">Buyer escrow (preview only)</strong>
                        <span className="text-slate-400 text-[11px]">
                          No customer funds are held. Escrow is not configured.
                        </span>
                      </div>
                    </label>
                  </div>

                  {/* Save Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={async () => {
                        setAdminConfigSavedMsg('');
                        const firebaseUser = auth.currentUser;
                        if (!firebaseUser) { setAdminConfigSavedMsg('Please sign in again as an authorized admin.'); return; }
                        try {
                          const token = await firebaseUser.getIdToken(true);
                          const response = await fetch('/api/admin/payment-bank', {
                            method: 'PUT',
                            headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bankName: adminBankName, accountType: adminAccountType, accountHolderName: adminAccountHolder, accountNumber: adminAccountNo, ifsc: adminIfsc })
                          });
                          const result = await response.json();
                          if (!response.ok || !result.success) throw new Error(result.error || 'Bank details could not be saved.');
                          setAdminAccountNo('');
                          setAdminConfigSavedMsg('Bank details securely saved. Account ending ' + result.accountLast4 + '. Payments and payouts remain disabled until separately verified and configured.');
                        } catch (error) {
                          setAdminConfigSavedMsg(error instanceof Error ? error.message : 'Bank details could not be saved securely.');
                        }
                      }}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Admin Bank Details Securely</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SUB-TAB 6: GEO-FENCE & SERVICE RADIUS ZONES ================= */}
            {paymentSubTab === 'geofence' && (
              <div className="space-y-4">
                {/* Geofence Admin Hero Banner */}
                <div className="bg-gradient-to-r from-slate-950 via-blue-950/40 to-slate-950 border border-blue-900/60 rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span>Geo-fence & Service Radius Zones (Firestore Geolocation)</span>
                      </h4>
                    </div>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Restricts technician duty status updates (Online/Offline) to defined operating perimeters. Enforces KamXApp 1-Hour SLA delivery.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      Active Hubs: <strong className="text-emerald-400 font-mono">{serviceZones.filter(z => z.isActive).length}</strong> / {serviceZones.length}
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      Online Partners: <strong className="text-blue-400 font-mono">{technicians.filter(t => t.isOnline).length}</strong>
                    </span>
                  </div>
                </div>

                {/* Operating Service Zones Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {serviceZones.map(zone => {
                    const onlineCount = technicians.filter(
                      t => t.isOnline && (t.currentLocation?.zoneId === zone.id || t.city.toLowerCase() === zone.city.toLowerCase())
                    ).length;

                    return (
                      <div
                        key={zone.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 ${
                          zone.isActive
                            ? 'bg-slate-950/80 border-slate-800 shadow-xs'
                            : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-white text-sm">{zone.name}</h5>
                              <span className="px-2 py-0.5 rounded-md bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-bold">
                                {zone.city}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {zone.description}
                            </p>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                              zone.isActive
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {zone.isActive ? 'Active Perimeter' : 'Disabled'}
                          </span>
                        </div>

                        {/* Coordinates & Radius Metric */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Center GPS:</span>
                            <span className="text-slate-200 font-semibold">
                              {zone.center.lat.toFixed(4)}, {zone.center.lng.toFixed(4)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Duty Radius:</span>
                            <span className="text-emerald-400 font-bold text-sm">
                              {zone.radiusKm} km
                            </span>
                          </div>
                        </div>

                        {/* Coverage Locality Tags */}
                        {zone.coverageAreas && zone.coverageAreas.length > 0 && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                              Covered Localities & Hubs
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {zone.coverageAreas.slice(0, 6).map((area, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-slate-900 text-slate-300 text-[10px] border border-slate-800"
                                >
                                  {area}
                                </span>
                              ))}
                              {zone.coverageAreas.length > 6 && (
                                <span className="px-1.5 py-0.5 text-[10px] text-slate-400">
                                  +{zone.coverageAreas.length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Admin Radius Adjuster & Toggle Controls */}
                        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400 text-[11px]">Radius:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newR = Math.max(5, zone.radiusKm - 2);
                                updateServiceZoneRadius(zone.id, newR);
                              }}
                              className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-white px-1">{zone.radiusKm} km</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newR = Math.min(60, zone.radiusKm + 2);
                                updateServiceZoneRadius(zone.id, newR);
                              }}
                              className="w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">
                              {onlineCount} Online
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleServiceZoneActive(zone.id)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                                zone.isActive
                                  ? 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                                  : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {zone.isActive ? 'Deactivate' : 'Activate Zone'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: RATINGS & REVIEWS ================= */}
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            {/* Rating Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto no-scrollbar">
              <button
                onClick={() => setReviewRatingFilter('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                  reviewRatingFilter === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Reviews ({bookings.filter(b => b.review).length})
              </button>
              {[5, 4, 3].map(st => (
                <button
                  key={st}
                  onClick={() => setReviewRatingFilter(st)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors flex items-center gap-1 ${
                    reviewRatingFilter === st ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{st} Stars</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </button>
              ))}
            </div>

            {/* Review Cards */}
            <div className="space-y-3">
              {reviewedBookings.map(b => (
                <div
                  key={b.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{b.customerName}</span>
                        <span className="text-slate-500">reviewed</span>
                        <span className="text-blue-400 font-semibold">{b.technicianName}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{b.serviceTitle} · Booking {b.id}</span>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(b.review?.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>

                  {/* Comment & Tags */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800/80 space-y-2">
                    <p className="text-slate-200 italic leading-relaxed">"{b.review?.comment}"</p>
                    <div className="flex flex-wrap gap-1">
                      {b.review?.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-slate-800 text-blue-300 rounded text-[10px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Existing Admin Reply if present */}
                  {b.review?.adminReply && (
                    <div className="bg-blue-950/40 border border-blue-900/60 p-2.5 rounded-xl text-[11px] space-y-1">
                      <span className="text-blue-400 font-bold block flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>KamXApp Official Response:</span>
                      </span>
                      <p className="text-slate-300 italic">{b.review.adminReply}</p>
                    </div>
                  )}

                  {/* Reply Form */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                    <input
                      type="text"
                      value={replyTextMap[b.id] || ''}
                      onChange={e => setReplyTextMap({ ...replyTextMap, [b.id]: e.target.value })}
                      placeholder="Write an official customer feedback reply..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
                    />
                    <button
                      onClick={() => handleSendReviewReply(b.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      <span>Reply</span>
                    </button>
                    <button
                      onClick={() => deleteReview(b.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete Review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= TAB 7: FIREBASE INTEGRATION ================= */}
        {activeTab === 'firebase' && (
          <div className="space-y-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400 fill-current" />
                    <span>Real-Time Cloud Firestore Sync</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Active document listener status & database synchronization heartbeat
                  </p>
                </div>

                <button
                  onClick={() => triggerFirestoreSync()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Test Connection</span>
                </button>
              </div>

              {/* Status grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Auth Provider</span>
                  <span className="text-xs font-bold text-emerald-400">Firebase Phone Auth</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Latency</span>
                  <span className="text-xs font-bold font-mono text-white">{firestoreSyncStatus.latencyMs} ms</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Last Heartbeat</span>
                  <span className="text-xs font-bold text-blue-300">{firestoreSyncStatus.lastSynced}</span>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Security Model</span>
                  <span className="text-xs font-bold text-amber-400">Zero-Trust RBAC</span>
                </div>
              </div>

              {/* Collections Status */}
              <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                <div className="bg-slate-900 px-3.5 py-2 font-bold text-slate-300 border-b border-slate-800">
                  Synchronized Firestore Collections
                </div>
                <div className="divide-y divide-slate-800/80">
                  <div className="p-3 flex items-center justify-between bg-slate-950">
                    <span className="font-mono text-blue-400">/users</span>
                    <span className="text-slate-400">{customers.length + technicians.length} documents</span>
                  </div>
                  <div className="p-3 flex items-center justify-between bg-slate-950">
                    <span className="font-mono text-blue-400">/bookings</span>
                    <span className="text-slate-400">{bookings.length} documents</span>
                  </div>
                  <div className="p-3 flex items-center justify-between bg-slate-950">
                    <span className="font-mono text-blue-400">/technicians</span>
                    <span className="text-slate-400">{technicians.length} documents</span>
                  </div>
                  <div className="p-3 flex items-center justify-between bg-slate-950">
                    <span className="font-mono text-blue-400">/system/commission_rules</span>
                    <span className="text-emerald-400 font-bold">Active (12% elec, 15% plumb)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tax Invoice & Payment Receipt Modal */}
      {selectedReceiptBooking && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-950 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Tax Invoice & Payment Receipt</span>
                    <span className="text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded">
                      INV-{selectedReceiptBooking.id}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400">QuickFix Home Services Marketplace Pvt Ltd</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReceiptBooking(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Formal Tax Invoice */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
              {/* GST Header */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">QuickFix Technologies India Pvt Ltd</h4>
                    <p className="text-[11px] text-slate-400">Embassy TechVillage, Outer Ring Road, Bengaluru - 560103</p>
                    <p className="text-[11px] text-slate-400 font-mono">Tax registration details are not configured</p>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 border border-emerald-700/80 bg-emerald-950 px-2 py-0.5 rounded block">
                      {selectedReceiptBooking.paymentStatus.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {new Date(selectedReceiptBooking.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billed To & Service Partner */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Billed To (Customer):</span>
                  <p className="font-bold text-white">{selectedReceiptBooking.customerName}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{selectedReceiptBooking.customerPhone}</p>
                  <p className="text-slate-400 text-[10px] truncate">{selectedReceiptBooking.customerAddress}</p>
                  <p className="text-slate-400 text-[10px]">{selectedReceiptBooking.city} - {selectedReceiptBooking.pincode}</p>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Fulfilled By (Partner):</span>
                  <p className="font-bold text-white">{selectedReceiptBooking.technicianName || 'KamXApp Direct Dispatch'}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{selectedReceiptBooking.technicianPhone || 'Not provided'}</p>
                  <p className="text-blue-300 font-mono text-[10px] capitalize">Trade: {selectedReceiptBooking.category}</p>
                  <p className="text-slate-400 text-[10px]">Start OTP: <strong className="text-amber-400 font-mono">{selectedReceiptBooking.startOtp}</strong></p>
                </div>
              </div>

              {/* Itemized Service Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-300 flex justify-between border-b border-slate-800">
                  <span>Description of Service</span>
                  <span>Amount (INR)</span>
                </div>
                <div className="p-3 space-y-2 bg-slate-950/80">
                  {selectedReceiptBooking.lineItems?.length ? selectedReceiptBooking.lineItems.map((line, index) => (
                    <div key={line.serviceId + index} className="flex justify-between items-start gap-3 text-white">
                      <div className="min-w-0">
                        <span className="font-semibold block">{line.serviceTitle}</span>
                        <span className="text-[10px] text-slate-400">{line.quantity} × {line.billingUnit.replaceAll('_', ' ')} · ₹{line.unitRateMinimum ?? 0}{line.unitRateMaximum !== undefined && line.unitRateMaximum !== line.unitRateMinimum ? '–₹' + line.unitRateMaximum : ''} per unit</span>
                        <span className="text-[10px] text-slate-500 block">{line.materialsIncluded ? 'Materials included' : 'Materials/parts excluded unless separately approved'}</span>
                      </div>
                      <span className="font-mono font-semibold whitespace-nowrap">₹{line.lineTotalMinimum}{line.lineTotalMaximum !== line.lineTotalMinimum ? '–₹' + line.lineTotalMaximum : ''}</span>
                    </div>
                  )) : <div className="flex justify-between items-center text-white">
                    <div>
                      <span className="font-semibold block">{selectedReceiptBooking.serviceTitle}</span>
                      <span className="text-[10px] text-slate-400">Legacy booking · no saved item-wise price snapshot</span>
                    </div>
                    <span className="font-mono font-semibold">₹{selectedReceiptBooking.price}</span>
                  </div>}
                  {selectedReceiptBooking.lineItems?.length ? <div className="flex justify-between border-t border-slate-800 pt-2 text-white font-bold text-xs"><span>Item-wise service subtotal (estimate)</span><span>₹{selectedReceiptBooking.lineItems.reduce((sum, line) => sum + line.lineTotalMinimum, 0)} – ₹{selectedReceiptBooking.lineItems.reduce((sum, line) => sum + line.lineTotalMaximum, 0)}</span></div> : null}

                  <div className="flex justify-between items-center text-slate-400 text-[11px]">
                    <span>Doorstep Visiting & Convenience Charges</span>
                    <span className="font-mono">₹{selectedReceiptBooking.visitingCharges}</span>
                  </div>

                  {selectedReceiptBooking.discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 text-[11px]">
                      <span>Promotional Instant Discount</span>
                      <span className="font-mono">-₹{selectedReceiptBooking.discount}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                    <span>Applicable GST (CGST 9% + SGST 9%)</span>
                    <span className="font-mono">₹{selectedReceiptBooking.taxes}</span>
                  </div>

                  <div className="flex justify-between items-center text-white font-bold text-sm pt-2 border-t border-slate-800">
                    <span>Total Invoiced & Collected:</span>
                    <span className="font-mono text-emerald-400">₹{selectedReceiptBooking.totalAmount}</span>
                  </div>
                </div>
              </div>

              {/* Internal Revenue Split Transparency */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800/80 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Payment Method:</span>
                  <strong className="text-white uppercase">{selectedReceiptBooking.paymentMethod}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span className="font-sans">Gateway / Bank UTR:</span>
                  <strong className="text-blue-300">{selectedReceiptBooking.transactionRef || 'Not recorded'}</strong>
                </div>
                <div className="flex justify-between text-purple-300 pt-1 border-t border-slate-800">
                  <span className="font-sans">Platform Retained Commission:</span>
                  <strong>₹{selectedReceiptBooking.adminCommission} ({selectedReceiptBooking.commissionRate}%)</strong>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span className="font-sans">Technician Net Payout:</span>
                  <strong>₹{selectedReceiptBooking.technicianPayout}</strong>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-900 p-3 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => {
                  alert('PDF invoice export is not available yet. No PDF was downloaded.');
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF Invoice</span>
              </button>

              <button
                onClick={() => setSelectedReceiptBooking(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Mobile Persistent Bottom Navigation */}
      <nav className="sticky bottom-0 bg-slate-950 border-t border-slate-800 px-2 py-2 flex items-center justify-around z-30 shadow-2xl">
        <button
          type="button"
          onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'overview' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-[10px]">Overview</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('customers'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'customers' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px]">Customers</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('technicians'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 transition-colors relative ${
            activeTab === 'technicians' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span className="text-[10px]">Technicians</span>
          {pendingKycCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-0 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('bookings'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'bookings' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="text-[10px]">Bookings</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('kyc'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'kyc' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px]">KYC</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('commissions'); setSearchQuery(''); }}
          className={`flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'commissions' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span className="text-[10px]">Payments</span>
        </button>
      </nav>
    </div>
  );
};

// Activity Pulse icon helper
function ActivityPulse(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
