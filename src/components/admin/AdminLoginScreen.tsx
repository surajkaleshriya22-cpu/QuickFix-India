import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  KeyRound,
  Mail,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Check
} from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { isAuthorizedAdminEmail, AUTHORIZED_ADMIN_EMAILS } from '../../types';

interface AdminLoginScreenProps {
  onBackToApp?: () => void;
}

export const AdminLoginScreen: React.FC<AdminLoginScreenProps> = ({ onBackToApp }) => {
  const { authenticateUser, setActiveRole } = useQuickFix();

  const [adminEmail, setAdminEmail] = useState('surajkaleshriya22@gmail.com');
  const [adminPhone, setAdminPhone] = useState('+91 98000 12345');
  const [adminPasscode, setAdminPasscode] = useState('');
  const [securityPin2FA, setSecurityPin2FA] = useState('992211');
  const [showPasscode, setShowPasscode] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Anti-Brute Force Lockout
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutTimer]);

  const handleAdminLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (lockoutTimer > 0) {
      setErrorMessage(`Console locked due to multiple failed attempts. Please wait ${lockoutTimer}s.`);
      return;
    }

    // Step 1: Whitelist Verification
    if (!isAuthorizedAdminEmail(adminEmail)) {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      if (nextFail >= 3) {
        setLockoutTimer(60);
      }
      setErrorMessage(
        `⛔ ACCESS DENIED: The account "${adminEmail}" is not on the QuickFix Super Admin Whitelist. Customers and Technicians are strictly prohibited from logging into this console.`
      );
      return;
    }

    // Step 2: Passcode Verification
    if (adminPasscode.trim() !== 'ADMIN2026') {
      const nextFail = failedAttempts + 1;
      setFailedAttempts(nextFail);
      if (nextFail >= 3) {
        setLockoutTimer(60);
      }
      setErrorMessage('Invalid Master Security Passcode. Access attempt logged.');
      return;
    }

    // Step 3: Dual-Factor Security PIN
    if (securityPin2FA.trim() !== '992211') {
      setErrorMessage('Invalid 2FA Security Token / PIN.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('Credentials & Whitelist verified. Establishing encrypted Admin session...');

    setTimeout(() => {
      const result = authenticateUser({
        displayName: adminEmail.includes('suraj') ? 'Suraj (Super Admin Owner)' : 'QuickFix HQ Admin',
        phoneNumber: adminPhone,
        email: adminEmail,
        role: 'admin',
        city: 'Bengaluru',
        address: 'QuickFix Operations Hub, HSR Layout, Bengaluru - 560102',
        rememberMe: rememberMe
      });

      setIsLoading(false);

      if (!result.success) {
        setErrorMessage(result.message || 'Authentication rejected by security policy.');
      }
    }, 500);
  };

  return (
    <div className="flex-1 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 overflow-y-auto font-sans">
      {/* Top Header / Back Button */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <button
          onClick={() => {
            if (onBackToApp) onBackToApp();
            else setActiveRole('customer');
          }}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800/80 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customer App</span>
        </button>

        <span className="text-[10px] font-mono bg-red-950/80 text-red-300 border border-red-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold">
          <ShieldAlert className="w-3 h-3 text-red-400" />
          <span>RESTRICTED ADMIN ACCESS</span>
        </span>
      </div>

      {/* Main Login Card */}
      <div className="my-auto py-5 max-w-sm w-full mx-auto space-y-4">
        {/* Logo & Heading */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30 text-white border border-blue-400/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">QuickFix Super Admin HQ</h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Authorized Executive Command Center. Customer & Partner access is permanently blocked.
          </p>
        </div>

        {/* Security Whitelist Enforcement Notice */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Authorized Super Admin Whitelist</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Only pre-registered, whitelisted Administrator accounts can authenticate into this console:
          </p>
          <div className="bg-black/60 rounded-lg p-2 font-mono text-[11px] text-blue-300 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">1. surajkaleshriya22@gmail.com</span>
              <span className="text-[9px] bg-blue-900 text-blue-200 px-1.5 py-0.2 rounded">Primary Owner</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>2. ops.admin@quickfix.in</span>
              <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded">HQ Dispatch</span>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleAdminLogin} className="space-y-3 text-xs">
          {/* Admin Email */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Whitelisted Admin Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                placeholder="surajkaleshriya22@gmail.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Admin Phone */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Registered Mobile Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={adminPhone}
                onChange={e => setAdminPhone(e.target.value)}
                placeholder="+91 98000 12345"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Passcode Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-300">
                Master Security Passcode
              </label>
              <span className="text-[10px] text-blue-400 font-mono">Passcode: ADMIN2026</span>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type={showPasscode ? 'text' : 'password'}
                required
                value={adminPasscode}
                onChange={e => setAdminPasscode(e.target.value)}
                placeholder="Enter ADMIN2026"
                className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2FA Security Token */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                <span>2FA Security Token / PIN</span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono">PIN: 992211</span>
            </div>
            <input
              type="text"
              required
              value={securityPin2FA}
              onChange={e => setSecurityPin2FA(e.target.value)}
              placeholder="Enter 2FA PIN (992211)"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span className="text-slate-300 text-[11px]">Remember Encrypted Admin Session</span>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs leading-relaxed animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || lockoutTimer > 0}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span>Verifying Whitelisted Credentials...</span>
            ) : lockoutTimer > 0 ? (
              <span>Console Locked ({lockoutTimer}s)</span>
            ) : (
              <>
                <span>Authenticate & Unlock Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10px] text-slate-500 pt-3 border-t border-slate-800">
        QuickFix Operations Platform · Zero-Trust Role-Based Access Control · Non-admin access prohibited
      </div>
    </div>
  );
};
