import React, { useEffect, useMemo, useState } from 'react';
import { auth, isFirebaseConfigured } from '../../lib/firebase';

export const PartnerUpiQrCard: React.FC = () => {
  const [upiId, setUpiId] = useState('');
  const [savedUpiId, setSavedUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const paymentUri = useMemo(() => savedUpiId ? 'upi://pay?' + new URLSearchParams({ pa: savedUpiId, pn: payeeName || 'QuickFix Partner', cu: 'INR' }).toString() : '', [savedUpiId, payeeName]);
  const qrUrl = useMemo(() => paymentUri ? 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(paymentUri) : '', [paymentUri]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!isFirebaseConfigured || !user) throw new Error('Please sign in with your Channel Partner account.');
        const token = await user.getIdToken();
        const response = await fetch('/api/partners/payment-profile', { headers: { Authorization: 'Bearer ' + token } });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'UPI profile could not be loaded.');
        if (active) { setUpiId(result.upiId || ''); setSavedUpiId(result.upiId || ''); setPayeeName(result.payeeName || ''); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'UPI profile could not be loaded.'); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!isFirebaseConfigured || !user) throw new Error('Please sign in again.');
      const token = await user.getIdToken();
      const response = await fetch('/api/partners/payment-profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ upiId }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'UPI ID could not be saved.');
      setSavedUpiId(result.upiId); setUpiId(result.upiId); setPayeeName(result.payeeName || ''); setMessage('UPI ID saved. Your QR is ready to scan.');
    } catch (e) { setError(e instanceof Error ? e.message : 'UPI ID could not be saved.'); }
    finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm space-y-3">
    <div><h3 className="text-sm font-extrabold text-slate-900">Your Customer Payment QR</h3><p className="mt-1 text-xs text-slate-600">Apna UPI ID save karein. Customer is QR ko scan karke seedha aapke UPI app par payment kar sakta hai.</p></div>
    <label className="block text-xs font-bold text-slate-700">Your UPI ID</label>
    <div className="flex gap-2"><input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="example@bank" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><button type="button" disabled={saving || loading || !upiId.trim()} onClick={() => void save()} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save UPI'}</button></div>
    {loading && <p className="text-xs text-slate-500">Loading saved UPI ID…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    {message && <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p>}
    {savedUpiId && <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-3"><img src={qrUrl} alt="Channel Partner UPI payment QR code" width="220" height="220" className="h-56 w-56 rounded-lg bg-white p-2"/><p className="text-sm font-bold text-slate-900">{savedUpiId}</p><button type="button" onClick={async () => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(savedUpiId); setMessage('UPI ID copied.'); } catch { setError('Copy is unavailable on this device. Please copy the UPI ID manually.'); } }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Copy UPI ID</button></div>}
    <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">Important: QR payment customer ke UPI app mein initiate hota hai. QuickFix abhi is direct UPI payment ko automatically verify nahi karta. Payment milne ki pushti apne bank/UPI app mein khud karein; app booking ko paid mark nahi karega.</p>\n    <p className="text-[10px] leading-relaxed text-slate-500">Privacy note: QR image is currently generated by an external QR service. Your UPI ID and payee details are sent to that service to create the image. Do not use this QR for production payments until local QR generation replaces this service.</p>
  </section>;
};
