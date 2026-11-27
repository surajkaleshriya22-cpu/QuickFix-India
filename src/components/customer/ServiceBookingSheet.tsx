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
  const { customer, currentCity, services, commissionSettings, submitCustomerBooking } = useQuickFix();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stateName, setStateName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [tehsilName, setTehsilName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [basketLines, setBasketLines] = useState<{ serviceId: string; quantity: string }[]>([{ serviceId: service.id, quantity: '1' }]);
  const [additionalServiceId, setAdditionalServiceId] = useState('');
  const [rateQuote, setRateQuote] = useState<any>(null);
  const [priceAccepted, setPriceAccepted] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState('');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [customerLocation, setCustomerLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState('');

  const dateOptions = [
    { label: 'Today', value: getIndiaBookingDate(0) },
    { label: 'Tomorrow', value: getIndiaBookingDate(1) },
    { label: 'Day After', value: getIndiaBookingDate(2) },
  ];
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].value);
  const [selectedSlot, setSelectedSlot] = useState('Express (Within 45 Mins)');
  // Never invent a customer's service address. Only reuse an explicitly saved
  // address for the selected city; otherwise require a real address selection.
  const savedCityAddress =
    customer.addresses.find(a =>
      a.city.trim().toLowerCase() === currentCity.trim().toLowerCase() &&
      typeof a.addressLine === 'string' && a.addressLine.trim().length > 0
    )?.addressLine.trim() || '';

  const [selectedAddress, setSelectedAddress] = useState(savedCityAddress);
  const [customAddress, setCustomAddress] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(!savedCityAddress);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [isTranscribingNote, setIsTranscribingNote] = useState(false);
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteAudioChunksRef = useRef<Blob[]>([]);

  const captureCustomerLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('इस browser में GPS उपलब्ध नहीं है। कृपया GPS वाला फोन/browser इस्तेमाल करें।');
      return;
    }
    setLocationStatus('आपकी GPS लोकेशन ली जा रही है…');
    navigator.geolocation.getCurrentPosition(
      position => {
        setCustomerLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationStatus('GPS लोकेशन मिल गई। अब सही service area के Channel Partners को request भेजी जा सकेगी।');
      },
      error => {
        setCustomerLocation(null);
        setLocationStatus(error.code === error.PERMISSION_DENIED
          ? 'GPS अनुमति नहीं मिली। Request भेजने के लिए location permission चालू करें।'
          : 'GPS लोकेशन नहीं मिली। फोन का Location चालू करके फिर कोशिश करें।');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

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
  const basketServices = basketLines.map(line => ({ ...line, service: services.find(item => item.id === line.serviceId) })).filter(line => line.service);
  const addBasketLine = () => {
    if (!additionalServiceId || basketLines.length >= 20) return;
    setBasketLines(current => [...current, { serviceId: additionalServiceId, quantity: '1' }]);
    setAdditionalServiceId('');
    setRateQuote(null);
    setPriceAccepted(false);
    setQuoteMessage('');
  };
  const updateBasketQuantity = (index: number, value: string) => {
    setBasketLines(current => current.map((line, i) => i === index ? { ...line, quantity: value } : line));
    setRateQuote(null);
    setPriceAccepted(false);
  };
  const removeBasketLine = (index: number) => {
    setBasketLines(current => current.filter((_, i) => i !== index));
    setRateQuote(null);
  };
  const basePrice = rateQuote?.allPriced ? rateQuote.totalMinimum : null;
  const quoteMaximum = rateQuote?.allPriced ? rateQuote.totalMaximum : null;
  const totalAmount = basePrice === null ? null : basePrice;

  const slotOptions = [
    'Express (Within 45 Mins)',
    '09:00 AM - 12:00 PM',
    '12:00 PM - 03:00 PM',
    '03:00 PM - 06:00 PM',
    '06:00 PM - 09:00 PM'
  ];


  const fetchRateQuote = async () => {
    if (!stateName.trim() || !districtName.trim() || !tehsilName.trim() || basketServices.length !== basketLines.length) {
      setQuoteMessage('Total calculate karne ke liye State, District, Tehsil aur har work item select karein.');
      return;
    }
    if (basketLines.some(line => !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || Number(line.quantity) > 100000)) {
      setQuoteMessage('Har item ki quantity 0 se zyada aur valid honi chahiye.');
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
      const results = await Promise.all(basketServices.map(async line => {
        const billing = getBillingProfile(line.service!);
        const params = new URLSearchParams({
          state: stateName.trim(), district: districtName.trim(), city: currentCity,
          tehsil: tehsilName.trim(), serviceCategory: line.service!.category,
          serviceId: line.serviceId, unit: billing.unit, date: selectedDate,
          quantity: String(Number(line.quantity))
        });
        const response = await fetch(`/api/rates/quote?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          return { serviceId: line.serviceId, title: line.service!.title, quantity: Number(line.quantity), unit: billing.unit, priced: false, error: data.error || 'Rate not published' };
        }
        return {
          serviceId: line.serviceId, title: line.service!.title, quantity: Number(line.quantity), unit: billing.unit,
          priced: true, minimum: data.quote.totalMinimum, maximum: data.quote.totalMaximum,
          materialsIncluded: data.quote.materialsIncluded, source: data.source?.name || 'Published local rate',
          unitRateMinimum: data.quote.rateMinimum, unitRateMaximum: data.quote.rateMaximum,
          baseFee: data.quote.baseFee, minimumCharge: data.quote.minimumCharge,
          appliedAdjustmentPercent: data.quote.appliedAdjustmentPercent
        };
      }));
      const allPriced = results.every(line => line.priced);
      const totalMinimum = results.reduce((sum, line) => sum + (line.priced ? line.minimum : 0), 0);
      const totalMaximum = results.reduce((sum, line) => sum + (line.priced ? line.maximum : 0), 0);
      setRateQuote({ lines: results, allPriced, totalMinimum, totalMaximum });
      setPriceAccepted(false);
      setQuoteMessage(allPriced
        ? 'Har item ka rate published local rate card se calculate hua hai.'
        : 'Kuch items ka published rate nahi mila. Unka estimate inspection ke baad milega; abhi payment nahi hogi.');
    } catch {
      setQuoteMessage('Rate service abhi available nahi hai. Aap inspection/quotation booking bhej sakte hain.');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const openRazorpayCheckout = async (bookingId: string, selectedMethod: 'upi' | 'card' | 'netbanking'): Promise<{ paid: boolean; message: string }> => {
    const user = auth.currentUser;
    if (!user) return { paid: false, message: 'Please sign in again before payment.' };
    const token = await user.getIdToken();
    const orderResponse = await fetch('/api/payments/razorpay/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingId })
    });
    const order = await orderResponse.json().catch(() => ({}));
    if (!orderResponse.ok || !order.success || !order.orderId || !order.keyId) {
      return { paid: false, message: order.error || 'Online payment is not available right now. Your booking remains unpaid.' };
    }

    const RazorpayCheckout = (window as any).Razorpay;
    if (!RazorpayCheckout) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector('script[data-quickfix-razorpay="true"]') as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not load.')), { once: true });
          if ((window as any).Razorpay) resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.dataset.quickfixRazorpay = 'true';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Razorpay checkout could not load.'));
        document.body.appendChild(script);
      });
    }
    const Checkout = (window as any).Razorpay;
    if (!Checkout) return { paid: false, message: 'Secure payment window could not be opened.' };

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: { paid: boolean; message: string }) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const checkout = new Checkout({
        key: order.keyId,
        amount: order.amount,
        currency: 'INR',
        name: 'QuickFix India',
        description: `Service booking ${bookingId}`,
        order_id: order.orderId,
        method: { upi: selectedMethod === 'upi', card: selectedMethod === 'card', netbanking: selectedMethod === 'netbanking', wallet: false },
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                bookingId,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature
              })
            });
            const verification = await verifyResponse.json().catch(() => ({}));
            if (!verifyResponse.ok || !verification.success || verification.paymentStatus !== 'paid') {
              finish({ paid: false, message: verification.error || 'Payment could not be verified. Do not retry until your bank/payment app confirms the result.' });
              return;
            }
            finish({ paid: true, message: `${selectedMethod.toUpperCase()} payment verified successfully.` });
          } catch {
            finish({ paid: false, message: 'Payment verification is temporarily unavailable. Your payment status will remain unconfirmed until the server verifies it.' });
          }
        },
        modal: { ondismiss: () => finish({ paid: false, message: 'Payment window closed. Your booking is saved and remains unpaid until verification.' }) },
        theme: { color: '#2563eb' }
      });
      checkout.on('payment.failed', (event: any) => {
        finish({ paid: false, message: event?.error?.description || 'UPI payment failed. Your booking remains unpaid.' });
      });
      checkout.open();
    });
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (!rateQuote || !rateQuote.allPriced) {
      window.alert('Pehle har item ka approved local rate calculate karein. Jis item ka rate available nahi hai, uski normal booking abhi nahi hogi.');
      return;
    }
    if (!priceAccepted) {
      window.alert('Booking se pehle poori price range, billing unit aur materials/extra charges ki shartein padhkar sahmati dein.');
      return;
    }
    if (!stateName.trim() || !districtName.trim() || !tehsilName.trim() || basketServices.length === 0 || basketServices.some(line => !Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0)) {
      window.alert('Booking ke liye State, District, Tehsil aur quantity bharein.');
      return;
    }
    if (!customerLocation) {
      window.alert('सही Channel Partner खोजने के लिए पहले अपनी वर्तमान GPS लोकेशन साझा करें।');
      captureCustomerLocation();
      return;
    }
    if (!selectedAddress.trim()) {
      window.alert('Booking se pehle map se apna poora service address select karein.');
      setIsEditingAddress(true);
      return;
    }
    setIsSubmitting(true);
    try {
      let bookingId = pendingBookingId;
      if (!bookingId) {
        const result = await submitCustomerBooking({
          serviceId: service.id,
          scheduledDate: selectedDate,
          scheduledTimeSlot: selectedSlot,
          address: selectedAddress,
          notes,
          paymentMethod,
          serviceArea: { state: stateName.trim(), district: districtName.trim(), tehsil: tehsilName.trim() },
          quantity: Number(basketLines[0]?.quantity || 1),
          lineItems: basketServices.map(line => ({ serviceId: line.serviceId, quantity: Number(line.quantity) })),
          customerLocation
        });
        if (!result.success || !result.bookingId) {
          window.alert(result.message || 'Booking request save nahi ho payi. Please retry.');
          return;
        }
        bookingId = result.bookingId;
        setPendingBookingId(bookingId);
      }

      if (paymentMethod === 'upi' || paymentMethod === 'card' || paymentMethod === 'netbanking') {
        setPaymentMessage(`Secure ${paymentMethod.toUpperCase()} checkout khol rahe hain…`);
        const payment = await openRazorpayCheckout(bookingId, paymentMethod);
        setPaymentMessage(payment.message);
        if (!payment.paid) {
          window.alert(`${payment.message} Booking ID: ${bookingId}`);
          return;
        }
        window.alert(`Payment verified. QuickFix booking confirmed. Booking ID: ${bookingId}`);
      } else {
        window.alert(`Booking request successfully save ho gayi. Request ID: ${bookingId}. Payment service ke baad cash mein hogi.`);
      }
      onSuccess(bookingId);
    } catch (error: any) {
      const message = error?.message || 'Secure checkout could not be opened.';
      setPaymentMessage(message);
      window.alert(`${message} Booking unpaid rahegi. Koi successful payment tabhi mani jayegi jab server verify kare. ${pendingBookingId ? `Booking ID: ${pendingBookingId}` : ''}`);
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
                  onClick={() => { setSelectedDate(day.value); setRateQuote(null); setPriceAccepted(false); }}
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
                onClick={() => {
                if (isEditingAddress && savedCityAddress) setSelectedAddress(savedCityAddress);
                setIsEditingAddress(!isEditingAddress);
              }}
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
                    setCustomerLocation(null);
                    setLocationStatus('Service address changed. Please capture GPS again so the partner is matched to the correct place.');
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
          <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2">
            <button type="button" onClick={captureCustomerLocation}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
              <MapPin className="inline w-3.5 h-3.5 mr-1" /> Use my current GPS location
            </button>
            <p className="text-[11px] text-blue-900">{locationStatus || (customerLocation ? 'GPS location saved for this booking.' : 'GPS is used only to match nearby Channel Partners within the service radius.')}</p>
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
          <div className="rounded-xl border border-slate-200 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Work items / Kaam ki list</h3>
              <span className="text-xs text-slate-500">{basketLines.length}/20</span>
            </div>
            {basketServices.map((line, index) => (
              <div key={line.serviceId + '-' + index} className="grid grid-cols-[1fr_92px_32px] gap-2 items-end">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{line.service?.title}</p>
                  <p className="text-[10px] text-slate-500">{getBillingProfile(line.service!).quantityPrompt}</p>
                </div>
                <label className="text-[10px] text-slate-600">Quantity
                  <input type="number" min="0.01" step="0.01" value={line.quantity} onChange={e => updateBasketQuantity(index, e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
                </label>
                <button type="button" aria-label="Remove work item" onClick={() => removeBasketLine(index)} disabled={basketLines.length === 1} className="h-9 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30">×</button>
              </div>
            ))}
            <div className="flex gap-2">
              <select value={additionalServiceId} onChange={e => setAdditionalServiceId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 p-2 text-xs">
                <option value="">Add another service…</option>
                {services.filter(item => !basketLines.some(line => line.serviceId === item.id)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <button type="button" onClick={addBasketLine} disabled={!additionalServiceId || basketLines.length >= 20} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">+ Add</button>
            </div>
            <p className="text-xs text-slate-600">Har kaam ka rate Admin ke published local rate card se server calculate karega. Jis kaam ka rate available nahi hoga, uske liye inspection/quotation lagega. Customer ke liye koi rate approval request nahi.</p>
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
              {([
                { value: 'upi' as const, title: 'UPI', detail: 'GPay, PhonePe, Paytm, BHIM' },
                { value: 'card' as const, title: 'Debit / Credit Card', detail: 'Visa, Mastercard, RuPay' },
                { value: 'netbanking' as const, title: 'Net Banking', detail: 'Supported banks' },
                { value: 'cash' as const, title: 'Cash After Service', detail: 'Pay directly once satisfied' }
              ]).map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaymentMethod(option.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === option.value
                      ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="text-xs font-bold">{option.title}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-normal">{option.detail}</p>
                </button>
              ))}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-900 leading-relaxed">
                UPI payment opens through Razorpay Test Mode when the server is configured. QuickFix marks payment paid only after server-side signature and gateway verification. Gateway payment is not escrow or partner payout.
              </p>
            </div>
            {paymentMessage && <p className="text-xs text-slate-700" role="status">{paymentMessage}</p>}
          </div>

          {/* Server-approved local quote; no mock starting price is presented as payable. */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Local Price Estimate</div>
            <div className="text-[11px] text-slate-600">Billing basis: {billingProfile.label} ({billingProfile.hindiLabel}) · {billingProfile.note}</div>
            <button type="button" onClick={fetchRateQuote} disabled={isLoadingQuote} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {isLoadingQuote ? 'Calculating total…' : 'Calculate item-wise total'}
            </button>
            {quoteMessage && <p className="text-[11px] text-slate-600" role="status">{quoteMessage}</p>}
            {rateQuote ? (
              <>
                {rateQuote.lines.map((line: any) => (
                  <div key={line.serviceId} className="flex items-start justify-between gap-3 border-t border-slate-200 pt-2 text-xs">
                    <div><strong>{line.title}</strong><div className="text-[10px] text-slate-500">Qty {line.quantity} · {line.unit}</div>
                      {line.priced && <div className="text-[10px] text-slate-500">Rate ₹{line.unitRateMinimum}–₹{line.unitRateMaximum}/{line.unit}{line.baseFee > 0 ? ` · Base fee ₹${line.baseFee}` : ''}{line.minimumCharge > 0 ? ` · Minimum charge ₹${line.minimumCharge}` : ''}</div>}
                      {line.priced && <div className="text-[10px] text-slate-500">Materials: {line.materialsIncluded ? 'included' : 'not included; extra only with your approval'} · Source: {line.source}</div>}
                      {!line.priced && <div className="text-[10px] text-amber-700">Inspection / quote required</div>}
                    </div>
                    <strong className="shrink-0">{line.priced ? `₹${line.minimum} – ₹${line.maximum}` : 'After inspection'}</strong>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold">
                  <span>{rateQuote.allPriced ? 'Estimated total' : 'Priced items subtotal'}</span>
                  <strong>₹{rateQuote.totalMinimum} – ₹{rateQuote.totalMaximum}</strong>
                </div>
                <div className="text-[10px] text-slate-600">Rates are from approved local rate cards. This is an estimate range, not permission for unlisted work. Materials/parts and extra work are chargeable only after a separate itemised quote and your approval.</div>
                {rateQuote.allPriced && <label className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950"><input type="checkbox" checked={priceAccepted} onChange={e => setPriceAccepted(e.target.checked)} className="mt-0.5" /><span><strong>I have reviewed the price.</strong> I understand the item-wise rates, quantity, minimum charge, total estimate range and material exclusions. No extra work or extra charge may be added without my approval.</span></label>}
              </>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Published rate cards se total calculate karein. Har item ka approved rate milna zaroori hai. Rate unavailable ho to pehle alag itemised quotation banega; bina rate dekhe normal order confirm nahi hoga.
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
            disabled={isSubmitting || !rateQuote?.allPriced || !priceAccepted}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <span>{pendingBookingId && paymentMethod === 'upi' ? 'Retry UPI Payment' : paymentMethod === 'upi' ? 'Book & Pay by UPI' : 'Confirm Service Request'}</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
