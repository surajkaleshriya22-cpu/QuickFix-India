import React, { useEffect, useState } from 'react';
import { AlertCircle, Send, ShieldCheck } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useQuickFix } from '../../context/QuickFixContext';

const categories = [
  ['non_payment', 'Payment not made / भुगतान नहीं मिला'],
  ['abuse_or_threat', 'Abuse or threat / गाली या धमकी'],
  ['harassment', 'Harassment / परेशान करना'],
  ['unsafe_conduct', 'Unsafe conduct / असुरक्षित व्यवहार'],
  ['overcharging', 'Unapproved extra charge / बिना अनुमति अतिरिक्त पैसा'],
  ['poor_service', 'Poor service / खराब सेवा'],
  ['property_damage', 'Property damage / सामान का नुकसान'],
  ['false_booking', 'False booking / फर्जी बुकिंग'],
  ['other', 'Other / अन्य']
] as const;

type ComplaintBooking = {
  id: string;
  serviceTitle: string;
  category?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  status: string;
};

export const CustomerComplaintPanel: React.FC = () => {
  const { currentUser } = useQuickFix();
  const [bookingId, setBookingId] = useState('');
  const [bookings, setBookings] = useState<ComplaintBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [category, setCategory] = useState<string>('non_payment');
  const [description, setDescription] = useState('');
  const [cases, setCases] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCases = async () => {
    const user = auth.currentUser;
    if (!user || currentUser?.uid !== user.uid) return;
    const token = await user.getIdToken();
    const response = await fetch('/api/complaints/mine', { headers: { Authorization: 'Bearer ' + token } });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Complaint history unavailable.');
    setCases(Array.isArray(result.complaints) ? result.complaints : []);
  };

  const loadBookings = async () => {
    const user = auth.currentUser;
    if (!user || currentUser?.uid !== user.uid) {
      setBookings([]);
      setBookingId('');
      return;
    }
    setBookingsLoading(true);
    try {
      const isPartner = currentUser?.role === 'technician' || currentUser?.role === 'channel_partner';
      const endpoint = isPartner ? '/api/partners/bookings/mine' : '/api/customer/bookings';
      const token = await user.getIdToken();
      const response = await fetch(endpoint, { headers: { Authorization: 'Bearer ' + token } });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Booking list unavailable.');
      const ownBookings = Array.isArray(result.bookings) ? result.bookings as ComplaintBooking[] : [];
      setBookings(ownBookings);
      setBookingId(previous => ownBookings.some(item => item.id === previous) ? previous : '');
    } catch (e) {
      setBookings([]);
      setBookingId('');
      setError(e instanceof Error ? e.message : 'बुकिंग सूची अभी उपलब्ध नहीं है।');
    } finally {
      setBookingsLoading(false);
    }
  };

  useEffect(() => {
    setError('');
    void loadBookings();
    void loadCases().catch(() => setError('शिकायत इतिहास अभी उपलब्ध नहीं है।'));
  }, [currentUser?.uid, currentUser?.role]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!user || currentUser?.uid !== user.uid) throw new Error('शिकायत दर्ज करने के लिए पहले Firebase OTP से लॉगिन करें।');
      if (!bookings.some(item => item.id === bookingId)) throw new Error('कृपया अपनी सूची से संबंधित बुकिंग चुनें।');
      const token = await user.getIdToken();
      const response = await fetch('/api/complaints', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, category, description: description.trim() })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'शिकायत दर्ज नहीं हो सकी।');
      setMessage('शिकायत दर्ज हो गई। Case ID: ' + result.complaintId);
      setBookingId(''); setDescription('');
      await loadCases();
    } catch (e) { setError(e instanceof Error ? e.message : 'शिकायत दर्ज नहीं हो सकी।'); }
    finally { setBusy(false); }
  };

  return <section className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
    <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-amber-600"/><div><h3 className="font-bold text-sm text-slate-900">Customer & Partner Safety / शिकायत सहायता</h3><p className="text-xs text-slate-500">Payment, abuse, harassment या service dispute की रिपोर्ट करें</p></div></div>
    <form onSubmit={submit} className="space-y-2">
      <label className="block text-xs font-semibold text-slate-700">अपनी बुकिंग चुनें / Select your booking</label>
      <select required value={bookingId} onChange={e=>setBookingId(e.target.value)} disabled={bookingsLoading || bookings.length===0} className="w-full border rounded-xl px-3 py-2 text-sm disabled:bg-slate-100">
        <option value="">{bookingsLoading ? 'बुकिंग लोड हो रही है…' : bookings.length ? 'बुकिंग चुनें' : 'आपकी कोई बुकिंग उपलब्ध नहीं है'}</option>
        {bookings.map(item=><option key={item.id} value={item.id}>{item.serviceTitle} · {item.scheduledDate || 'तारीख नहीं'} {item.scheduledTimeSlot || ''} · {item.status} · #{item.id.slice(0,8)}</option>)}
      </select>
      <label className="block text-xs font-semibold text-slate-700">Complaint type / शिकायत का कारण</label>
      <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">{categories.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      <label className="block text-xs font-semibold text-slate-700">Details / पूरी जानकारी (10–3000 अक्षर)</label>
      <textarea required minLength={10} maxLength={3000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="क्या हुआ, कब हुआ और किस तरह की मदद चाहिए?" className="w-full border rounded-xl px-3 py-2 text-sm"/>
      <button disabled={busy || bookingsLoading || !bookingId} className="w-full rounded-xl bg-blue-700 text-white py-2.5 text-sm font-bold disabled:opacity-50"><Send className="inline w-4 h-4 mr-1"/>{busy?'Submitting…':'Submit complaint / शिकायत दर्ज करें'}</button>
    </form>
    {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-xs text-red-600 flex gap-1"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</p>}
    <div className="border-t pt-3 space-y-2"><h4 className="font-bold text-xs text-slate-800">Your complaints / आपकी शिकायतें</h4>
      {cases.length===0 ? <p className="text-xs text-slate-500">अभी कोई शिकायत दर्ज नहीं है।</p> : cases.map(item=><div key={item.id} className="rounded-lg bg-slate-50 p-2 text-xs"><div className="flex justify-between gap-2"><b>#{item.id}</b><span className="font-semibold text-blue-700">{item.status}</span></div><p className="text-slate-600 mt-1">Booking: {item.bookingId} · {item.category}</p>{item.adminNote && <p className="mt-1">Admin note: {item.adminNote}</p>}</div>)}
    </div>
    <p className="text-[10px] text-slate-500">सिर्फ booking से जुड़े ग्राहक या Channel Partner ही शिकायत दर्ज कर सकते हैं। हर शिकायत की निष्पक्ष समीक्षा होगी; केवल शिकायत के आधार पर स्वतः दंड नहीं लगेगा।</p>
  </section>;
};
