import React, { useEffect, useRef, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../lib/firebase';
import {
  X,
  Phone,
  User,
  Mail,
  MapPin,
  Shield,
  ShieldCheck,
  Wrench,
  Zap,
  Lock,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Award,
  Wind,
  Snowflake,
  Wallet
} from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { ServiceCategoryType, UserRole, isAuthorizedAdminEmail } from '../../types';
import { INDIAN_CITIES } from '../../data/mockData';

interface AuthModalProps {
  onClose: () => void;
  initialRole?: UserRole;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, initialRole = 'customer' }) => {
  const {
    authenticateUser,
    authenticateFirebaseCustomer,
    registerNewPartner,
    signInExistingPartner,
    currentCity,
    setCurrentCity,
    setActiveRole
  } = useQuickFix();

  // Selected Auth Tab: 'customer' | 'partner' | 'admin'
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>(initialRole);
  const [isSignupMode, setIsSignupMode] = useState(false);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [captchaCode, setCaptchaCode] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const [captchaInput, setCaptchaInput] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Partner Specific Fields
  const [partnerTrades, setPartnerTrades] = useState<ServiceCategoryType[]>(['electrician']);
  const [partnerState, setPartnerState] = useState('');
  const [partnerDistrict, setPartnerDistrict] = useState('');
  const [partnerTehsil, setPartnerTehsil] = useState('');
  const [experienceYears, setExperienceYears] = useState(7);

  // Admin Specific Fields
  const [adminPasscode, setAdminPasscode] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminError, setAdminError] = useState('');

  // OTP Verification Step
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [formError, setFormError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
    };
  }, []);

  const toggleTrade = (trade: ServiceCategoryType) => {
    if (partnerTrades.includes(trade)) {
      if (partnerTrades.length > 1) {
        setPartnerTrades(partnerTrades.filter(t => t !== trade));
      }
    } else {
      setPartnerTrades([...partnerTrades, trade]);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (selectedRoleTab === 'admin') {
      setFormError('Admin sign-in must use the dedicated secure Admin Login screen.');
      return;
    }
    if (!isFirebaseConfigured) {
      setFormError('Firebase is not configured for this deployment. Please contact support; no SMS was sent.');
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (captchaInput.trim().toUpperCase() !== captchaCode) {
      setFormError('Captcha code sahi type karein.');
      setCaptchaInput('');
      setCaptchaCode(Math.random().toString(36).slice(2, 8).toUpperCase());
      return;
    }
    setIsSendingOtp(true);
    try {
      if (!recaptchaContainerRef.current) {
        throw new Error('Phone verification container is unavailable.');
      }
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, { size: 'invisible' });
      }
      const result = await signInWithPhoneNumber(auth, '+91' + phone, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setIsOtpStep(true);
      setEnteredOtp('');
      setCaptchaInput('');
      setCaptchaCode(Math.random().toString(36).slice(2, 8).toUpperCase());
      setFormError('');
    } catch (error: any) {
      const errorCode = typeof error?.code === 'string' ? error.code : 'auth/unknown';
      // Log only sanitized diagnostic metadata; never log the user's phone number, OTP, or credentials.
      const rawMessage = typeof error?.message === 'string' ? error.message : '';
      const safeMessage = rawMessage
        .replace(/\+?91\s*\d{10}/g, '[phone redacted]')
        .replace(/\b\d{10}\b/g, '[phone redacted]')
        .replace(/[A-Za-z0-9_-]{40,}/g, '[token redacted]')
        .slice(0, 180);
      console.warn('Firebase phone OTP send failed:', { code: errorCode, message: safeMessage });
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      const messages: Record<string, string> = {
        'auth/too-many-requests': 'Firebase has temporarily blocked requests or the SMS quota is exhausted. Wait before trying again.',
        'auth/quota-exceeded': 'Firebase SMS quota is exhausted. Try again after the quota resets.',
        'auth/invalid-phone-number': 'The mobile number is invalid. Please check the 10-digit number.',
        'auth/captcha-check-failed': 'reCAPTCHA verification failed. Refresh the page and try again.',
        'auth/invalid-app-credential': 'Firebase rejected the app verification credential. Check the Firebase web app configuration and reCAPTCHA setup.',
        'auth/missing-app-credential': 'Firebase did not receive the app verification credential. Check reCAPTCHA and the authorized domain.',
        'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication.',
        'auth/operation-not-allowed': 'Phone sign-in is not enabled for this Firebase project.',
        'auth/app-not-authorized': 'This app is not authorized to use Firebase Authentication. Verify the Firebase API key and app configuration.',
        'auth/network-request-failed': 'Network request failed. Check the internet connection and try again.',
        'auth/internal-error': 'Firebase returned an internal error. Check the Firebase Authentication configuration and try again.'
      };
      const explanation = messages[errorCode] || 'Firebase could not send the SMS. Use the error code below to identify the exact Firebase issue.';
      const detail = safeMessage && !safeMessage.includes(errorCode)
        ? ` Firebase detail: ${safeMessage}`
        : '';
      setFormError(`${explanation}${detail} ( ${errorCode} )`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(enteredOtp.trim())) {
      setFormError('Please enter the 6-digit SMS verification code.');
      return;
    }
    if (!confirmationResult) {
      setFormError('OTP verification session expired. Please request a new code.');
      setIsOtpStep(false);
      return;
    }
    try {
      const credential = await confirmationResult.confirm(enteredOtp.trim());
      if (selectedRoleTab === 'technician') {
        if (!isSignupMode) {
          const result = await signInExistingPartner();
          if (!result.success) {
            setFormError(result.message || 'Channel Partner sign-in failed. Please try again.');
            return;
          }
          setActiveRole('technician');
          onClose();
          return;
        }
        const result = await registerNewPartner({
          displayName,
          phoneNumber: credential.user.phoneNumber || '+91' + phone,
          email,
          trades: partnerTrades,
          experienceYears,
          city: currentCity,
          address,
          serviceArea: { state: partnerState, district: partnerDistrict, tehsil: partnerTehsil },
          rememberMe
        });
        if (!result.success) {
          setFormError(result.message || 'Unable to complete partner registration.');
          return;
        }
        setActiveRole('technician');
        setFormError(result.message || 'Basic partner profile created. Approval is pending.');
        onClose();
        return;
      }
      if (selectedRoleTab !== 'customer') {
        setFormError('This account type cannot be completed through customer phone sign-in.');
        return;
      }
      const result = await authenticateFirebaseCustomer({
        firebaseUser: credential.user,
        displayName,
        email,
        address,
        city: currentCity,
        rememberMe
      });
      if (!result.success) {
        setFormError(result.message || 'Unable to complete customer sign-in.');
        return;
      }
      setActiveRole('customer');
      onClose();
    } catch (error: any) {
      const errorCode = typeof error?.code === 'string' ? error.code : 'auth/unknown';
      console.warn('Firebase OTP verification failed:', errorCode);
      const verifyMessages: Record<string, string> = {
        'auth/invalid-verification-code': 'Incorrect OTP. Please check the SMS and try again.',
        'auth/code-expired': 'This OTP has expired. Request a new code.',
        'auth/session-expired': 'The verification session expired. Request a new code.',
        'auth/too-many-requests': 'Too many verification attempts. Wait before trying again.',
        'auth/network-request-failed': 'Network request failed. Check the internet connection and try again.'
      };
      setFormError(`${verifyMessages[errorCode] || 'OTP verification failed. Please request a new code.'} ( ${errorCode} )`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with QuickFix Branding */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-white text-blue-600 flex items-center justify-center font-black text-lg shadow-sm">
              Q
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-white text-sm">QuickFix</span>
              <span className="text-[10px] text-blue-200 ml-1.5 uppercase tracking-wider font-semibold">India</span>
            </div>
          </div>

          <h3 className="text-base font-bold">
            {isOtpStep
              ? 'Verify Mobile OTP'
              : selectedRoleTab === 'customer'
              ? isSignupMode ? 'Create Customer Account' : 'Customer Sign In'
              : selectedRoleTab === 'technician'
              ? isSignupMode ? 'Register as Channel Partner' : 'Channel Partner Sign In'
              : 'Admin Operations Login'}
          </h3>
          <p className="text-xs text-blue-100 mt-0.5">
            {isOtpStep
              ? `SMS verification code sent to +91 ${phone}`
              : 'Customer login uses Firebase phone verification'}
          </p>
        </div>

        {/* Role Segmented Tabs (only before OTP step) */}
        {!isOtpStep && (
          <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold p-1 gap-1">
            <button
              type="button"
              onClick={() => {
                setSelectedRoleTab('customer');
                setFormError('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                selectedRoleTab === 'customer'
                  ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Customer</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoleTab('technician');
                setFormError('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                selectedRoleTab === 'technician'
                  ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Channel Partner</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRoleTab('admin');
                setFormError('');
              }}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                selectedRoleTab === 'admin'
                  ? 'bg-white text-blue-700 shadow-xs font-bold border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-amber-600" />
              <span>Admin</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {formError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {!isOtpStep ? (
            /* STEP 1: Phone / Registration Form */
            <form onSubmit={handleSendOtp} className="space-y-3.5 text-xs">
              {/* City selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Service City
                </label>
                <select
                  value={currentCity}
                  onChange={e => setCurrentCity(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {INDIAN_CITIES.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* CUSTOMER FORM */}
              {selectedRoleTab === 'customer' && (
                <>
                  {isSignupMode && (
                    <>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            required
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder="Ananya Deshmukh"
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="ananya@example.com"
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Default Service Address
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            required
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Flat/House No, Building, Landmark, Pin code"
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Mobile Number (+91)
                    </label>
                    <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <span className="bg-slate-100 px-3 py-2 font-bold text-slate-700 flex items-center border-r border-slate-300 text-xs">
                        🇮🇳 +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="98451 99221"
                        className="flex-1 px-3 py-2 font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <label htmlFor="quickfix-text-captcha" className="text-[11px] font-bold text-slate-600 block">Security Code / Captcha</label>
                    <div className="flex items-center gap-2">
                      <div className="min-w-[112px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg font-black tracking-[0.25em] text-slate-800 select-none line-through decoration-slate-400">{captchaCode}</div>
                      <button type="button" onClick={() => { setCaptchaCode(Math.random().toString(36).slice(2, 8).toUpperCase()); setCaptchaInput(''); setFormError(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700">↻ Refresh</button>
                    </div>
                    <input id="quickfix-text-captcha" type="text" autoComplete="off" maxLength={6} value={captchaInput} onChange={e => setCaptchaInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))} placeholder="Upar diya code likhein" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <p className="text-[10px] text-slate-500">Image mein dikh raha 6-character code type karein.</p>
                  </div>
                  <div ref={recaptchaContainerRef} id="quickfix-recaptcha-container" className="fixed left-0 top-0 h-px w-px overflow-hidden opacity-0" aria-hidden="true" />
                </>
              )}

              {/* PARTNER FORM */}
              {selectedRoleTab === 'technician' && (
                <>
                  {isSignupMode ? (
                    <>
                      {/* Qualification & Wallet Compliance Alert */}
                      <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-start gap-2 text-amber-900">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-snug">
                          <strong className="font-bold block text-amber-950">Partner onboarding & verification</strong>
                          Electricians, Plumbers, AC and Fridge Technicians can submit a basic profile for review. Admin approval and any future KYC or payment steps will be handled separately after the secure process is ready.
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Technician Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Qualified Trade & Specialty (Select at least one)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            ['electrician', 'Electrician'],
                            ['plumber', 'Plumber'],
                            ['technician', 'Technician (AC / Fridge)'],
                            ['welder', 'Welder / Fabricator'],
                            ['mechanic', 'Mechanic'],
                            ['driver', 'Driver'],
                            ['tourist_guide', 'Tourist Guide'],
                            ['contractor', 'Contractor'],
                            ['bike_taxi', 'QuickFix Bike Taxi Captain'],
                            ['kaamkaaj_partner', 'Kaam-Kaaj Partner (सभी घरेलू काम)'],
                            ['house_cleaning', 'House Cleaning'],
                            ['cook', 'Cook / खाना बनाना'],
                            ['laundry', 'Laundry / कपड़े धोना-प्रेस'],
                            ['maid', 'Maid / घरेलू सहायता'],
                            ['carpenter', 'Carpenter'],
                            ['painter', 'Painter'],
                            ['gardener', 'Gardener'],
                            ['pest_control', 'Pest Control'],
                            ['house_shifting', 'House Shifting'],
                            ['car_wash', 'Car Washing / कार वॉश'],
                            ['transport', 'Transport & Delivery / सामान ढुलाई']
                          ] as const).map(([trade, label]) => (
                            <button
                              key={trade}
                              type="button"
                              onClick={() => toggleTrade(trade)}
                              className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs ${
                                partnerTrades.includes(trade)
                                  ? 'bg-blue-50 text-blue-900 border-blue-400 ring-1 ring-blue-300'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>                      </div>

                      {/* Structured service area is used for local job matching. */}
                      <div className="space-y-2">
                        <div className="font-bold text-slate-700 text-xs">Service Area</div>
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={partnerState}
                          onChange={e => setPartnerState(e.target.value)}
                          placeholder="State (e.g. Madhya Pradesh)"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={partnerDistrict}
                          onChange={e => setPartnerDistrict(e.target.value)}
                          placeholder="District (e.g. Burhanpur)"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={partnerTehsil}
                          onChange={e => setPartnerTehsil(e.target.value)}
                          placeholder="Tehsil / Taluka"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                      </div>

                      {/* Basic registration only. KYC and payments are deliberately deferred. */}
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                        <div className="font-bold text-emerald-900 text-xs">Basic profile registration</div>
                        <label className="text-[11px] font-bold text-slate-700 block">Work experience (years)</label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          value={experienceYears}
                          onChange={e => setExperienceYears(Math.max(0, Math.min(60, Number(e.target.value))))}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                        />
                        <p className="text-[11px] text-emerald-900 leading-relaxed">
                          Your basic profile will be submitted for review. Government ID, certificates, UPI details and any deposit are not collected at this stage. Do not send money during registration.
                        </p>
                      </div>
                    </>
                  ) : null}

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Partner Mobile Number (+91)
                    </label>
                    <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                      <span className="bg-slate-100 px-3 py-2 font-bold text-slate-700 flex items-center border-r border-slate-300 text-xs">
                        🇮🇳 +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="98450 12345"
                        className="flex-1 px-3 py-2 font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ADMIN FORM */}
              {selectedRoleTab === 'admin' && (
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Admin Security Passcode
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={adminPasscode}
                        onChange={e => setAdminPasscode(e.target.value)}
                        placeholder="Enter master passcode"
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {adminError && (
                      <p className="text-[10px] text-red-600 font-semibold mt-1">{adminError}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      HQ Authorized Mobile Number
                    </label>
                    <div className="flex rounded-xl border border-slate-300 overflow-hidden bg-white">
                      <span className="bg-slate-100 px-3 py-2 font-bold text-slate-700 text-xs">🇮🇳 +91</span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={adminPhone}
                        onChange={e => setAdminPhone(e.target.value.replace(/\D/g, ''))}
                        className="flex-1 px-3 py-2 font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Remember Me Checkbox */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="rememberMe" className="text-xs text-slate-600 select-none cursor-pointer">
                  Remember this device for seamless login
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 transition-all"
              >
                <span>Request Verification OTP</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Switch between Sign In / Sign Up (Customer & Partner) */}
              {selectedRoleTab !== 'admin' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignupMode(!isSignupMode);
                      setFormError('');
                    }}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    {isSignupMode
                      ? 'Already registered? Sign In'
                      : selectedRoleTab === 'technician'
                      ? 'New Service Technician? Register Trade & KYC'
                      : 'New to QuickFix? Create Account'}
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* STEP 2: OTP Verification */
            <form onSubmit={handleVerifyAndComplete} className="space-y-4 text-xs">
              <div className="text-center py-2 space-y-1">
                <p className="text-slate-600">
                  Enter the 6-digit code sent via Firebase SMS Gateway:
                </p>
                <div className="py-2">
                  <input
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    value={enteredOtp}
                    onChange={e => setEnteredOtp(e.target.value)}
                    className="w-36 mx-auto text-center font-mono tracking-widest text-2xl font-extrabold py-2 border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Use the 6-digit code received by SMS. Never share your OTP with anyone.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verify OTP & Enter QuickFix</span>
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOtpStep(false)}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Change Number
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormError('To request a new code, return to the phone number step and request OTP again.');
                    setIsOtpStep(false);
                  }}
                  className="text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resend OTP</span>
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Firebase Auth · Firestore Sync · Encrypted Storage</span>
          </div>
        </div>
      </div>
    </div>
  );
};
