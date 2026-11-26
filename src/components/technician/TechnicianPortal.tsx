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
import { LiveLocationPanel } from '../maps/LiveLocationPanel';
import { NearbyStoresModal } from '../customer/NearbyStoresModal';
import { GeofenceModal } from './GeofenceModal';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import { PartnerKycPanel } from './PartnerKycPanel';
import { PartnerRechargeCard } from './PartnerRechargeCard';
import { PartnerUpiQrCard } from './PartnerUpiQrCard';
import { BookingSosButton } from '../shared/BookingSosButton';

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
    language,
    currentUser,
    logoutUser,
    currentTechnician,
    isTechnicianLoggedIn,
    loginTechnician,
    registerTechnician,
    logoutTechnician,
    serviceZones,
    updatePartnerDutyStatus,
    toggleTechnicianOnline,
    validateAndSetTechnicianOnline,
    bookings,
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
  const [jobActionLoading, setJobActionLoading] = useState(false);
  const [jobActionError, setJobActionError] = useState('');
  const [acceptError, setAcceptError] = useState('');
  const [availableJobs, setAvailableJobs] = useState<Array<{
    id: string; serviceTitle: string; category: string; customerName: string;
    status: 'requested'; price: number; totalAmount: number;
    lineItems?: Array<{ serviceTitle: string; quantity: number; billingUnit: string; unitRateMinimum?: number; unitRateMaximum?: number; baseFee?: number; minimumCharge?: number; lineTotalMinimum: number; lineTotalMaximum: number; materialsIncluded?: boolean }>;
  }>>([]);
  const [assignedBookings, setAssignedBookings] = useState<Booking[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const [acceptingBookingId, setAcceptingBookingId] = useState<string | null>(null);
  const [acceptedJobMessage, setAcceptedJobMessage] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');
  const [payoutError, setPayoutError] = useState('');
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [dutyStatusLoading, setDutyStatusLoading] = useState(false);

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
  const [regError, setRegError] = useState('');
  const [qualificationAlertMsg, setQualificationAlertMsg] = useState('');
  const [showNearbyStores, setShowNearbyStores] = useState(false);

  // Active dispatch is sourced only from the authenticated, ownership-filtered server feed.
  const assignedJobs = assignedBookings;
  const currentActiveJob = assignedBookings[0];

  const loadAvailableJobs = async () => {
    const firebaseUser = auth.currentUser;
    if (!isFirebaseConfigured || !firebaseUser || !isTechnicianLoggedIn) {
      setAvailableJobs([]);
      setAssignedBookings([]);
      return;
    }
    setJobsLoading(true);
    setJobsError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/partners/bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.bookings) || !Array.isArray(result.assignedBookings)) {
        throw new Error(result.error || 'Available jobs could not be loaded.');
      }
      setAvailableJobs(result.bookings);
      setAssignedBookings(result.assignedBookings as Booking[]);
    } catch (error) {
      setJobsError(error instanceof Error ? error.message : 'Available jobs could not be loaded. Please retry.');
      setAvailableJobs([]);
      setAssignedBookings([]);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailableJobs();
  }, [currentUser?.uid, isTechnicianLoggedIn]);

  const handleAcceptJob = async (bookingId: string) => {
    setAcceptError('');
    setAcceptedJobMessage('');
    const firebaseUser = auth.currentUser;
    if (!isFirebaseConfigured || !firebaseUser || !isTechnicianLoggedIn || currentUser?.uid !== firebaseUser.uid) {
      setAcceptError(language === 'hi' ? 'अपने सत्यापित चैनल पार्टनर अकाउंट से दोबारा लॉगिन करें।' : 'Please sign in again with your verified Channel Partner account.');
      return;
    }
    setAcceptingBookingId(bookingId);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`/api/partners/bookings/${encodeURIComponent(bookingId)}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: '{}'
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not accept this job.');
      }
      setAvailableJobs(previous => previous.filter(job => job.id !== bookingId));
      setAcceptedJobMessage(result.message || 'Job assigned successfully. The 1-hour SLA has started.');
      await loadAvailableJobs();
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : 'Could not accept this job. Please retry.');
    } finally {
      setAcceptingBookingId(null);
    }
  };

  const handleStartJobWithOtp = async (bookingId: string) => {
    if (!/^\d{6}$/.test(otpInput.trim())) { setOtpError('Customer se mila hua 6-digit OTP enter karein.'); return; }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || currentUser?.uid !== firebaseUser.uid) { setOtpError('Please sign in again with your verified Channel Partner account.'); return; }
    setJobActionLoading(true); setOtpError(''); setJobActionError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/partners/bookings/' + encodeURIComponent(bookingId) + '/start', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ otp: otpInput.trim() }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Job could not be started.');
      setOtpInput(''); await loadAvailableJobs();
    } catch (error) { setOtpError(error instanceof Error ? error.message : 'OTP verification failed. Please retry.'); }
    finally { setJobActionLoading(false); }
  };

  const handleCompleteJob = async (bookingId: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || currentUser?.uid !== firebaseUser.uid) { setJobActionError('Please sign in again with your verified Channel Partner account.'); return; }
    setJobActionLoading(true); setJobActionError('');
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch('/api/partners/bookings/' + encodeURIComponent(bookingId) + '/complete', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Job could not be completed.');
      setAcceptedJobMessage('Service marked complete. Payment settlement is still pending and is not confirmed.'); await loadAvailableJobs();
    } catch (error) { setJobActionError(error instanceof Error ? error.message : 'Job completion failed. Please retry.'); }
    finally { setJobActionLoading(false); }
  };

  const withdrawableAmount = 0; // Payouts stay disabled until a verified server-side wallet ledger is implemented.

  const handleWithdrawPayout = () => {
    setPayoutError('');
    setPayoutSuccess('');
    if (withdrawableAmount <= 0) {
      setPayoutError('Payouts are temporarily unavailable until the verified server-side wallet ledger and payment provider are connected.');
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

  // A newly registered partner must see the real review state, not a misleading login form.
  if (currentUser?.role === 'technician' && currentUser.approvalStatus === 'pending_audit' && !isTechnicianLoggedIn) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col justify-center p-5">
        <div className="bg-white rounded-2xl p-6 border border-amber-200 shadow-md space-y-4 max-w-sm mx-auto w-full">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{language === 'hi' ? 'पार्टनर प्रोफ़ाइल जमा हो गई' : 'Partner profile submitted'}</h2>
            <p className="text-sm text-slate-600 mt-2">Thanks{currentUser.displayName ? `, ${currentUser.displayName}` : ''}. {language === 'hi' ? 'आपकी चैनल पार्टनर प्रोफ़ाइल एडमिन की जाँच में है।' : 'Your basic Channel Partner profile is waiting for admin review.'}</p>
          </div>
          {currentUser.quickFixId && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold text-blue-700">Your permanent QuickFix ID</p>
                <p className="font-mono text-sm font-extrabold tracking-wide text-blue-950">{currentUser.quickFixId}</p>
              </div>
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(currentUser.quickFixId || ''); }}
                className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-bold text-white">Copy ID</button>
            </div>
          )}
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900 space-y-1">
            <p className="font-bold">{language === 'hi' ? 'स्थिति: जाँच बाकी' : 'Status: Pending review'}</p>
            <p>{language === 'hi' ? 'मंज़ूरी और सुरक्षित पार्टनर लॉगिन होने तक आप काम स्वीकार या ऑनलाइन नहीं हो सकते।' : 'You cannot accept jobs or go online until approval and secure partner sign-in are enabled.'}</p>
            <p>No KYC documents or deposit were collected. Do not send money to anyone claiming to activate this account.</p>
          </div>
          <button type="button" onClick={() => void logoutUser()} className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-sm">{language === 'hi' ? 'लॉग आउट' : 'Sign out'}</button>
        </div>
      </div>
    );
  }

  // If not logged in
  if (!isTechnicianLoggedIn) {
    return (
      <div className="flex-1 bg-slate-50 flex flex-col justify-center p-5">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-md space-y-4 max-w-sm mx-auto w-full">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{language === 'hi' ? 'QuickFix चैनल पार्टनर पोर्टल' : 'QuickFix Channel Partner Portal'}</h2>
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
                onClick={() => setShowRegisterForm(true)}
                className="w-full text-xs text-blue-600 hover:underline font-semibold text-center block pt-1"
              >
                New Channel Partner? Register your services
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

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="font-bold text-slate-700">Verified Mobile Number</div>
                <p className="text-slate-600">{auth.currentUser?.phoneNumber || 'Mobile OTP verification is required before submitting your partner profile.'}</p>
                {!auth.currentUser?.phoneNumber && (
                  <button type="button" onClick={() => setShowAuthModal(true)} className="w-full rounded-lg bg-blue-600 text-white font-bold py-2">
                    Verify Mobile Number with OTP
                  </button>
                )}
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="name@example.com" className="w-full p-2 rounded-lg border border-slate-300" autoComplete="email"/>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Work Experience (years)</label>
                <input type="number" min="0" max="60" value={regExp} onChange={e => setRegExp(Math.min(60, Math.max(0, Number(e.target.value) || 0)))} className="w-full p-2 rounded-lg border border-slate-300"/>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select your service categories</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['electrician','Electrician'],['plumber','Plumber'],['technician','Technician (AC / Fridge / Appliances)'],
                    ['welder','Welder / Fabricator'],['mechanic','Mechanic'],
                    ['driver','Driver'],['tourist_guide','Tourist Guide'],['contractor','Contractor'],
                    ['bike_taxi','QuickFix Bike Taxi Captain'],['kaamkaaj_partner','Kaam-Kaaj Partner (घर के सभी रोजमर्रा के काम)'],
                    ['house_cleaning','House Cleaning'],['cook','Cook / खाना बनाना'],['laundry','Laundry / कपड़े धोना-प्रेस'],['maid','Maid / घरेलू सहायता'],
                    ['carpenter','Carpenter'],['painter','Painter'],['gardener','Gardener'],
                    ['pest_control','Pest Control'],['house_shifting','House Shifting'],
                    ['car_wash','Car Washing / कार वॉश'],['transport','Transport & Delivery / सामान ढुलाई']
                  ] as const).map(([id,label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const selected = (id === 'technician'
                          ? ['ac_repair', 'fridge_repair', 'appliance_repair']
                          : [id]) as ServiceCategoryType[];
                        setRegTrades(current => selected.every(trade => current.includes(trade))
                          ? current.filter(trade => !selected.includes(trade))
                          : [...new Set([...current, ...selected])]);
                      }}
                      className={`py-2 px-2 rounded-lg border text-left text-xs font-semibold ${(id === 'technician' ? ['ac_repair', 'fridge_repair', 'appliance_repair'].every(trade => regTrades.includes(trade as ServiceCategoryType)) : regTrades.includes(id as ServiceCategoryType)) ? 'bg-blue-100 text-blue-900 border-blue-400' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Operating City / Service Area (शहर)</label>
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

              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm text-amber-950">
                <div className="font-bold mb-1">KYC verification is a separate, secure step</div>
                <p>Abhi sirf basic partner profile submit hoga. Is form mein Aadhaar/PAN number, certificate number, UPI ID ya security deposit collect nahi kiya jayega. Secure document upload aur admin verification available hone tak aapka KYC pending rahega aur aap jobs accept nahi kar sakenge. Kisi ko bhi WhatsApp/chat par apne documents ya OTP na bhejein.</p>
              </div>

              {regError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {regError}
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  setRegError('');
                  if (!regName.trim() || !regEmail.trim() || !regCity.trim() || regTrades.length === 0) {
                    setRegError('Please enter your name, email, city and select at least one trade.');
                    return;
                  }
                  const verifiedPhone = auth.currentUser?.phoneNumber;
                  if (!verifiedPhone) {
                    setRegError('Please verify your mobile number with Firebase OTP first.');
                    setShowAuthModal(true);
                    return;
                  }
                  try {
                    const res = await registerTechnician({
                      name: regName.trim(),
                      phone: verifiedPhone,
                      email: regEmail.trim(),
                      trades: regTrades,
                      experienceYears: Math.max(0, regExp),
                      city: regCity.trim()
                    });
                    if (!res.success) {
                      setRegError(res.message || 'Registration failed');
                    }
                  } catch {
                    setRegError('Registration could not be completed. Please try again.');
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl mt-2 transition-colors"
              >
                Submit Channel Partner Registration
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
            {currentUser?.quickFixId && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-blue-700">QuickFix ID</span>
                <span className="font-mono text-[10px] font-extrabold tracking-wide text-slate-800">{currentUser.quickFixId}</span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(currentUser.quickFixId || '');
                  }}
                  className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700"
                  aria-label="Copy QuickFix ID"
                >Copy</button>
              </div>
            )}
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
            type="button"
            disabled={dutyStatusLoading}
            onClick={async () => {
              setDutyStatusLoading(true);
              setQualificationAlertMsg('');
              if (currentTechnician.isOnline) {
                const result = await updatePartnerDutyStatus(false);
                if (!result.success) setQualificationAlertMsg(result.message);
                else setPayoutSuccess(result.message);
                setDutyStatusLoading(false);
                return;
              }
              if (!navigator.geolocation) {
                setQualificationAlertMsg('This device does not support GPS location. Enable location services or use a supported device.');
                setDutyStatusLoading(false);
                return;
              }
              navigator.geolocation.getCurrentPosition(async position => {
                const result = await updatePartnerDutyStatus(true, {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracyMeters: position.coords.accuracy
                });
                if (!result.success) setQualificationAlertMsg(result.message);
                else setPayoutSuccess(result.message);
                setDutyStatusLoading(false);
              }, error => {
                setQualificationAlertMsg(error.code === error.PERMISSION_DENIED
                  ? 'GPS permission was denied. Allow location access to activate duty.'
                  : 'Current GPS location could not be obtained. Check device location and try again.');
                setDutyStatusLoading(false);
              }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs ${
              currentTechnician.isOnline
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-200'
                : !currentTechnician.isVerified || currentTechnician.approvalStatus === 'pending_audit'
                ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 cursor-pointer'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            title={!currentTechnician.isVerified ? 'Qualification approval required' : undefined}
          >
            <Power className="w-3.5 h-3.5" />
            <span>
              {currentTechnician.isOnline
                ? 'ONLINE'
                : !currentTechnician.isVerified || currentTechnician.approvalStatus === 'pending_audit'
                ? 'AUDIT PENDING'
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

        {!currentTechnician.isVerified && <PartnerKycPanel />}

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

        <PartnerRechargeCard />
        <PartnerUpiQrCard />

        {/* ================= PARTNER WALLET CARD ================= */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white rounded-2xl p-4 shadow-md border border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Partner Wallet</span>
                <span className="text-[10px] text-amber-300">Ledger / payment gateway not connected</span>
              </div>
            </div>

            <span className="text-[10px] text-amber-300">Ledger / payment gateway not connected</span>
          </div>

          {/* Wallet Balances Grid */}
          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            {/* Total Balance */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Profile Balance</span>
              <div className="text-lg font-extrabold font-mono text-white mt-0.5">
                ₹{currentTechnician.walletBalance ?? 0}
              </div>
            </div>

            {/* Net Withdrawable Earnings */}
            <div>
              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Withdrawable</span>
              <div className="text-lg font-extrabold font-mono text-emerald-400 mt-0.5">
                ₹{withdrawableAmount}
              </div>
              <span className="text-[9px] text-slate-500 block leading-tight">Not payout-confirmed</span>
            </div>
          </div>

          {/* Cash Ledger & Commission Breakdown Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80 text-slate-300">
            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
              <span className="text-[10px] text-slate-400 block">Cash Handed by Customers</span>
              <span className="font-bold text-white font-mono">₹{currentTechnician.lifetimeCashCollected ?? 0}</span>
            </div>
            <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
              <span className="text-[10px] text-slate-400 block">Legacy commission records (historical)</span>
              <span className="font-bold text-rose-400 font-mono">-₹{currentTechnician.lifetimeCommissionPaid ?? 0}</span>
            </div>
          </div>

          {/* Wallet Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled
              title="Wallet top-up will be enabled after verified payment integration."
              className="bg-slate-800 text-slate-500 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Top-up unavailable</span>
            </button>

            <button
              type="button"
              disabled
              title="Payouts are disabled until a verified server-side ledger and payment provider are configured."
              className="bg-slate-800 text-slate-500 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Payout unavailable</span>
            </button>
          </div>

          {/* Cash Commission & Safe Payout Transparency Note */}
          <div className="text-[10px] text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 leading-relaxed space-y-1">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong>Wallet status:</strong> This screen currently displays the balance saved on your partner profile. A verified, server-side wallet ledger is not connected yet, so no top-up, commission debit, or reserve movement is confirmed here. Do not transfer money based on this screen.
              </span>
            </div>
            <div className="flex items-start gap-1.5 text-slate-400 pt-0.5 border-t border-slate-900">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Payout status:</strong> Payout requests and transfers are disabled until a payment provider and verified server-side ledger are configured. No payout is being processed or settled from this screen.
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

        {/* Server-verified available jobs */}
        {isTechnicianLoggedIn && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Available Service Requests</h2>
              <button type="button" onClick={() => void loadAvailableJobs()} disabled={jobsLoading}
                className="text-xs font-semibold text-blue-700 disabled:text-slate-400">
                {jobsLoading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            {jobsError && <p className="text-xs text-rose-700">{jobsError}</p>}
            {acceptedJobMessage && <p className="text-xs text-emerald-700 font-semibold">{acceptedJobMessage}</p>}
            {acceptError && <p className="text-xs text-rose-700">{acceptError}</p>}
            {!jobsLoading && availableJobs.length === 0 && !jobsError && (
              <p className="text-xs text-slate-500">No matching service requests are available right now.</p>
            )}
            {availableJobs.map(job => (
              <div key={job.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{job.serviceTitle || 'Service request'}</p>
                    <p className="text-[11px] text-slate-500">Request #{job.id} · {job.category}</p>
                    <p className="text-[11px] text-slate-600 mt-1">Customer: {job.customerName || 'QuickFix customer'}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-800">₹{job.totalAmount || job.price || 0}</span>
                </div>
                {job.lineItems?.length ? <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Customer-approved item-wise rate</p>
                  {job.lineItems.map((line, index) => <div key={line.serviceTitle + index} className="flex justify-between gap-2 text-[11px]">
                    <span className="text-slate-700">{line.serviceTitle} × {line.quantity} {line.billingUnit.replaceAll('_', ' ')}{line.unitRateMinimum !== undefined ? ` · ₹${line.unitRateMinimum}${line.unitRateMaximum !== undefined && line.unitRateMaximum !== line.unitRateMinimum ? '–₹' + line.unitRateMaximum : ''}/unit` : ''}</span>
                    <strong className="text-slate-900">₹{line.lineTotalMinimum}{line.lineTotalMaximum !== line.lineTotalMinimum ? '–₹' + line.lineTotalMaximum : ''}</strong>
                  </div>)}
                  <div className="border-t border-slate-200 pt-1 flex justify-between text-xs font-bold"><span>Estimated total</span><span>₹{job.lineItems.reduce((sum, line) => sum + line.lineTotalMinimum, 0)}{job.lineItems.some(line => line.lineTotalMaximum !== line.lineTotalMinimum) ? ' – ₹' + job.lineItems.reduce((sum, line) => sum + line.lineTotalMaximum, 0) : ''}</span></div>
                </div> : <p className="text-[10px] text-amber-700">Item-wise approved price not available yet; do not add unapproved charges.</p>}
                <button type="button" disabled={acceptingBookingId !== null || jobsLoading}
                  onClick={() => void handleAcceptJob(job.id)}
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 text-xs disabled:bg-slate-300">
                  {acceptingBookingId === job.id ? 'Accepting securely…' : 'Accept Service · Start 1-Hour SLA'}
                </button>
              </div>
            ))}
          </section>
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
              {currentActiveJob.lineItems?.length ? <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-blue-800">Approved service price breakdown</p>
                {currentActiveJob.lineItems.map((line, index) => <div key={line.serviceId + index} className="flex justify-between gap-2 text-[11px] text-slate-700">
                  <span>{line.serviceTitle} × {line.quantity} {line.billingUnit.replaceAll('_', ' ')}</span>
                  <strong>₹{line.lineTotalMinimum}{line.lineTotalMaximum !== line.lineTotalMinimum ? '–₹' + line.lineTotalMaximum : ''}</strong>
                </div>)}
                <div className="border-t border-blue-200 pt-1 flex justify-between text-xs font-bold text-slate-900"><span>Estimated total</span><span>₹{currentActiveJob.lineItems.reduce((sum, line) => sum + line.lineTotalMinimum, 0)} – ₹{currentActiveJob.lineItems.reduce((sum, line) => sum + line.lineTotalMaximum, 0)}</span></div>
                <p className="text-[10px] text-blue-800">Extra work/materials only after a separate customer-approved quote.</p>
              </div> : <p className="text-[10px] text-amber-700">No published item-wise rate snapshot on this older booking.</p>}
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

              <LiveLocationPanel
                bookingId={currentActiveJob.id}
                role="partner"
                active={currentActiveJob.status === 'assigned' || currentActiveJob.status === 'technician_en_route' || currentActiveJob.status === 'in_progress'}
              />
            </div>
            {['assigned', 'technician_en_route', 'in_progress'].includes(currentActiveJob.status) && (
              <BookingSosButton bookingId={currentActiveJob.id} reporterRole="partner" />
            )}

            {/* 1-Hour SLA Countdown Timer Banner */}
            {(currentActiveJob.status === 'technician_en_route' || currentActiveJob.status === 'in_progress') && (
              <SlaCountdownBadge
                deadline={currentActiveJob.serviceDeadline}
                acceptedAt={currentActiveJob.acceptedAt}
                createdAt={currentActiveJob.createdAt}
              />
            )}

            {(currentActiveJob.status === 'assigned' || currentActiveJob.status === 'technician_en_route') ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
                <label className="block text-xs font-bold text-blue-900">Customer Start OTP (6 digits)</label>
                <div className="flex gap-2">
                  <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpInput} onChange={event => setOtpInput(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter customer OTP" className="min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-mono tracking-widest" />
                  <button type="button" disabled={jobActionLoading} onClick={() => void handleStartJobWithOtp(currentActiveJob.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{jobActionLoading ? 'Checking…' : 'Verify & Start'}</button>
                </div>
                {otpError && <p className="text-xs text-rose-700">{otpError}</p>}
              </div>
            ) : currentActiveJob.status === 'in_progress' ? (
              <button type="button" disabled={jobActionLoading} onClick={() => void handleCompleteJob(currentActiveJob.id)} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{jobActionLoading ? 'Saving…' : 'Mark Service Complete'}</button>
            ) : null}
            {jobActionError && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{jobActionError}</p>}
            <p className="text-[10px] text-slate-500">Job status is verified by QuickFix server. Payment or payout is not marked settled by this action.</p>

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
                  <p className="text-[10px] text-slate-500">Wallet top-up is unavailable until secure payment integration is enabled.</p>
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
                <strong>Wallet safety:</strong> No reserve is required. Wallet top-up and payout remain disabled until the verified server-side ledger and payment provider are connected.
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
