import React, { useState, useRef } from 'react';
import { X, Calendar, Clock, MapPin, CheckCircle2, Shield, IndianRupee, AlertCircle, ArrowRight, Mic, MicOff, Loader2, Sparkles } from 'lucide-react';
import { ServiceItem, PaymentMethod } from '../../types';
import { useQuickFix } from '../../context/QuickFixContext';
import { PlaceAutocompleteInput } from '../maps/PlaceAutocompleteInput';

interface ServiceBookingSheetProps {
  service: ServiceItem;
  onClose: () => void;
  onSuccess: (bookingId: string) => void;
}

export const ServiceBookingSheet: React.FC<ServiceBookingSheetProps> = ({ service, onClose }) => {
  const { customer, currentCity, commissionSettings } = useQuickFix();

  const [selectedDate, setSelectedDate] = useState('Today');
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
            const response = await fetch('/api/audio/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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

  // Price calculations
  const basePrice = service.startingPrice;
  const visitFee = commissionSettings.platformConvenienceFee;
  const discount = 20; // First-time discount
  const taxable = basePrice + visitFee - discount;
  const taxes = Math.round((taxable * commissionSettings.gstPct) / 100);
  const totalAmount = taxable + taxes;

  const dateOptions = ['Today', 'Tomorrow', 'Day After'];
  const slotOptions = [
    'Express (Within 45 Mins)',
    '09:00 AM - 12:00 PM',
    '12:00 PM - 03:00 PM',
    '03:00 PM - 06:00 PM',
    '06:00 PM - 09:00 PM'
  ];

  // Do not simulate a successful booking before the trusted backend exists.
  const handleConfirm = () => {
    window.alert(`Online booking is temporarily unavailable while QuickFix completes secure booking setup. Your selected payment option is ${paymentMethod.toUpperCase()}. No booking has been created and no payment has been taken. Please try again later.`);
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
                  key={day}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border text-center transition-all ${
                    selectedDate === day
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {day}
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

          {/* Bill Summary */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Price Breakdown</div>
            
            <div className="flex justify-between text-xs text-slate-600">
              <span>Item Inspection / Standard Rate</span>
              <span className="font-mono">₹{basePrice}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>QuickFix Visiting Fee</span>
              <span className="font-mono">₹{visitFee}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Welcome Discount</span>
              <span className="font-mono">-₹{discount}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>GST ({commissionSettings.gstPct}%)</span>
              <span className="font-mono">₹{taxes}</span>
            </div>
            
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>Total Payable</span>
              <span className="font-mono text-blue-700 text-base">₹{totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] text-slate-500 block">Total Amount</span>
            <span className="text-lg font-extrabold text-blue-700 font-mono">₹{totalAmount}</span>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <span>Booking Temporarily Unavailable</span>
          </button>
        </div>
      </div>
    </div>
  );
};
