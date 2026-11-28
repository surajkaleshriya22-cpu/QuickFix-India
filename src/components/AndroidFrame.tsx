import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Signal,
  Battery,
  Smartphone,
  Maximize2,
  Code2,
  Flame,
  User,
  Shield,
  Wrench,
  LogIn,
  Lock
} from 'lucide-react';
import { useQuickFix } from '../context/QuickFixContext';

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  const {
    language,
    setLanguage,
    viewMode,
    setViewMode,
    activeRole,
    setActiveRole,
    setShowCodeInspector,
    setShowFirebaseConfig,
    setShowAuthModal,
    setShowProfileDrawer,
    currentUser,
    isAuthenticated
  } = useQuickFix();

  const [currentTime, setCurrentTime] = useState('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleSwitch = (role: 'customer' | 'technician' | 'admin') => {
    // If switching to admin or partner, and current user has a different role, we can allow preview or open auth
    setActiveRole(role);
  };

  return (
    <div className="min-h-screen bg-[#102A56] text-slate-100 flex flex-col font-sans">
      {/* Top Universal Control Bar */}
      <header className="relative bg-gradient-to-r from-[#102A56] via-[#123B79] to-[#0B4FCB] border-b border-blue-950 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 z-50 shadow-lg shadow-blue-950/20">
        <div className="absolute bottom-0 left-0 right-0 kamxapp-accent-rule" />
        <div className="flex items-center gap-3">
          <img src="/icons/kamxapp-mark.svg" alt="KamXApp" className="w-11 h-11 rounded-xl bg-white p-0.5 shadow-md shadow-blue-950/30 ring-1 ring-white/50" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white tracking-tight text-sm">KamX<span className="text-orange-400">App</span></span>
              <span className="text-[11px] text-orange-300 font-semibold">भारत</span>
              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded font-mono hidden md:inline">
                Firebase Auth & Firestore
              </span>
            </div>
            <p className="text-[11px] text-slate-300 hidden sm:block">{language === 'hi' ? 'हर काम का एक समाधान' : 'One solution for every need'}</p>
          </div>
        </div>

        {/* Dashboard Switcher Pill Bar */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => handleRoleSwitch('customer')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeRole === 'customer'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'hi' ? 'ग्राहक ऐप' : 'Customer App'}
          </button>
          <button
            onClick={() => handleRoleSwitch('technician')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeRole === 'technician'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {language === 'hi' ? 'चैनल पार्टनर' : 'Channel Partner'}
          </button>
          <button
            onClick={() => handleRoleSwitch('admin')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeRole === 'admin'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>{currentUser?.role === 'admin' ? (language === 'hi' ? 'एडमिन डैशबोर्ड' : 'Admin Dashboard') : (language === 'hi' ? 'एडमिन लॉगिन' : 'Admin HQ Lock')}</span>
          </button>
        </div>

        {/* One language switch for every web-app role and screen */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === "hi" ? "en" : "hi")}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
            aria-label={language === "hi" ? "Switch app to English" : "ऐप की भाषा हिंदी करें"}
          >
            {language === "hi" ? "हिंदी" : "English"}
          </button>
          {/* User Account / Auth Button */}
          {isAuthenticated && currentUser ? (
            <button
              onClick={() => setShowProfileDrawer(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg transition-colors"
              title={language === 'hi' ? 'प्रोफ़ाइल और पते देखें' : 'View Profile and Addresses'}
            >
              <div className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {currentUser.displayName.charAt(0)}
              </div>
              <span className="max-w-[90px] truncate hidden sm:inline">{currentUser.displayName.split(' ')[0]}</span>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded uppercase">
                {currentUser.role}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'लॉगिन / रजिस्टर' : 'Sign In / Up'}</span>
            </button>
          )}

          {/* Firebase Guide Button */}
          <button
            onClick={() => setShowFirebaseConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 rounded-lg hover:bg-amber-900 transition-colors shadow-sm"
            title={language === 'hi' ? 'Firebase कॉन्फ़िगरेशन और Firestore नियम देखें' : 'View Firebase Configuration, SHA-1 & Firestore Rules'}
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span className="hidden md:inline">{language === 'hi' ? 'Firebase सेटअप' : 'Firebase Setup'}</span>
          </button>

          {/* Kotlin Code Button */}
          <button
            onClick={() => setShowCodeInspector(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded-lg hover:bg-emerald-900 transition-colors shadow-sm"
            title={language === 'hi' ? 'Android सोर्स फ़ाइलें देखें' : 'Inspect Kotlin & Jetpack Compose Android Source Files'}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Kotlin / Compose</span>
            <span className="md:hidden">Kotlin</span>
          </button>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('phone')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'phone' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title={language === 'hi' ? 'मोबाइल दृश्य' : 'Android Phone Mockup View (Pixel 8)'}
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('fullscreen')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'fullscreen' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title={language === 'hi' ? 'वेब / टैबलेट दृश्य' : 'Responsive Web / Tablet View'}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {viewMode === 'phone' ? (
          /* Phone Mockup Frame */
          <div className="relative w-full max-w-[412px] h-[860px] max-h-[calc(100vh-80px)] bg-slate-950 rounded-[44px] p-3 shadow-2xl ring-1 ring-white/10 shadow-blue-900/20 flex flex-col transition-all duration-300">
            {/* Phone Outer Edge & Buttons */}
            <div className="absolute -left-[5px] top-28 w-[3px] h-12 bg-slate-700 rounded-l-sm" />
            <div className="absolute -left-[5px] top-44 w-[3px] h-20 bg-slate-700 rounded-l-sm" />
            <div className="absolute -right-[5px] top-36 w-[3px] h-14 bg-slate-700 rounded-r-sm" />

            {/* Screen Inner Bezel */}
            <div className="relative flex-1 bg-white text-slate-900 rounded-[34px] overflow-hidden flex flex-col shadow-inner">
              {/* Android Status Bar */}
              <div className="h-7 bg-white text-slate-900 px-5 flex items-center justify-between text-xs font-semibold select-none z-30 shrink-0 border-b border-slate-100">
                <span>{currentTime}</span>
                {/* Punch Hole Camera */}
                <div className="w-3.5 h-3.5 bg-black rounded-full shadow-inner" />
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Signal className="w-3 h-3" />
                  <Wifi className="w-3 h-3" />
                  <span className="text-[10px] font-mono">98%</span>
                  <Battery className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Active Screen Content */}
              <div className="flex-1 overflow-y-auto relative flex flex-col bg-slate-50">
                {children}
              </div>

              {/* Android Gesture Bar */}
              <div className="h-4 bg-white flex items-center justify-center shrink-0 z-20">
                <div className="w-32 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          /* Responsive Fullscreen / Tablet Container */
          <div className="w-full max-w-6xl h-full max-h-[calc(100vh-80px)] bg-white text-slate-900 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto bg-slate-50">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
