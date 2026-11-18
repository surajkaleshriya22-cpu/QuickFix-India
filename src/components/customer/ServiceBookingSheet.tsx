import React, { useState, useRef } from 'react';
import { X, Calendar, Clock, MapPin, CheckCircle2, Shield, IndianRupee, AlertCircle, ArrowRight, Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { ServiceItem, PaymentMethod } from '../../types';
import { useQuickFix } from '../../context/QuickFixContext';
import { PlaceAutocompleteInput } from '../maps/PlaceAutocompleteInput';
import { getIndiaBookingDate } from '../../utils/bookingDate';
import { auth } from '../../lib/firebase';
import { getBillingProfile } from '../../data/pricing';

interface ServiceBookingSheetProps {
  service: ServiceItem;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
}

export const ServiceBookingSheet: React.FC<ServiceBookingSheetProps> = ({ service, onClose, onSuccess }) => {
  const { customer, currentCity, commissionSettings, submitCustomerBooking } = useQuickFix();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stateName, setStateName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [tehsilName, setTehsilName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [rateQuote, setRateQuote] = useState<any>(null);
  const [quoteMessage, setQuoteMessage] = useState('');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  const dateOptions = [
    { label: 'Today', value: getIndiaBookingDate(0) },
    { label: 'Tomorrow', value: getIndiaBookingDate(1) },
    { label: 'Day After', value: getIndiaBookingDate(2) },
  ];
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [selectedSlot, setSelectedSlot] = useState('Express (Within 45 Mins)');
  const defaultCityAddress =
    customer.addresses.find(a => a.city.toLowerCase() === currentCity.toLowerCase())?.addressLine ||
    (currentCity === 'Indore' ? '102, Shrivardhan Complex, RNT Marg, Indore' :
     currentCity === 'Bhopal' ? 'E-3/42, Arera Colony, Near 10 No. Market, Bhopal' :
     currentCity === 'Ujjain' ? '45, Freeganj Main Road, Near Tower Chowk, Ujjain' :
     currentCity === 'Dewas' ? '12, Chamunda Complex, AB Road, Dewas' :
     customer.addresses[0]?.addressLine || `Main Road, ${currentCity}`);

  const [selectedAddress, setSelectedAddress] = useState(defaultCityAddress);
  const [customAddress, setCustomAddress] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [isTranscribingNote, setIsTranscribingNote] = useState(false);
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteAudioChunksRef = useRef<Blob[]>([]);

  const startNoteRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      noteAudioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      noteRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) noteAudioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(noteAudioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribingNote(true);

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1];
            const firebaseUser = auth.currentUser;
            if (!firebaseUser) {
              throw new Error('Please sign in again before using voice transcription.');
            }
            const idToken = await firebaseUser.getIdToken();
            const response = await fetch('/api/audio/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ audioBase64: base64Data, mimeType: 'audio/webm' }),
            });
            const data = await response.json();
            if (data.success && data.transcription) {
              setNotes((prev) => (prev ? `${prev} ${data.transcription}` : data.transcription));
            }
          } catch (err) {
            console.error('Note transcription error:', err);
          } finally {
            setIsTranscribingNote(false);
          }
        };
      };

      recorder.start();
      setIsRecordingNote(true);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('Microphone access required to record voice description.');
    }
  };

  const stopNoteRecording = () => {
    if (noteRecorderRef.current && isRecordingNote) {
      noteRecorderRef.current.stop();
      setIsRecordingNote(false);
    }
  };

  // The legacy amount is only an indicative starting figure until a verified local rate card is connected.
  const billingProfile = getBillingProfile(service);
  const basePrice = rateQuote?.quote?.totalMinimum ?? null;
  const quoteMaximum = rateQuote?.quote?.totalMaximum ?? null;
  const totalAmount = basePrice === null ? null : basePrice;

  const slotOptions = [
    'Express (Within 45 Mins)',
    '09:00 AM - 12:00 PM',
    '12:00 PM - 03:00 PM',
    '03:00 PM - 06:00 PM',
    '06:00 PM - 09:00 PM'
  ];


  const fetchRateQuote = async () => {
    const qty = Number(quantity);
    if (!stateName.trim() || !districtName.trim() || !tehsilName.trim() || !Number.isFinite(qty) || qty <= 0) {
      setQuoteMessage('Rate dekhne ke liye State, District, Tehsil aur sahi quantity bharein.');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setQuoteMessage('Rate dekhne ke liye customer account se sign in karein.');
      return;
    }
    setIsLoadingQuote(true);
    setRateQuote(null);
    setQuoteMessage('');
    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams({
        state: stateName.trim(), district: districtName.trim(), city: currentCity,
        tehsil: tehsilName.trim(), serviceCategory: service.category,
        serviceId: service.id, unit: billingProfile.unit, date: selectedDate,
        quantity: String(qty)
      });
      const response = await fetch(`/api/rates/quote?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setQuoteMessage(data.error || 'Is location ke liye approved rate abhi uplabdh nahi hai.');
        return;
      }
      setRateQuote(data);
      setQuoteMessage('Yeh approved local rate card ke hisaab se estimate hai. Final amount kaam shuru hone se pehle confirm hoga.');
    } catch {
      setQuoteMessage('Rate service abhi available nahi hai. Aap inspection/quotation booking bhej sakte hain.');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (!stateName.trim() || !districtName.trim() || !tehsilName.trim() || Number(quantity) <= 0) {
      window.alert('Booking ke liye State, District, Tehsil aur quantity bharein.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitCustomerBooking({
        serviceId: service.id,
        scheduledDate: selectedDate,
        scheduledTimeSlot: selectedSlot,
        address: selectedAddress,
        notes,
        paymentMethod,
        serviceArea: { state: stateName.trim(), district: districtName.trim(), tehsil: tehsilName.trim() },
        quantity: Number(quantity)
      });
      if (!result.success || !result.bookingId) {
        window.alert(result.message || 'Booking request save nahi ho payi. Please retry.');
        return;
      }
      window.alert(`Booking request successfully save ho gayi. Request ID: ${result.bookingId}. Abhi koi payment collect nahi hui hai; payment status pending rahega.`);
      onSuccess(result.bookingId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Book Service</span>
            <h2 className="text-base font-bold text-slate-900 leading-tight">{service.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Service Guarantee Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
            <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-blue-900">QuickFix {service.warrantyDays}-Day Warranty:</span> Verified technicians equipped with professional tools. Any rework within warranty is 100% free.
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" /> Select Day
            </label>
            <div className="grid grid-cols-3 gap-2">
              {dateOptions.map(day => (
                <button
                  key={day.label}
                  type="button"
                  onClick={() => setSelectedDate(day.value)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    selectedDate === day.value
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slot Selection */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" /> Preferred Arrival Slot
            </label>
            <div className="space-y-1.5">
              {slotOptions.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  className={`w-full text-left px-3.5 py-2.5 text-xs font-medium rounded-xl border transition-all flex items-center justify-between ${
                    selectedSlot === slot
                      ? 'bg-blue-50/80 text-blue-900 border-blue-500 font-semibold'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{slot}</span>
                  {selectedSlot === slot && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Service Location with Google Places Autocomplete */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" /> Service Location ({currentCity})
              </label>
              <button
                type="button"
                onClick={() => setIsEditingAddress(!isEditingAddress)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {isEditingAddress ? 'Use Saved' : '+ Search on Map'}
              </button>
            </div>

            {isEditingAddress ? (
              <div className="space-y-1">
                <PlaceAutocompleteInput
                  initialValue={customAddress || selectedAddress}
                  cityBias={currentCity}
                  placeholder={`Search locality, building, colony in ${currentCity}...`}
                  onAddressSelect={(addr) => {
                    setCustomAddress(addr);
                    setSelectedAddress(addr);
                  }}
                />
                <span className="text-[10px] text-slate-400 block px-1">
                  Powered by Google Places API · Tap mic to speak address
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{selectedAddress}</span>
              </div>
            )}
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs font-semibold text-slate-700">State
              <input value={stateName} onChange={e => { setStateName(e.target.value); setRateQuote(null); }} placeholder="e.g. Madhya Pradesh" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">District
              <input value={districtName} onChange={e => { setDistrictName(e.target.value); setRateQuote(null); }} placeholder="e.g. Indore" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Tehsil
              <input value={tehsilName} onChange={e => { setTehsilName(e.target.value); setRateQuote(null); }} placeholder="e.g. Rau" className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">{billingProfile.quantityPrompt} / {billingProfile.hindiQuantityPrompt}
              <input type="number" min="0.01" step="0.01" value={quantity} onChange={e => { setQuantity(e.target.value); setRateQuote(null); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
            </label>
            <button type="button" onClick={fetchRateQuote} disabled={isLoadingQuote} className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {isLoadingQuote ? 'Checking approved rate...' : 'Check approved local rate'}
            </button>
            {quoteMessage && <p className="text-xs text-slate-600">{quoteMessage}</p>}
          </div>

          {/* Problem Notes with Gemini 3.5 Transcribe Voice Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Describe Issue (Voice or Text)
              </label>
              <button
                type="button"
                onClick={isRecordingNote ? stopNoteRecording : startNoteRecording}
                disabled={isTranscribingNote}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                  isRecordingNote
                    ? 'bg-rose-500 text-white animate-pulse'
                    : isTranscribingNote
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                {isTranscribingNote ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Transcribing audio...</span>
                  </>
                ) : isRecordingNote ? (
                  <>
                    <MicOff className="w-3 h-3" />
                    <span>Stop & Transcribe</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3 h-3 text-blue-600" />
                    <span>Speak Issue</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Fan making clicking sound, AC gas refill needed, tap leaking"
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
              <IndianRupee className="w-3.5 h-3.5 text-blue-600" /> Payment Option
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>UPI Instant</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Fast</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal">GPay, PhonePe, Paytm, BHIM</p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="text-xs font-bold">Cash After Service</div>
                <p className="text-[11px] text-slate-500 mt-0.5 font-normal">Pay directly once satisfied</p>
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-900 leading-relaxed">
                UPI collection and escrow are not active yet. QuickFix will not collect or mark any payment as paid until a verified payment gateway is connected.
              </p>
            </div>
          </div>

          {/* Server-approved local quote; no mock starting price is presented as payable. */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Local Price Estimate</div>
            <div className="text-[11px] text-slate-600">Billing basis: {billingProfile.label} ({billingProfile.hindiLabel}) · {billingProfile.note}</div>
            {rateQuote ? (
              <>
                <div className="flex justify-between text-sm"><span>Approved rate range</span><strong>₹{rateQuote.quote.totalMinimum} – ₹{rateQuote.quote.totalMaximum}</strong></div>
                <div className="text-[10px] text-slate-500">Source: {rateQuote.source.name}. Materials {rateQuote.quote.materialsIncluded ? 'included' : 'extra'}. Estimate only; customer approval is required before work starts.</div>
              </>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Is location/service ke liye approved rate card nahi mila to booking inspection/quotation request ke roop mein jayegi. Abhi koi final price ya payment collect nahi hogi.
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] text-slate-500 block">Total Amount</span>
            <span className="text-lg font-extrabold text-blue-700 font-mono">{totalAmount === null ? 'Quote after inspection' : `₹${totalAmount}${quoteMaximum !== basePrice ? ` – ₹${quoteMaximum}` : ''}`}</span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving Request...</> : <span>Confirm Service Request</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
