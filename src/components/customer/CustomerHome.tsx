import React, { useState } from 'react';
import {
  Zap,
  Wrench,
  Search,
  MapPin,
  Star,
  ShieldCheck,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  Navigation,
  Shield,
  KeyRound,
  Briefcase,
  CalendarCheck,
  Wind,
  Snowflake,
  X,
  Compass,
  Music
} from 'lucide-react';
import { useQuickFix } from '../../context/QuickFixContext';
import { ServiceItem, ServiceCategoryType } from '../../types';
import { ServiceBookingSheet } from './ServiceBookingSheet';
import { LiveTrackingSheet } from './LiveTrackingSheet';
import { ReviewModal } from './ReviewModal';
import { CustomerAuthModal } from './CustomerAuthModal';
import { NearbyStoresModal } from './NearbyStoresModal';
import { INDIAN_CITIES } from '../../data/mockData';

export const CustomerHome: React.FC = () => {
  const {
    services,
    selectedCategory,
    setSelectedCategory,
    currentCity,
    setCurrentCity,
    customer,
    currentUser,
    isAuthenticated,
    setShowAuthModal,
    setShowProfileDrawer,
    bookings,
    activeBookingId,
    setActiveBookingId,
    setActiveRole
  } = useQuickFix();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceToBook, setSelectedServiceToBook] = useState<ServiceItem | null>(null);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showBookingsList, setShowBookingsList] = useState(false);
  const [showNearbyStores, setShowNearbyStores] = useState(false);

  // Active in-progress booking for quick access
  const activeBooking = bookings.find(b => b.id === activeBookingId) || bookings[0];

  const filteredServices = services.filter(service => {
    const matchesCat = selectedCategory === 'all' || service.category === selectedCategory;
    const matchesQuery =
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (service.hindiTitle && service.hindiTitle.includes(searchQuery));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Top Bar */}
      <header className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 z-20">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          {/* City Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Your City</div>
              <select
                value={currentCity}
                onChange={e => setCurrentCity(e.target.value)}
                className="font-bold text-slate-900 bg-transparent cursor-pointer focus:outline-none"
              >
                {INDIAN_CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* User Account Button */}
          <button
            onClick={() => {
              if (isAuthenticated) {
                setShowProfileDrawer(true);
              } else {
                setShowAuthModal(true);
              }
            }}
            className="flex items-center gap-2 py-1 px-2.5 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
              {(currentUser?.displayName || customer.name).charAt(0)}
            </div>
            <span className="hidden xs:inline max-w-[80px] truncate">
              {(currentUser?.displayName || customer.name).split(' ')[0]}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search AC gas refill, fridge cooling, fan, tap..."
            className="w-full text-xs pl-9 pr-4 py-2 rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </header>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active Booking Banner (if exists and not completed) */}
        {activeBooking && activeBooking.status !== 'completed' && activeBooking.status !== 'cancelled' && (
          <div
            onClick={() => setShowLiveTracking(true)}
            className="bg-blue-900 text-white rounded-2xl p-3.5 shadow-md border border-blue-800 cursor-pointer hover:bg-blue-950 transition-all flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-700/80 flex items-center justify-center text-white shrink-0">
                <Navigation className="w-5 h-5 text-blue-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
                    {activeBooking.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] bg-blue-800 text-blue-200 px-1.5 py-0.2 rounded font-mono">
                    OTP: {activeBooking.startOtp}
                  </span>
                </div>
                <h4 className="text-xs font-bold truncate max-w-[190px]">{activeBooking.serviceTitle}</h4>
                <p className="text-[11px] text-blue-200">{activeBooking.technicianName} is on the way</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-blue-300 shrink-0">
              <span>Track</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        )}

        {/* Hero Promo Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white p-4.5 shadow-md">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>India’s Most Trusted Home Services</span>
            </div>
            <h1 className="text-base font-extrabold tracking-tight leading-snug">
              Certified Electricians, Plumbers & AC/Fridge Technicians
            </h1>
            <p className="text-xs text-blue-100 max-w-xs">
              Transparent upfront rate cards, verified ID checks, 2000 INR technician guarantee & 30-day warranty.
            </p>
          </div>
        </div>

        {/* Real-World Places & Spare Parts Stores Locator Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-3.5 shadow-sm border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-300 shrink-0">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                <span>Google Maps Grounded</span>
              </div>
              <h3 className="text-xs font-bold text-white">Hardware & Spare Parts Stores</h3>
              <p className="text-[11px] text-slate-300">Locate real electrical & plumbing supply shops in {currentCity}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowNearbyStores(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shrink-0 transition-colors shadow-xs"
          >
            Find Places
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Services Catalog</h2>
            <span className="text-[11px] text-slate-500">{filteredServices.length} options available</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {/* All */}
            <button
              onClick={() => setSelectedCategory('all')}
              className={`p-2 rounded-xl border text-center transition-all flex items-center gap-2 ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedCategory === 'all' ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
                <span className="text-[10px] font-bold">ALL</span>
              </div>
              <div className="text-left overflow-hidden">
                <span className="text-xs block leading-tight truncate">All Services</span>
                <span className={`text-[9px] block ${selectedCategory === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>सभी सेवाएं</span>
              </div>
            </button>

            {/* Electrician */}
            <button
              onClick={() => setSelectedCategory('electrician')}
              className={`p-2 rounded-xl border text-center transition-all flex items-center gap-2 ${
                selectedCategory === 'electrician'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedCategory === 'electrician' ? 'bg-white/20 text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                <Zap className="w-3.5 h-3.5 fill-current" />
              </div>
              <div className="text-left overflow-hidden">
                <span className="text-xs block leading-tight truncate">Electrician</span>
                <span className={`text-[9px] block ${selectedCategory === 'electrician' ? 'text-blue-100' : 'text-slate-400'}`}>बिजली मिस्त्री</span>
              </div>
            </button>

            {/* Plumber */}
            <button
              onClick={() => setSelectedCategory('plumber')}
              className={`p-2 rounded-xl border text-center transition-all flex items-center gap-2 ${
                selectedCategory === 'plumber'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedCategory === 'plumber' ? 'bg-white/20 text-cyan-200' : 'bg-cyan-50 text-cyan-600'}`}>
                <Wrench className="w-3.5 h-3.5" />
              </div>
              <div className="text-left overflow-hidden">
                <span className="text-xs block leading-tight truncate">Plumber</span>
                <span className={`text-[9px] block ${selectedCategory === 'plumber' ? 'text-blue-100' : 'text-slate-400'}`}>नल व पाइप</span>
              </div>
            </button>

            {/* AC Repair */}
            <button
              onClick={() => setSelectedCategory('ac_repair')}
              className={`p-2 rounded-xl border text-center transition-all flex items-center gap-2 ${
                selectedCategory === 'ac_repair'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedCategory === 'ac_repair' ? 'bg-white/20 text-sky-200' : 'bg-sky-50 text-sky-600'}`}>
                <Wind className="w-3.5 h-3.5" />
              </div>
              <div className="text-left overflow-hidden">
                <span className="text-xs block leading-tight truncate">AC Repair</span>
                <span className={`text-[9px] block ${selectedCategory === 'ac_repair' ? 'text-blue-100' : 'text-slate-400'}`}>एसी सर्विस</span>
              </div>
            </button>

            {/* Fridge & Freezer */}
            <button
              onClick={() => setSelectedCategory('fridge_repair')}
              className={`p-2 rounded-xl border text-center transition-all flex items-center gap-2 ${
                selectedCategory === 'fridge_repair'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-bold'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 font-medium'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${selectedCategory === 'fridge_repair' ? 'bg-white/20 text-teal-200' : 'bg-teal-50 text-teal-600'}`}>
                <Snowflake className="w-3.5 h-3.5" />
              </div>
              <div className="text-left overflow-hidden">
                <span className="text-xs block leading-tight truncate">Fridge Repair</span>
                <span className={`text-[9px] block ${selectedCategory === 'fridge_repair' ? 'text-blue-100' : 'text-slate-400'}`}>फ्रिज व फ्रीजर</span>
              </div>
            </button>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          {filteredServices.map(service => (
            <div
              key={service.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      service.category === 'electrician'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-cyan-100 text-cyan-800'
                    }`}>
                      {service.category === 'electrician' ? <Zap className="w-3 h-3 fill-current" /> : <Wrench className="w-3 h-3" />}
                      <span>{service.category}</span>
                    </span>
                    {service.badge && (
                      <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                        {service.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{service.title}</h3>
                  {service.hindiTitle && (
                    <p className="text-[11px] text-slate-400 font-medium">{service.hindiTitle}</p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Starts At</div>
                  <div className="text-base font-extrabold text-blue-700 font-mono">₹{service.startingPrice}</div>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-600 leading-relaxed">{service.description}</p>

              {/* What's included preview */}
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Service Scope:</div>
                {service.included.slice(0, 2).map((inc, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-700">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>{inc}</span>
                  </div>
                ))}
              </div>

              {/* Meta & Book Action */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="flex items-center text-amber-500 font-semibold gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{service.rating}</span>
                  </div>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{service.durationMinutes}m</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedServiceToBook(service)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                >
                  <span>Book Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Access to Admin Console and Partner App */}
        <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">QuickFix Admin HQ & Operations</h4>
                <p className="text-[10px] text-slate-400">Customer, Booking Dispatch, KYC & Payment Console</p>
              </div>
            </div>
            <span className="text-[9px] bg-blue-900 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-700">
              Passcode: ADMIN2026
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveRole('admin')}
              className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20 transition-all text-[11px]"
            >
              <KeyRound className="w-3.5 h-3.5 text-blue-200" />
              <span>Admin Login / Dashboard</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('technician')}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-all text-[11px]"
            >
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <span>Technician Portal</span>
            </button>
          </div>
        </div>

        {/* QuickFix Trust Pillars */}
        <div className="bg-slate-100 rounded-2xl p-4 border border-slate-200 space-y-2.5">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">QuickFix Trust Guarantee</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block text-[11px]">KYC Verified</span>
                <span className="text-[10px] text-slate-500">Background checked technicians</span>
              </div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 block text-[11px]">Rate Card Clarity</span>
                <span className="text-[10px] text-slate-500">No surprise quote escalations</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Mobile In-App Bottom Navigation */}
      <nav className="sticky bottom-0 bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-around z-20 shadow-lg">
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-blue-600 font-bold"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px]">Explore</span>
        </button>

        <button
          type="button"
          onClick={() => setShowBookingsList(true)}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
        >
          <CalendarCheck className="w-4 h-4" />
          <span className="text-[10px]">Bookings ({bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveRole('technician')}
          className="flex flex-col items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
        >
          <Briefcase className="w-4 h-4" />
          <span className="text-[10px]">Partner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveRole('admin')}
          className="flex flex-col items-center gap-1 text-slate-700 hover:text-blue-600 transition-colors relative"
        >
          <span className="relative">
            <Shield className="w-4 h-4 text-blue-700" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5" />
          </span>
          <span className="text-[10px] font-bold text-blue-900">Admin HQ</span>
        </button>
      </nav>

      {/* Customer Bookings Drawer */}
      {showBookingsList && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Your Service Bookings</h3>
                <p className="text-[11px] text-slate-500">Live service tracking and payment records</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingsList(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-3">
              {bookings.map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setActiveBookingId(b.id);
                    setShowBookingsList(false);
                    setShowLiveTracking(true);
                  }}
                  className="bg-slate-50 hover:bg-blue-50/60 cursor-pointer p-3.5 rounded-2xl border border-slate-200 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">{b.serviceTitle}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {b.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Tech: {b.technicianName || 'Assigning soon...'}</span>
                    <span className="font-bold text-slate-800">₹{b.totalAmount} ({b.paymentStatus})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Booking Sheet Modal */}
      {selectedServiceToBook && (
        <ServiceBookingSheet
          service={selectedServiceToBook}
          onClose={() => setSelectedServiceToBook(null)}
          onSuccess={bookingId => {
            setSelectedServiceToBook(null);
            setActiveBookingId(bookingId);
            setShowLiveTracking(true);
          }}
        />
      )}

      {/* Live Tracking Overlay Modal */}
      {showLiveTracking && activeBooking && (
        <div className="fixed inset-0 z-40 bg-white flex flex-col">
          <LiveTrackingSheet
            booking={activeBooking}
            onBack={() => setShowLiveTracking(false)}
            onOpenReview={() => setShowReviewModal(true)}
          />
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && activeBooking && (
        <ReviewModal
          booking={activeBooking}
          onClose={() => setShowReviewModal(false)}
        />
      )}

      {/* Real-World Places: Hardware & Spare Parts Stores Modal */}
      {showNearbyStores && (
        <NearbyStoresModal onClose={() => setShowNearbyStores(false)} />
      )}
    </div>
  );
};
