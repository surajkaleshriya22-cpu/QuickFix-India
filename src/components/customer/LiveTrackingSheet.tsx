import React, { useState } from 'react';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Star,
  CheckCircle,
  FileText,
  Compass,
  Wrench
} from 'lucide-react';
import { Booking, BookingStatus } from '../../types';
import { NearbyStoresModal } from './NearbyStoresModal';

interface LiveTrackingSheetProps {
  booking: Booking;
  onBack: () => void;
  onOpenReview: () => void;
}

export const LiveTrackingSheet: React.FC<LiveTrackingSheetProps> = ({ booking, onBack, onOpenReview }) => {
  const [showNearbyStores, setShowNearbyStores] = useState(false);

  const steps: { key: BookingStatus; label: string; desc: string }[] = [
    { key: 'requested', label: 'Booking Placed', desc: 'Order received and logged in dispatch system' },
    { key: 'assigned', label: 'Technician Assigned', desc: 'Verified professional designated for your area' },
    { key: 'technician_en_route', label: 'En Route', desc: 'Partner travel updates will appear after secure live location sharing is connected.' },
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
        {/* Do not display fabricated partner/customer coordinates as live tracking. */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <MapPin className="h-4 w-4" />
            <span>Live location sharing is not active</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-900">
            This booking view does not yet receive verified GPS updates from the assigned Channel Partner.
            No moving marker, route, or arrival time is shown until both sides enable secure location sharing.
          </p>
          <div className="rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-700">
            **Service address:** {booking.customerAddress || 'Not provided'}
          </div>
        </div>

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
                      <span>{booking.technicianRating}</span>
                    </div>
                    <span>· Partner profile</span>
                  </div>
                </div>
              </div>

              {/* Call & Chat shortcuts */}
              <div className="flex items-center gap-2">
                {booking.technicianPhone ? <a
                  href={`tel:${booking.technicianPhone}`}
                  className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 flex items-center justify-center transition-colors shadow-xs"
                  title="Call Technician"
                >
                  <Phone className="w-4 h-4" />
                </a> : null}
              </div>
            </div>
          </div>
        )}

        {/* Live Timeline Stepper */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-900 mb-3 flex items-center justify-between">
            <span>Booking Progress</span>
            <span className="text-[11px] font-normal text-slate-500">Latest booking record</span>
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

        {/* Completed State: Review & Receipt Section */}
        {booking.status === 'completed' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Service Successfully Completed!</span>
            </div>
            <p className="text-xs text-slate-700">
              The booking is marked completed. Please contact QuickFix support if you need help with this service.
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
