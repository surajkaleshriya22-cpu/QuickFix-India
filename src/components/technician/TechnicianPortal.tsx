import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Zap,
  Power,
  IndianRupee,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Award,
  AlertCircle,
  FileCheck,
  UserPlus,
  LogIn,
  ArrowRight,
  Wallet,
  Wind,
  Snowflake,
  PlusCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  History,
  Clock,
  X,
  Compass,
  RotateCcw,
  CheckCircle
} from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { Booking, BookingStatus, ServiceCategoryType, WalletTransaction } from '../../types';
import { INDIAN_CITIES } from '../../data/mockData';
import { TechnicianRouteMap } from '../maps/TechnicianRouteMap';
import { NearbyStoresModal } from '../customer/NearbyStoresModal';
import { GeofenceModal } from './GeofenceModal';

// 1-Hour SLA Countdown Component
const SlaCountdownBadge: React.FC<{ deadline?: string; acceptedAt?: string; createdAt?: string }> = ({
  deadline,
  acceptedAt,
  createdAt
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    const target = deadline
      ? new Date(deadline).getTime()
      : new Date(acceptedAt || createdAt || Date.now()).getTime() + 60 * 60 * 1000;
    return Math.floor((target - Date.now()) / 1000);
  });

  useEffect(() => {
    const target = deadline
      ? new Date(deadline).getTime()
      : new Date(acceptedAt || createdAt || Date.now()).getTime() + 60 * 60 * 1000;

    const tick = () => {
      setTimeRemaining(Math.floor((target - Date.now()) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline, acceptedAt, createdAt]);

  const isExpired = timeRemaining <= 0;
  const absRemaining = Math.abs(timeRemaining);
  const minutes = Math.floor(absRemaining / 60);
  const seconds = absRemaining % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (isExpired) {
    return (
      <div className="bg-rose-50 border border-rose-300 rounded-xl p-2.5 text-xs text-rose-900 flex items-center justify-between gap-2 animate-pulse shadow-2xs">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>1-Hour SLA Limit Breached ({formattedTime} overdue)</span>
        </div>
        <span className="text-[10px] bg-rose-200 text-rose-950 font-bold px-2 py-0.5 rounded uppercase">
          Urgent Action
        </span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-950 flex items-center justify-between gap-2 shadow-2xs">
      <div className="flex items-center gap-1.5 font-semibold">
        <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
        <span>Service Delivery Deadline:</span>
        <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-sm">
          {formattedTime} remaining
        </span>
      </div>
      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-200/60 px-1.5 py-0.5 rounded">
        1-Hour SLA
      </span>
    </div>
  );
};

export const TechnicianPortal: React.FC = () => {
  const {
    currentTechnician,
    isTechnicianLoggedIn,
    loginTechnician,
    registerTechnician,
    logoutTechnician,
    serviceZones,
    toggleTechnicianOnline,
    validateAndSetTechnicianOnline,
    bookings,
    updateBookingStatus,
    requestPayout,
    payouts,
    walletTransactions,
    topupTechnicianWallet,
    setShowAuthModal
  } = useQuickFix();

  // Auth toggle
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [acceptError, setAcceptError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);

  // Wallet Top-up Modal State
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupAmount, setTopupAmount] = useState<number>(1000);
  const [topupFeedback, setTopupFeedback] = useState('');
  const [showPassbook, setShowPassbook] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTrades, setRegTrades] = useState<ServiceCategoryType[]>(['electrician']);
  const [regExp, setRegExp] = useState(5);
  const [regCity, setRegCity] = useState('Bengaluru');
  const [regKycType, setRegKycType] = useState<'Aadhaar' | 'PAN' | 'Skill India Certificate'>('Skill India Certificate');
  const [regKycDoc, setRegKycDoc] = useState('');
  const [regQualType, setRegQualType] = useState<'ITI Trade Certificate' | 'Skill India / NSDC Certified' | 'State Wireman/Plumber License' | 'Govt Polytechnic Diploma'>('ITI Trade Certificate');
  const [regQualNumber, setRegQualNumber] = useState('');
  const [regQualInst, setRegQualInst] = useState('');
  const [regUpi, setRegUpi] = useState('');
  const [regDeposit, setRegDeposit] = useState<number>(2000);
  const [qualificationAlertMsg, setQualificationAlertMsg] = useState('');
  const [regError, setRegError] = useState('');
  const [showNearbyStores, setShowNearbyStores] = useState(false);

  // Find active job assigned to this technician
  const assignedJobs = bookings.filter(
    b => b.technicianId === currentTechnician.id || b.status === 'requested'
  );
  const currentActiveJob = assignedJobs.find(
    b => b.status === 'assigned' || b.status === 'technician_en_route' || b.status === 'in_progress'
  );

  const handleAcceptJob = (bookingId: string) => {
    setAcceptError('');
    const techBal = currentTechnician.walletBalance ?? 0;
    if (techBal < 1000) {
      setAcceptError(`Service Acceptance Blocked: Minimum ₹1,000 partner wallet balance is required to accept service notifications. Current balance: ₹${techBal}. Please top up your wallet.`);
      return;
    }
    const result = updateBookingStatus(bookingId, 'technician_en_route');
    if (!result.success) {
      setAcceptError(result.message || 'Could not accept booking.');
    }
  };

  const handleStartJobWithOtp = (bookingId: string) => {
    if (!otpInput || otpInput.trim().length !== 4) {
      setOtpError('Please enter the 4-digit OTP provided by customer');
      return;
    }
    const result = updateBookingStatus(bookingId, 'in_progress', otpInput);
    if (!result.success) {
      setOtpError(result.message || 'Invalid OTP');
    } else {
      setOtpError('');
      setOtpInput('');
    }
  };

  const handleCompleteJob = (bookingId: string) => {
    updateBookingStatus(bookingId, 'completed');
  };

  const withdrawableAmount = currentTechnician.withdrawableBalance ?? Math.max(0, (currentTechnician.walletBalance ?? 0) - 2000);

  const handleWithdrawPayout = () => {
    setPayoutError('');
    setPayoutSuccess('');
    if (withdrawableAmount <= 0) {
      setPayoutError('Withdrawal Blocked: Base ₹2,000 security reserve cannot be withdrawn. Only earnings above ₹2,000 can be withdrawn.');
      setTimeout(() => setPayoutError(''), 6000);
      return;
    }
    const res = requestPayout(currentTechnician.id, withdrawableAmount);
    if (res.success) {
      setPayoutSuccess(res.message);
      setTimeout(() => setPayoutSuccess(''), 6000);
    } else {
      setPayoutError(res.message);
      setTimeout(() => setPayoutError(''), 6000);
    }
  };

  const handleTopupWallet = (amount: number) => {
    const res = topupTechnicianWallet(currentTechnician.id, amount);
    if (res.success) {
      setTopupFeedback(res.message);
      setTimeout(() => {
        setTopupFeedback('');
        setShowTopupModal(false);
      }, 1600);
    }
  };

  // If not logged in
  if (!isTechnicianLoggedIn) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col justify-center p-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md space-y-4 max-w-sm mx-auto w-full">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">QuickFix Partner Portal</h2>
            <p className="text-xs text-slate-500">Sign in to manage service jobs and withdraw verified earnings.</p>
          </div>

          {!showRegisterForm ? (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Registered Mobile Number</label>
                <div className="flex rounded-xl border border-slate-300 overflow-hidden">
                  <span className="bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-600">🇮🇳 +91</span>
                  <input
                    type="tel"
                    value={loginPhone}
                    onChange={e => setLoginPhone(e.target.value)}
                    placeholder="Enter registered mobile number"
                    className="flex-1 px-3 py-2.5 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In via Firebase Mobile OTP</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full text-xs text-blue-600 hover:underline font-semibold text-center block pt-1"
              >
                New Service Technician? Register Trade & KYC
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  placeholder="+91 98450..."
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Trade</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRegTrades(['electrician'])}
                    className={`flex-1 py-1.5 rounded-lg border text-center font-bold ${regTrades.includes('electrician') ? 'bg-amber-100 text-amber-900 border-amber-400' : 'bg-slate-50'}`}
                  >
                    Electrician
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegTrades(['plumber'])}
                    className={`flex-1 py-1.5 rounded-lg border text-center font-bold ${regTrades.includes('plumber') ? 'bg-cyan-100 text-cyan-900 border-cyan-400' : 'bg-slate-50'}`}
                  >
                    Plumber
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Operating City (शहर)</label>
                <select
                  value={regCity}
                  onChange={e => setRegCity(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                >
                  {INDIAN_CITIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Trade Qualification Proof */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block">
                  Mandatory Trade Certificate
                </span>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Qualification Type</label>
                  <select
                    value={regQualType}
                    onChange={e => setRegQualType(e.target.value as any)}
                    className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  >
                    <option value="ITI Trade Certificate">ITI Trade Certificate</option>
                    <option value="Skill India / NSDC Certified">Skill India / NSDC Certified</option>
                    <option value="State Wireman/Plumber License">State Wireman / Plumber License</option>
                    <option value="Govt Polytechnic Diploma">Govt Polytechnic Diploma</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Certificate / Reg Number</label>
                  <input
                    type="text"
                    value={regQualNumber}
                    onChange={e => setRegQualNumber(e.target.value)}
                    placeholder="e.g. ITI-MP-2021-9921"
                    className="w-full p-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-600 block mb-0.5">Issuing Institute / Board</label>
                  <input
                    type="text"
                    value={regQualInst}
                    onChange={e => setRegQualInst(e.target.value)}
                    placeholder="e.g. Govt ITI / Skill Center"
                    className="w-full p-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">KYC Proof Type</label>
                <select
                  value={regKycType}
                  onChange={e => setRegKycType(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Skill India Certificate">Skill India Certificate</option>
                  <option value="Aadhaar">Aadhaar Card</option>
                  <option value="PAN">PAN Card</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Document Number</label>
                <input
                  type="text"
                  value={regKycDoc}
                  onChange={e => setRegKycDoc(e.target.value)}
                  placeholder="e.g. SIC-EL-9921"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">UPI ID for Payouts</label>
                <input
                  type="text"
                  value={regUpi}
                  onChange={e => setRegUpi(e.target.value)}
                  placeholder="name@okaxis / paytm"
                  className="w-full p-2 rounded-lg border border-slate-300"
                />
              </div>

              {/* Mandatory Security Deposit of ₹2,000 */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 text-[11px]">
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Mandatory Partner Security Deposit</span>
                  </div>
                  <span className="text-[9px] font-bold uppercase bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">
                    Non-Withdrawable Base
                  </span>
                </div>
                <p className="text-[10px] text-amber-800 leading-tight">
                  Technicians must maintain a minimum balance of <strong>₹2,000</strong> to complete registration. This initial ₹2,000 deposit is permanently locked to guarantee customer cash commissions and cannot be withdrawn. Only earnings above ₹2,000 can be withdrawn.
                </p>
                <div className="pt-0.5">
                  <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">
                    Select Initial Wallet Fund:
                  </label>
                  <div className="flex gap-1.5">
                    {[2000, 3000, 5000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setRegDeposit(amt)}
                        className={`flex-1 py-1 rounded-lg border text-center font-mono font-bold text-xs transition-colors ${
                          regDeposit === amt
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        ₹{amt} {amt === 2000 ? '(Min)' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {regError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {regError}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setRegError('');
                  const res = registerTechnician({
                    name: regName || 'Sunil Verma',
                    phone: regPhone || '+91 98450 99881',
                    email: regEmail || 'sunil.partner@quickfix.in',
                    trades: regTrades,
                    experienceYears: Math.max(2, regExp),
                    city: regCity,
                    qualificationType: regQualType,
                    qualificationRegNumber: regQualNumber || 'ITI-PENDING-AUDIT',
                    qualificationInstitute: regQualInst || `${regCity} Technical Institute`,
                    kycDocType: regKycType,
                    kycDocNumber: regKycDoc || 'KYC-88123-IN',
                    upiId: regUpi || 'sunil.partner@upi',
                    initialDepositAmount: regDeposit
                  });
                  if (res && !res.success) {
                    setRegError(res.message || 'Registration failed');
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl mt-2 transition-colors"
              >
                Submit Partner KYC & Pay ₹{regDeposit} Security Deposit
              </button>

              <button
                type="button"
                onClick={() => setShowRegisterForm(false)}
                className="w-full text-center text-slate-500 hover:underline pt-1"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-0">
      {/* Top Bar with Online Switch & Profile */}
      <header className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-sm">
            {currentTechnician.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-900 text-xs">{currentTechnician.name}</span>
              {currentTechnician.isVerified && (
                <span title="KYC Verified">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="capitalize">{currentTechnician.trades.join(', ')}</span>
              <span>· {currentTechnician.rating} ★</span>
            </div>
          </div>
        </div>

        {/* Online / Offline Status Button & Geofence Pill */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGeofenceModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors shadow-2xs"
            title="Inspect Geo-fenced operating zone and GPS perimeter"
          >
            <Navigation className="w-3 h-3 text-blue-600" />
            <span className="max-w-[85px] sm:max-w-none truncate">
              {currentTechnician.currentLocation?.zoneName ? `${currentTechnician.currentLocation.zoneName.split(' ')[0]} Hub` : 'Geo-fence'}
            </span>
          </button>

          <button
            onClick={() => {
              if (currentTechnician.isOnline) {
                const res = toggleTechnicianOnline(currentTechnician.id);
                if (res.message) {
                  setPayoutSuccess(res.message);
                  setTimeout(() => setPayoutSuccess(''), 4500);
                }
              } else {
                if (!currentTechnician.isVerified || currentTechnician.approvalStatus === 'pending_audit' || currentTechnician.approvalStatus === 'rejected') {
                  setQualificationAlertMsg('Awaiting Trade Qualification Clearance: Your certificate is under audit by QuickFix Admin HQ. Only approved technicians can go online.');
                  setTimeout(() => setQualificationAlertMsg(''), 7000);
                  return;
                }
                if ((currentTechnician.walletBalance ?? 0) < 2000) {
                  const deficit = 2000 - (currentTechnician.walletBalance ?? 0);
                  setQualificationAlertMsg(`Minimum ₹2,000 Security Reserve Required: Your current wallet balance is ₹${currentTechnician.walletBalance ?? 0}. Please top-up ₹${deficit}.`);
                  setTimeout(() => setQualificationAlertMsg(''), 7000);
                  return;
                }
                const res = toggleTechnicianOnline(currentTechnician.id);
                if (!res.success) {
                  if (res.requiresGeofence) {
                    setShowGeofenceModal(true);
                  } else {
                    setQualificationAlertMsg(res.message || 'Geo-fence verification required to go online.');
                    setTimeout(() => setQualificationAlertMsg(''), 7000);
                  }
                } else if (res.message) {
                  setPayoutSuccess(res.message);
                  setTimeout(() => setPayoutSuccess(''), 5000);
                }
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ${
              currentTechnician.isOnline
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-200'
                : !currentTechnician.isVerified || currentTechnician.approvalStatus === 'pending_audit'
                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer'
                : (currentTechnician.walletBalance ?? 0) < 2000
                ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200 cursor-pointer'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            title={!currentTechnician.isVerified ? 'Qualification approval required' : (currentTechnician.walletBalance ?? 0) < 2000 ? 'Minimum ₹2,000 security reserve required' : undefined}
          >
            <Power className="w-3.5 h-3.5" />
            <span>
              {currentTechnician.isOnline
                ? 'ONLINE'
                : !currentTechnician.isVerified || currentTechnician.approvalStatus === 'pending_audit'
                ? 'AUDIT PENDING'
                : (currentTechnician.walletBalance ?? 0) < 2000
                ? 'RESERVE DEFICIT'
                : 'OFFLINE'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Geo-fence Operating Perimeter Status Banner */}
        <div
          className={`p-3 rounded-2xl border text-xs shadow-xs flex flex-wrap items-center justify-between gap-2.5 transition-all ${
            currentTechnician.isOnline
              ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : 'bg-slate-900 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                currentTechnician.isOnline ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">
                  {currentTechnician.isOnline ? 'Geo-fence Operating Zone Active' : 'Service Radius Geo-fence Enforced'}
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    currentTechnician.isOnline
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {currentTechnician.isOnline ? '1-Hour SLA Armed' : 'Perimeter Verification Required'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {currentTechnician.isOnline
                  ? `Assigned: ${currentTechnician.currentLocation?.zoneName || `${currentTechnician.city} Operations Hub`} (${currentTechnician.currentLocation?.distanceToCenterKm ?? 2.8} km from center)`
                  : `Status updates to Online are strictly restricted to designated ${currentTechnician.city} service radius areas.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGeofenceModal(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs ml-auto"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{currentTechnician.isOnline ? 'Inspect Geofence' : 'Verify Location'}</span>
          </button>
        </div>

        {/* Dynamic Warning / Error Alert */}
        {qualificationAlertMsg && (
          <div className="bg-amber-500 text-slate-950 p-3 rounded-2xl shadow-md flex items-start gap-2.5 animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-slate-950" />
            <div className="text-xs">
              <strong className="font-extrabold block">QuickFix Safety & Policy Rule</strong>
              <p>{qualificationAlertMsg}</p>
            </div>
          </div>
        )}

        {/* Security Reserve Deficit Alert Banner */}
        {(currentTechnician.walletBalance ?? 0) < 2000 && (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3.5 shadow-xs space-y-2 text-rose-950">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Security Reserve Deficit (Balance: ₹{currentTechnician.walletBalance ?? 0})</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                Need ₹{2000 - (currentTechnician.walletBalance ?? 0)}
              </span>
            </div>
            <p className="text-xs text-rose-900 leading-relaxed">
              QuickFix India safety policy requires service partners to maintain a mandatory <strong className="font-bold">₹2,000 security reserve</strong>. You cannot activate duty or accept new bookings until this reserve is topped up.
            </p>
            <button
              onClick={() => {
                setTopupAmount(2000 - (currentTechnician.walletBalance ?? 0));
                setShowTopupModal(true);
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Top-Up ₹{2000 - (currentTechnician.walletBalance ?? 0)} to Restore Duty</span>
            </button>
          </div>
        )}

        {/* Trade Qualification Status Banner */}
        {(!currentTechnician.isVerified || currentTechnician.approvalStatus === 'pending_audit') ? (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-800" />
                <span>Trade Qualification Audit In Progress</span>
              </span>
              <span className="text-[10px] text-amber-800 font-bold">Admin Clearance Pending</span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-amber-950">
                Awaiting QuickFix HQ Qualification Clearance
              </h4>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed">
                As per QuickFix India safety policy, only verified and qualified <strong className="font-bold">Electricians</strong>, <strong className="font-bold">Plumbers</strong>, and <strong className="font-bold">Appliance Technicians</strong> can go online or accept bookings.
              </p>
            </div>

            <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Trade:</span>
                <span className="font-bold capitalize text-slate-900">{currentTechnician.trades.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Credential Type:</span>
                <span className="font-semibold text-slate-800">{currentTechnician.qualificationType || 'ITI Trade Certificate'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cert / Reg No:</span>
                <span className="font-mono font-bold text-blue-700">{currentTechnician.qualificationRegNumber || currentTechnician.kycDocNumber}</span>
              </div>
              {currentTechnician.qualificationInstitute && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Institute:</span>
                  <span className="text-slate-700 truncate max-w-[200px]">{currentTechnician.qualificationInstitute}</span>
                </div>
              )}
            </div>
          </div>
        ) : currentTechnician.approvalStatus === 'rejected' ? (
          <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 shadow-sm space-y-2 text-rose-900">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Qualification Audit Rejected</span>
            </div>
            <p className="text-xs">
              Reason: {currentTechnician.rejectionReason || 'Trade certificate could not be validated.'} Please visit QuickFix HQ with original ITI / Skill India diploma for manual clearance.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 flex items-center justify-between text-emerald-950">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold block text-emerald-900">
                  QuickFix Certified {currentTechnician.trades.map(t => t.replace(/_/g, ' ')).join(' & ')}
                </span>
                <span className="text-[11px] text-emerald-700 font-mono">
                  {currentTechnician.qualificationType} ({currentTechnician.qualificationRegNumber})
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-full">
              Verified Pro
            </span>
          </div>
        )}

        {/* ================= COMPREHENSIVE WALLET & SECURITY RESERVE CARD ================= */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white rounded-2xl p-4 shadow-md border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Partner Wallet & Reserve</span>
                <span className="text-[10px] text-slate-400">Escrow Protected · Real-Time Settled</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {(currentTechnician.walletBalance ?? 0) >= 2000 ? (
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>₹2,000 Reserve Maintained</span>
                </span>
              ) : (
                <span className="bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span>Reserve Deficit</span>
                </span>
              )}
            </div>
          </div>

          {/* Wallet Balances Grid */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            {/* Total Balance */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Wallet</span>
              <div className="text-lg font-extrabold font-mono text-white mt-0.5">
                ₹{currentTechnician.walletBalance ?? 0}
              </div>
            </div>

            {/* Non-withdrawable Security Reserve */}
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-semibold flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
                <span>Base Reserve</span>
              </span>
              <div className="text-lg font-extrabold font-mono text-amber-300 mt-0.5">
                ₹2,000
              </div>
              <span className="text-[9px] text-slate-500 block leading-tight">Locked (Non-withdrawable)</span>
            </div>

            {/* Net Withdrawable Earnings */}
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Withdrawable</span>
              <div className="text-lg font-extrabold font-mono text-emerald-400 mt-0.5">
                ₹{withdrawableAmount}
              </div>
              <span className="text-[9px] text-slate-500 block leading-tight">Amount over ₹2,000</span>
            </div>
          </div>

          {/* Cash Ledger & Commission Breakdown Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80 text-slate-300">
            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
              <span className="text-[10px] text-slate-400 block">Cash Handed by Customers</span>
              <span className="font-bold text-white font-mono">₹{currentTechnician.lifetimeCashCollected ?? 0}</span>
            </div>
            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
              <span className="text-[10px] text-slate-400 block">Cash Commission Debited</span>
              <span className="font-bold text-rose-400 font-mono">-₹{currentTechnician.lifetimeCommissionPaid ?? 0}</span>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                setTopupAmount(1000);
                setShowTopupModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Top-Up Wallet</span>
            </button>

            <button
              onClick={handleWithdrawPayout}
              disabled={withdrawableAmount <= 0}
              className={`font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors ${
                withdrawableAmount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-98'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Withdraw ₹{withdrawableAmount}</span>
            </button>
          </div>

          {/* Cash Commission & Safe Payout Transparency Note */}
          <div className="text-[10px] text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed space-y-1">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Platform Cash Commission Rule:</strong> When customers pay in cash, QuickFix commission is auto-deducted from your wallet. The ₹2,000 security reserve remains locked to guarantee platform settlements.
              </span>
            </div>
            <div className="flex items-start gap-1.5 text-slate-400 pt-0.5 border-t border-slate-900">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Safe Payout Protocol:</strong> Withdrawals reserve funds from your wallet and are reviewed by Admin HQ. Approved payouts are dispatched via payment gateway and marked settled only upon verified webhook confirmation.
              </span>
            </div>
          </div>

          {/* Action Feedback Messages */}
          {payoutSuccess && (
            <div className="bg-emerald-950 border border-emerald-500/50 p-2.5 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{payoutSuccess}</span>
            </div>
          )}

          {payoutError && (
            <div className="bg-rose-950 border border-rose-500/50 p-2.5 rounded-xl text-rose-300 text-xs flex items-center gap-1.5 shadow-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{payoutError}</span>
            </div>
          )}

          {/* Toggle Passbook & Payout History */}
          <div className="pt-1 flex items-center justify-center gap-3 text-center">
            <button
              type="button"
              onClick={() => setShowPassbook(!showPassbook)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center justify-center gap-1"
            >
              <History className="w-3 h-3" />
              <span>{showPassbook ? 'Hide Ledger' : 'Wallet Passbook'}</span>
            </button>
            <span className="text-slate-700">·</span>
            <button
              type="button"
              onClick={() => setShowPassbook(true)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center justify-center gap-1"
            >
              <Clock className="w-3 h-3" />
              <span>Payout Status ({payouts.filter(p => p.technicianId === currentTechnician.id).length})</span>
            </button>
          </div>

          {/* Wallet Passbook & Payout Tracking Ledger List */}
          {showPassbook && (
            <div className="pt-2 border-t border-slate-800 space-y-3 animate-in fade-in duration-200">
              {/* Partner Payout Requests Section */}
              {payouts.filter(p => p.technicianId === currentTechnician.id).length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Payout Withdrawal Requests
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">
                      Webhook Verified Only
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                    {payouts
                      .filter(p => p.technicianId === currentTechnician.id)
                      .map(p => {
                        const isPending = p.status === 'pending';
                        const isProcessing = p.status === 'processing';
                        const isHeld = p.status === 'on_hold';
                        const isSettled = p.status === 'settled';
                        const isRejected = p.status === 'rejected';

                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-lg border text-[11px] space-y-1 ${
                              isPending
                                ? 'bg-amber-950/20 border-amber-800/60'
                                : isProcessing
                                ? 'bg-blue-950/20 border-blue-800/60'
                                : isHeld
                                ? 'bg-orange-950/20 border-orange-800/60'
                                : isSettled
                                ? 'bg-emerald-950/20 border-emerald-800/60'
                                : 'bg-rose-950/20 border-rose-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-slate-300 font-semibold">{p.referenceNumber}</span>
                              <span className="font-mono font-bold text-white">₹{p.amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">
                                {new Date(p.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                                  isPending
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : isProcessing
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                    : isHeld
                                    ? 'bg-orange-950 text-orange-300 border border-orange-800'
                                    : isSettled
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                    : 'bg-rose-950 text-rose-300 border border-rose-800'
                                }`}
                              >
                                {isPending
                                  ? 'Awaiting Admin Clearance'
                                  : isProcessing
                                  ? 'Approved · Gateway Queue'
                                  : isHeld
                                  ? 'Held for Audit'
                                  : isSettled
                                  ? 'Settled via Webhook'
                                  : 'Rejected & Restored'}
                              </span>
                            </div>
                            {p.adminNote && (
                              <p className="text-[10px] text-slate-400 italic">
                                Note: {p.adminNote}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Transaction Ledger */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Recent Wallet Ledger Transactions
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {walletTransactions
                    .filter(tx => tx.technicianId === currentTechnician.id)
                    .map(tx => (
                      <div
                        key={tx.id}
                        className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {tx.type === 'job_acceptance_commission' ? (
                              <span className="text-amber-400 flex items-center gap-0.5">
                                <ArrowDownLeft className="w-3 h-3" /> Job Acceptance Commission
                              </span>
                            ) : tx.type === 'cash_commission_deduction' ? (
                              <span className="text-rose-400 flex items-center gap-0.5">
                                <ArrowDownLeft className="w-3 h-3" /> Cash Commission Cut
                              </span>
                            ) : tx.type === 'online_payout_credit' ? (
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <ArrowUpRight className="w-3 h-3" /> Online Job Credit
                              </span>
                            ) : tx.type === 'payout_reversal' ? (
                              <span className="text-emerald-400 flex items-center gap-0.5">
                                <RotateCcw className="w-3 h-3" /> Payout Rejected - Funds Restored
                              </span>
                            ) : tx.type === 'security_deposit' ? (
                              <span className="text-amber-400 flex items-center gap-0.5">
                                <Lock className="w-3 h-3" /> Base Security Deposit
                              </span>
                            ) : tx.type === 'withdrawal' ? (
                              <span className="text-slate-300 flex items-center gap-0.5">
                                <ArrowUpRight className="w-3 h-3" /> Payout Reserved
                              </span>
                            ) : (
                              <span className="text-blue-400 flex items-center gap-0.5">
                                <PlusCircle className="w-3 h-3" /> Wallet Top-Up
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            {tx.description}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono font-bold ${
                              tx.type === 'job_acceptance_commission' || tx.type === 'cash_commission_deduction' || tx.type === 'withdrawal'
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {tx.type === 'job_acceptance_commission' || tx.type === 'cash_commission_deduction' || tx.type === 'withdrawal' ? '-' : '+'}₹{tx.amount}
                          </span>
                          <div className="text-[9px] text-slate-500 font-mono">
                            Bal: ₹{tx.balanceAfter}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Verification Alert if not verified */}
        {!currentTechnician.isVerified && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">KYC Pending Admin Review:</span> Your trade documentation ({currentTechnician.kycDocType}) is queued for verification by the QuickFix operations team.
            </div>
          </div>
        )}

        {/* Current Active Job Section */}
        {currentActiveJob ? (
          <div className="bg-white border-2 border-blue-500 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                  Active Dispatch · {currentActiveJob.id}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                Payout: ₹{currentActiveJob.technicianPayout}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">{currentActiveJob.serviceTitle}</h3>
              <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{currentActiveJob.customerAddress}</span>
              </p>
              {currentActiveJob.notes && (
                <div className="mt-2 bg-slate-50 p-2 rounded-lg text-[11px] text-slate-700 italic border border-slate-100">
                  Customer Note: "{currentActiveJob.notes}"
                </div>
              )}
            </div>

            {/* Customer Details & Call Action */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Customer</span>
                <span className="text-xs font-bold text-slate-900">{currentActiveJob.customerName}</span>
              </div>
              <a
                href={`tel:${currentActiveJob.customerPhone}`}
                className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 shadow-2xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Client</span>
              </a>
            </div>

            {/* Live Navigation Map for Technician */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-1 text-blue-700">
                  <Navigation className="w-3.5 h-3.5" /> Client Route ({currentActiveJob.city})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNearbyStores(true)}
                  className="text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <Compass className="w-3 h-3 text-amber-600" />
                  <span>Hardware Spares</span>
                </button>
              </div>

              <TechnicianRouteMap
                destinationAddress={currentActiveJob.customerAddress}
                technicianName={currentTechnician.name}
                height="170px"
              />
            </div>

            {/* 1-Hour SLA Countdown Timer Banner */}
            {(currentActiveJob.status === 'technician_en_route' || currentActiveJob.status === 'in_progress') && (
              <SlaCountdownBadge
                deadline={currentActiveJob.serviceDeadline}
                acceptedAt={currentActiveJob.acceptedAt}
                createdAt={currentActiveJob.createdAt}
              />
            )}

            {/* Non-Refundable Commission Auto-Debit Disclosure */}
            {(currentActiveJob.status === 'technician_en_route' || currentActiveJob.status === 'in_progress') && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Platform Commission Auto-Debited (Non-Refundable)</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Platform fee of <strong>₹{currentActiveJob.adminCommission}</strong> ({currentTechnician.customCommissionPct !== undefined ? `${currentTechnician.customCommissionPct}% custom rate` : `${currentActiveJob.commissionRate}% standard rate`}) was immediately auto-debited from your wallet upon acceptance and credited to Admin HQ. Service must be delivered within the 1-hour SLA window.
                </p>
              </div>
            )}

            {/* Step Actions for the Technician */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {currentActiveJob.status === 'assigned' && (
                <div className="space-y-2">
                  {/* Minimum ₹1,000 Wallet Gate Warning */}
                  {(currentTechnician.walletBalance ?? 0) < 1000 ? (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Cannot Accept Service Notification (Balance &lt; ₹1,000)</span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        A minimum partner wallet balance of <strong>₹1,000</strong> is required to accept booking notifications. Your current balance is <strong>₹{currentTechnician.walletBalance ?? 0}</strong>. Please top up your wallet to activate acceptance.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setTopupAmount(1000);
                          setShowTopupModal(true);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-2xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Recharge Wallet (+₹1,000)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-600 space-y-1">
                      <div className="flex items-center gap-1 text-slate-800 font-bold">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>1-Hour Service Delivery SLA & Immediate Commission Rule:</span>
                      </div>
                      <p className="text-slate-600 leading-tight">
                        Upon accepting, platform commission (<strong>₹{currentActiveJob.adminCommission}</strong>) will be auto-debited immediately from your wallet to Admin HQ and is non-refundable whether you visit or not. You must deliver service within 1 hour.
                      </p>
                    </div>
                  )}

                  <button
                    disabled={(currentTechnician.walletBalance ?? 0) < 1000}
                    onClick={() => handleAcceptJob(currentActiveJob.id)}
                    className={`w-full font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                      (currentTechnician.walletBalance ?? 0) < 1000
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-98'
                    }`}
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Accept Service Notification (1-Hour SLA)</span>
                  </button>

                  {acceptError && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-800 font-medium flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{acceptError}</span>
                    </div>
                  )}
                </div>
              )}

              {currentActiveJob.status === 'technician_en_route' && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-600 font-medium">
                    Ask customer for the 4-digit start OTP to begin repair:
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={otpInput}
                      onChange={e => setOtpInput(e.target.value)}
                      placeholder="Enter 4-digit OTP"
                      className="flex-1 px-3 py-2 text-xs font-mono font-bold tracking-widest border border-slate-300 rounded-xl text-center focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleStartJobWithOtp(currentActiveJob.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Verify & Start</span>
                    </button>
                  </div>
                  {otpError && (
                    <div className="text-[11px] text-red-600 font-semibold">{otpError}</div>
                  )}
                </div>
              )}

              {currentActiveJob.status === 'in_progress' && (
                <button
                  onClick={() => handleCompleteJob(currentActiveJob.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Work Done · Finish Job & Collect Payout</span>
                </button>
              )}
            </div>

            {/* Commission Transparency Split */}
            <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Customer Total: ₹{currentActiveJob.totalAmount}</span>
                <span>
                  Platform Fee: ₹{currentActiveJob.adminCommission} {currentTechnician.customCommissionPct !== undefined ? `(${currentTechnician.customCommissionPct}% Custom)` : `(${currentActiveJob.commissionRate}%)`}
                </span>
                <span className="font-bold text-emerald-700">Net You Get: ₹{currentActiveJob.technicianPayout}</span>
              </div>
              <div className="text-[10px] text-slate-500 italic">
                {currentActiveJob.paymentMethod === 'cash'
                  ? '💵 Cash Booking: Customer hands full cash directly to you. Platform commission was debited from your wallet upon acceptance.'
                  : '💳 Online Booking: Customer paid online to Admin Master Account. Net payout credited upon work completion.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Ready for Orders</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {currentTechnician.isOnline
                ? `You are online in ${currentTechnician.city || 'your area'}. Incoming electrician/plumber requests will ring here instantly.`
                : 'Turn your status ONLINE above to receive nearby customer bookings.'}
            </p>
          </div>
        )}

        {/* Completed Jobs History */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Job History</span>
            <span className="text-[11px] text-slate-500">{assignedJobs.filter(b => b.status === 'completed').length} completed</span>
          </div>

          <div className="space-y-2">
            {assignedJobs.filter(b => b.status === 'completed').map(b => (
              <div key={b.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{b.serviceTitle}</div>
                  <div className="text-[11px] text-slate-500">{b.customerName} · {b.scheduledDate}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-600">+₹{b.technicianPayout}</div>
                  <div className="text-[10px] text-slate-400">Settled</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wallet Top-up Modal */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Top-Up Partner Wallet</h3>
                  <p className="text-[10px] text-slate-500">Maintain ₹2,000 reserve to activate duty</p>
                </div>
              </div>
              <button
                onClick={() => setShowTopupModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wider">
                Select Amount (राशि चुनें)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                      topupAmount === amt
                        ? 'bg-blue-50 text-blue-700 border-blue-500 ring-1 ring-blue-400'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    +₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wider">
                Or Custom Amount (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">₹</span>
                <input
                  type="number"
                  min="100"
                  step="100"
                  value={topupAmount}
                  onChange={e => setTopupAmount(Math.max(100, Number(e.target.value)))}
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Security Reserve Explanation */}
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed flex items-start gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Reserve Guarantee:</strong> The base ₹2,000 security reserve is locked and cannot be withdrawn. It guarantees automated platform commission deductions when customers pay cash.
              </span>
            </div>

            {topupFeedback && (
              <div className="bg-emerald-50 border border-emerald-300 p-2 rounded-xl text-emerald-800 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{topupFeedback}</span>
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={() => handleTopupWallet(topupAmount)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-98 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Confirm & Add ₹{topupAmount} to Wallet</span>
            </button>
          </div>
        </div>
      )}

      {/* Geofence Service Radius Validation Modal */}
      <GeofenceModal
        isOpen={showGeofenceModal}
        onClose={() => setShowGeofenceModal(false)}
        technicianCity={currentTechnician.city}
        serviceZones={serviceZones}
        currentLocation={currentTechnician.currentLocation}
        onConfirmOnline={(locationData) => {
          validateAndSetTechnicianOnline(currentTechnician.id, locationData).then((res) => {
            setQualificationAlertMsg('');
            setPayoutSuccess(res.message);
            setTimeout(() => setPayoutSuccess(''), 6000);
          });
        }}
      />
    </div>
  );
};
