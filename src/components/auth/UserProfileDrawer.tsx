import React, { useState } from 'react';
import { X, User, Phone, Mail, MapPin, Shield, LogOut, Check, Plus, Edit2, ShieldCheck, Wrench, Zap } from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { auth } from '../../lib/firebase';
import { EmergencyContactsSection } from './EmergencyContactsSection';

interface UserProfileDrawerProps {
  onClose: () => void;
  onOpenAuth: () => void;
}

export const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({ onClose, onOpenAuth }) => {
  const {
    language,
    currentUser,
    isAuthenticated,
    logoutUser,
    activeRole,
    setActiveRole,
    customer,
    updateCustomerAddress
  } = useQuickFix();

  const [newAddressText, setNewAddressText] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [supportCategory, setSupportCategory] = useState('other');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);

  const handleLogout = () => {
    logoutUser();
    onClose();
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressText.trim()) return;
    updateCustomerAddress({
      label: addressLabel,
      addressLine: newAddressText.trim(),
      city: currentUser?.city || 'Bengaluru',
      pincode: '560034'
    });
    setNewAddressText('');
    setShowAddAddress(false);
  };

  const getRoleBadge = () => {
    switch (currentUser?.role || activeRole) {
      case 'admin':
        return (
          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Shield className="w-3 h-3 text-red-600" />
            <span>{language === 'hi' ? 'एडमिन' : 'Admin HQ'}</span>
          </span>
        );
      case 'technician':
        return (
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Wrench className="w-3 h-3 text-blue-600" />
            <span>{language === 'hi' ? 'चैनल पार्टनर' : 'Channel Partner'}</span>
          </span>
        );
      default:
        return (
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>{language === 'hi' ? 'सत्यापित ग्राहक' : 'Verified Customer'}</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center font-bold text-2xl text-white shadow-inner">
              {(currentUser?.displayName || customer.name).charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white leading-tight">
                  {currentUser?.displayName || customer.name}
                </h3>
              </div>
              <p className="text-xs text-blue-200 font-mono mt-0.5">
                {currentUser?.phoneNumber || customer.phone}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                {getRoleBadge()}
                <span className="text-[10px] text-blue-200">
                  {currentUser?.city || 'Bengaluru'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* User Details Block */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{language === 'hi' ? 'खाते की जानकारी' : 'Account Information'}</div>
            
            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-2 text-slate-500">
                <Mail className="w-3.5 h-3.5 text-blue-600" /> Email
              </span>
              <span className="font-medium text-slate-900">{currentUser?.email || customer.email}</span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-2 text-slate-500">
                <Phone className="w-3.5 h-3.5 text-blue-600" /> Phone
              </span>
              <span className="font-mono font-medium text-slate-900">{currentUser?.phoneNumber || customer.phone}</span>
            </div>

            {currentUser?.quickFixId && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2">
                <span className="font-bold text-blue-800">{language === 'hi' ? 'आपकी KamXApp ID' : 'Your KamXApp ID'}</span>
                <span className="font-mono font-extrabold tracking-wide text-blue-900">{currentUser.quickFixId}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-700">
              <span className="flex items-center gap-2 text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Status
              </span>
              <span className="text-emerald-700 font-semibold">{language === 'hi' ? 'Firebase से सत्यापित' : 'Firebase Authenticated'}</span>
            </div>
          </div>

          {isAuthenticated && currentUser?.role !== 'admin' && <EmergencyContactsSection language={language} />}

          {/* {language === 'hi' ? 'सहेजे गए पते' : 'Saved Addresses'} Section (for Customer) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" /> Saved Addresses
              </span>
              <button
                type="button"
                onClick={() => setShowAddAddress(!showAddAddress)}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-0.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'hi' ? 'पता जोड़ें' : 'Add Address'}</span>
              </button>
            </div>

            {showAddAddress && (
              <form onSubmit={handleAddAddress} className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <div className="flex gap-1.5">
                  {(['Home', 'Work', 'Other'] as const).map(label => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAddressLabel(label)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        addressLabel === label ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  required
                  value={newAddressText}
                  onChange={e => setNewAddressText(e.target.value)}
                  placeholder={language === 'hi' ? 'मकान नंबर, बिल्डिंग, पहचान की जगह, पिन कोड...' : 'Flat/House No, Building, Landmark, Pin code...'}
                  rows={2}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-1.5 rounded-lg text-xs"
                >
                  {language === 'hi' ? 'पता सेव करें' : 'Save Address'}
                </button>
              </form>
            )}

            <div className="space-y-1.5">
              {customer.addresses.map(addr => (
                <div
                  key={addr.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-bold rounded text-[10px] uppercase">
                      {addr.label}
                    </span>
                    <span className="text-slate-700 leading-snug">{addr.addressLine}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const firebaseUser = auth.currentUser;
            if (!firebaseUser || supportBusy) { setSupportMessage('Please sign in first.'); return; }
            setSupportBusy(true); setSupportMessage('');
            try {
              const token = await firebaseUser.getIdToken(true);
              const response = await fetch('/api/support/tickets', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: supportCategory, subject: supportSubject, description: supportDescription })
              });
              const result = await response.json().catch(() => ({}));
              if (!response.ok || !result.success) throw new Error(result.error || 'Request could not be saved.');
              setSupportMessage('Ticket created: ' + result.ticketId);
              setSupportSubject(''); setSupportDescription('');
            } catch (error) { setSupportMessage(error instanceof Error ? error.message : 'Support request failed.'); }
            finally { setSupportBusy(false); }
          }} className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="font-bold text-slate-800">{language === 'hi' ? 'Customer Care / सहायता' : 'Customer Care / Get Help'}</div>
            <select value={supportCategory} onChange={e => setSupportCategory(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs">
              <option value="booking">Booking</option><option value="payment">Payment</option><option value="wallet">Wallet</option><option value="account">Account</option><option value="partner">Partner</option><option value="other">Other</option>
            </select>
            <input required minLength={4} maxLength={120} value={supportSubject} onChange={e => setSupportSubject(e.target.value)} placeholder={language === 'hi' ? 'समस्या का विषय' : 'Issue subject'} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" />
            <textarea required minLength={10} maxLength={2000} rows={3} value={supportDescription} onChange={e => setSupportDescription(e.target.value)} placeholder={language === 'hi' ? 'अपनी समस्या बताएं...' : 'Describe your issue...'} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs" />
            <button disabled={supportBusy} className="w-full rounded-lg bg-amber-600 py-2 text-xs font-bold text-white disabled:opacity-50">{supportBusy ? 'Submitting...' : (language === 'hi' ? 'शिकायत दर्ज करें' : 'Submit Support Ticket')}</button>
            {supportMessage && <p className="break-words text-[11px] font-semibold text-slate-700">{supportMessage}</p>}
          </form>

          {/* Quick Role Switcher shortcut */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              {language === 'hi' ? 'भूमिका बदलें' : 'Switch Role View'}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveRole('customer');
                  onClose();
                }}
                className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold ${
                  activeRole === 'customer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {language === 'hi' ? 'ग्राहक' : 'Customer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRole('technician');
                  onClose();
                }}
                className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold ${
                  activeRole === 'technician' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {language === 'hi' ? 'पार्टनर' : 'Partner'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveRole('admin');
                  onClose();
                }}
                className={`py-2 px-1 text-center rounded-xl border text-xs font-semibold ${
                  activeRole === 'admin' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {language === 'hi' ? 'एडमिन' : 'Admin'}
              </button>
            </div>
          </div>

          {/* Logout Action */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'अकाउंट बदलें' : 'Switch Account'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex-1 py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'लॉग आउट' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
