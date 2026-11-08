import React, { useState } from 'react';
import { X, Phone, User, Mail, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { INDIAN_CITIES } from '../../data/mockData';

interface CustomerAuthModalProps {
  onClose: () => void;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({ onClose }) => {
  const { loginCustomer, registerCustomer, currentCity, setCurrentCity } = useQuickFix();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [phone, setPhone] = useState('9845199221');
  const [name, setName] = useState('Ananya Deshmukh');
  const [email, setEmail] = useState('ananya.deshmukh@gmail.com');
  const [address, setAddress] = useState('Flat 402, Sai Silver Woods, Koramangala 4th Block');
  const [otpStep, setOtpStep] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('1234');

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    setOtpStep(true);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegisterMode) {
      registerCustomer(name, `+91 ${phone}`, email, address);
    } else {
      loginCustomer(`+91 ${phone}`, name);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-blue-600 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-blue-700 hover:bg-blue-800 flex items-center justify-center text-white/90"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-3 text-white font-bold text-xl">
            Q
          </div>
          <h3 className="text-lg font-bold">
            {otpStep ? 'Verify Mobile Number' : isRegisterMode ? 'Create QuickFix Account' : 'Welcome to QuickFix'}
          </h3>
          <p className="text-xs text-blue-100 mt-0.5">
            {otpStep
              ? `We sent a 4-digit OTP to +91 ${phone}`
              : 'India’s trusted marketplace for verified technicians'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-5">
          {!otpStep ? (
            <form onSubmit={handleSendOtp} className="space-y-3.5">
              {/* City selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Your City
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

              {isRegisterMode && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Ananya Deshmukh"
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="ananya@example.com"
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Default Delivery Address
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="House / Flat No, Area, Landmark"
                        className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Phone number */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <div className="bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700 flex items-center border-r border-slate-300">
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                    className="flex-1 text-xs px-3 py-2.5 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/20 active:scale-98 transition-all mt-2"
              >
                Send 4-Digit OTP
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setIsRegisterMode(!isRegisterMode)}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  {isRegisterMode ? 'Already have an account? Sign In' : 'New to QuickFix? Create Account'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center py-2">
                <div className="text-xs text-slate-600 mb-3">
                  Enter demonstration OTP <span className="font-mono font-bold text-blue-600">1234</span>
                </div>
                <input
                  type="text"
                  maxLength={4}
                  value={enteredOtp}
                  onChange={e => setEnteredOtp(e.target.value)}
                  className="w-36 mx-auto text-center font-mono tracking-widest text-2xl font-bold py-2 border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-blue-600/20 active:scale-98 transition-all"
              >
                Verify & Continue
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setOtpStep(false)}
                  className="text-blue-600 hover:underline"
                >
                  Change Number
                </button>
                <button
                  type="button"
                  onClick={() => alert('New OTP sent: 1234')}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-bit encrypted data · Certified technicians</span>
          </div>
        </div>
      </div>
    </div>
  );
};
