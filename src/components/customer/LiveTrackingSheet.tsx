import React, { useState } from 'react';
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  ShieldCheck,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  FileText,
  Navigation,
  KeyRound,
  RotateCcw,
  Compass,
  Wrench
} from 'lucide-react';
import { Booking, BookingStatus } from '../../types';
import { useQuickFix } from '../../context/QuickFixContext';
import { TechnicianRouteMap } from '../maps/TechnicianRouteMap';
import { NearbyStoresModal } from './NearbyStoresModal';

interface LiveTrackingSheetProps {
  booking: Booking;
  onBack: () => void;
  onOpenReview: () => void;
}

export const LiveTrackingSheet: React.FC<LiveTrackingSheetProps> = ({ booking, onBack, onOpenReview }) => {
  const { updateBookingStatus } = useQuickFix();
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [showNearbyStores, setShowNearbyStores] = useState(false);
  const [liveRouteInfo, setLiveRouteInfo] = useState<{ distanceKm: number; durationMins: number } | null>(null);

  const cityBaseCoords: Record<string, { lat: number; lng: number }> = {
    Indore: { lat: 22.7196, lng: 75.8577 },
    Bhopal: { lat: 23.2599, lng: 77.4126 },
    Ujjain: { lat: 23.1765, lng: 75.7885 },
    Dewas: { lat: 22.9676, lng: 76.0534 },
  };

  const centerCoords = cityBaseCoords[booking.city] || cityBaseCoords['Indore'];
  // Technician simulated nearby position ~2-3 km away
  const technicianCoords = {
    lat: centerCoords.lat + 0.015,
    lng: centerCoords.lng - 0.012,
  };
  const customerCoords = {
    lat: centerCoords.lat - 0.008,
    lng: centerCoords.lng + 0.009,
  };

  const steps: { key: BookingStatus; label: string; desc: string }[] = [
    { key: 'requested', label: 'Booking Placed', desc: 'Order received and logged in dispatch system' },
    { key: 'assigned', label: 'Technician Assigned', desc: 'Verified professional designated for your area' },
    { key: 'technician_en_route', label: 'En Route', desc: `${booking.technicianName || 'Technician'} is riding to your location (${booking.technicianEtaMinutes || 15} mins)` },
    { key: 'in_progress', label: 'Service In Progress', desc: 'Job started with safety OTP verification' },
    { key: 'completed', label: 'Service Completed', desc: 'Quality checked & post-service warranty activated' }
  ];

  const getStepIndex = (status: BookingStatus) => {
    switch (status) {
      case 'requested': return 0;
      case 'assigned': return 1;
      case 'technician_en_route': return 2;
      case 'in_progress': return 3;
      case 'completed': return 4;
      default: return 0;
    }
  };

  const currentStepIdx = getStepIndex(booking.status);

  const handleCopyOtp = () => {
    navigator.clipboard.writeText(booking.startOtp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  const handleAdvanceSimulation = () => {
    const nextStates: Record<BookingStatus, BookingStatus> = {
      requested: 'assigned',
      assigned: 'technician_en_route',
      technician_en_route: 'in_progress',
      in_progress: 'completed',
      completed: 'completed',
      cancelled: 'requested'
    };
    const next = nextStates[booking.status];
    updateBookingStatus(booking.id, next, booking.startOtp);
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col min-h-0">
      {/* App Bar */}
      <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between z-20 shadow-xs">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Services</span>
        </button>
        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-500">Booking {booking.id}</span>
          <div className="text-xs font-bold text-blue-700 capitalize">
            {booking.status.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Real Interactive Google Maps Route & Live Tracking */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Navigation className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>Live Navigation Map ({booking.city})</span>
            </div>
            {liveRouteInfo ? (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {liveRouteInfo.distanceKm} km · ~{liveRouteInfo.durationMins} mins
              </span>
            ) : booking.status === 'technician_en_route' ? (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ETA ~{booking.technicianEtaMinutes || 12} mins
              </span>
            ) : null}
          </div>

          <TechnicianRouteMap
            originCoords={technicianCoords}
            destinationCoords={customerCoords}
            destinationAddress={booking.customerAddress}
            technicianName={booking.technicianName || 'Technician'}
            height="210px"
            onRouteCalculated={(dist, mins) => setLiveRouteInfo({ distanceKm: dist, durationMins: mins })}
          />

          {/* Quick link to Nearby Hardware & Spare Parts Stores */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-500" />
              <span className="text-slate-700 font-medium">Need replacement spares or tools?</span>
            </div>
            <button
              type="button"
              onClick={() => setShowNearbyStores(true)}
              className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 text-[11px]"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Find Nearby Stores</span>
            </button>
          </div>
        </div>

        {/* Safety Start OTP Card */}
        {booking.status !== 'completed' && booking.status !== 'cancelled' && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Job Start Security OTP</span>
              </div>
              <p className="text-[11px] text-slate-600">Share this code with the technician upon arrival to begin.</p>
            </div>
            <button
              onClick={handleCopyOtp}
              className="bg-white border-2 border-blue-600 px-3.5 py-1.5 rounded-xl font-mono text-base font-extrabold text-blue-800 tracking-widest shadow-xs hover:bg-blue-50 active:scale-95 transition-all"
            >
              {copiedOtp ? 'COPIED!' : booking.startOtp}
            </button>
          </div>
        )}

        {/* Assigned Technician Profile */}
        {booking.technicianName && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Assigned Professional</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-lg overflow-hidden">
                  {booking.technicianName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{booking.technicianName}</span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
                      {booking.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                    <div className="flex items-center text-amber-500 font-semibold gap-0.5">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>{booking.technicianRating || 4.9}</span>
                    </div>
                    <span>· Verified Partner</span>
                  </div>
                </div>
              </div>

              {/* Call & Chat shortcuts */}
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${booking.technicianPhone}`}
                  className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 flex items-center justify-center transition-colors shadow-xs"
                  title="Call Technician"
                >
                  <Phone className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => alert(`Messaging ${booking.technicianName}: "Technician is on the way with specialized tools."`)}
                  className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors"
                  title="Chat with Technician"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Timeline Stepper */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-900 mb-3 flex items-center justify-between">
            <span>Booking Progress</span>
            <span className="text-[11px] font-normal text-slate-500">Updated in real-time</span>
          </div>

          <div className="space-y-4">
            {steps.map((s, idx) => {
              const isPast = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              const isFuture = idx > currentStepIdx;

              return (
                <div key={s.key} className="flex items-start gap-3 relative">
                  {/* Vertical connector line */}
                  {idx < steps.length - 1 && (
                    <div
                      className={`absolute left-3.5 top-7 bottom-0 w-0.5 -mb-4 ${
                        isPast ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    />
                  )}

                  {/* Step icon dot */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 transition-colors ${
                      isPast
                        ? 'bg-blue-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isPast ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>

                  <div className="flex-1 pb-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isCurrent ? 'text-blue-900' : isPast ? 'text-slate-800' : 'text-slate-400'}`}>
                        {s.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Demo Fast-Forward Controller */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div className="text-xs text-slate-700">
            <span className="font-bold">Dispatch Simulator:</span>
            <span className="text-slate-500 block text-[11px]">Advance status to test workflow</span>
          </div>
          <button
            onClick={handleAdvanceSimulation}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <span>Next State</span>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Completed State: Review & Receipt Section */}
        {booking.status === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Service Successfully Completed!</span>
            </div>
            <p className="text-xs text-slate-700">
              Your 30-Day QuickFix rework guarantee is now active. If you encounter any issues, re-booking is free.
            </p>

            {booking.review ? (
              <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs">
                <div className="flex items-center gap-1 text-amber-500 font-bold mb-1">
                  {[...Array(booking.review.rating)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                  <span className="text-slate-700 ml-1">Your Review Submitted</span>
                </div>
                <p className="text-slate-600 italic">"{booking.review.comment}"</p>
              </div>
            ) : (
              <button
                onClick={onOpenReview}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Star className="w-4 h-4 fill-current" />
                <span>Rate & Review Technician</span>
              </button>
            )}
          </div>
        )}

        {/* Bill & Payment Receipt */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Invoice Details</span>
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              booking.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {booking.paymentStatus} via {booking.paymentMethod.toUpperCase()}
            </span>
          </div>

          <div className="text-xs space-y-1 pt-1 text-slate-600">
            <div className="flex justify-between">
              <span>{booking.serviceTitle}</span>
              <span className="font-mono">₹{booking.price}</span>
            </div>
            <div className="flex justify-between">
              <span>Visiting / Inspection Charge</span>
              <span className="font-mono">₹{booking.visitingCharges}</span>
            </div>
            {booking.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Promotional Discount</span>
                <span className="font-mono">-₹{booking.discount}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>GST (18%)</span>
              <span className="font-mono">₹{booking.taxes}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-slate-900 text-sm">
              <span>Total Paid</span>
              <span className="font-mono text-blue-700">₹{booking.totalAmount}</span>
            </div>
          </div>
        </div>
      </div>

      {showNearbyStores && (
        <NearbyStoresModal onClose={() => setShowNearbyStores(false)} />
      )}
    </div>
  );
};
