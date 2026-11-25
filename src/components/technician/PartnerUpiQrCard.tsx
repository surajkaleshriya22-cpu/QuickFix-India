import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../../lib/firebase';

export const PartnerUpiQrCard: React.FC = () => {
  const [upiId, setUpiId] = useState('');
  const [savedUpiId, setSavedUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'current'>('savings');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [savedBank, setSavedBank] = useState<{ bankName: string; accountType: string; accountLast4: string; ifsc: string; accountHolderName: string } | null>(null);
  const [bankSaving, setBankSaving] = useState(false);

  const paymentUri = useMemo(() => savedUpiId ? 'upi://pay?' + new URLSearchParams({ pa: savedUpiId, pn: payeeName || 'QuickFix Partner', cu: 'INR' }).toString() : '', [savedUpiId, payeeName]);

  useEffect(() => {
    let active = true;
    if (!paymentUri) {
      setQrDataUrl('');
      return () => { active = false; };
    }
    void QRCode.toDataURL(paymentUri, { width: 240, margin: 2, errorCorrectionLevel: 'M' })
      .then((url: string) => { if (active) setQrDataUrl(url); })
      .catch(() => { if (active) { setQrDataUrl(''); setError('QR code could not be generated on this device.'); } });
    return () => { active = false; };
  }, [paymentUri]);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured for this app.');
      setLoading(false);
      return;
    }
    unsubscribe = onAuthStateChanged(auth, async user => {
      if (!active) return;
      if (!user) {
        setError('Please sign in with your Channel Partner account.');
        setLoading(false);
        return;
      }
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/partners/payment-profile', { headers: { Authorization: 'Bearer ' + token } });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'UPI profile could not be loaded.');
        const bankResponse = await fetch('/api/partners/bank-account', { headers: { Authorization: 'Bearer ' + token } });
        const bankResult = await bankResponse.json();
        if (!bankResponse.ok || !bankResult.success) throw new Error(bankResult.error || 'Bank account could not be loaded.');
        if (active) {
          setSavedBank(bankResult.configured ? { bankName: bankResult.bankName || '', accountType: bankResult.accountType || 'savings', accountLast4: bankResult.accountLast4 || '', ifsc: bankResult.ifsc || '', accountHolderName: bankResult.accountHolderName || '' } : null);
          setBankName(bankResult.bankName || '');
          setAccountType(bankResult.accountType === 'current' ? 'current' : 'savings');
          setAccountHolderName(bankResult.accountHolderName || '');
          setIfsc(bankResult.ifsc || '');
          setUpiId(result.upiId || '');
          setSavedUpiId(result.upiId || '');
          setPayeeName(result.payeeName || '');
          setError('');
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'UPI profile could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
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

  const saveBank = async () => {
    setBankSaving(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!isFirebaseConfigured || !user) throw new Error('Please sign in again.');
      const token = await user.getIdToken();
      const response = await fetch('/api/partners/bank-account', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ bankName, accountType, accountHolderName, accountNumber, ifsc }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Bank account could not be saved.');
      setSavedBank({ bankName: result.bankName, accountType: result.accountType, accountLast4: result.accountLast4, ifsc: result.ifsc, accountHolderName: result.accountHolderName });
      setAccountNumber('');
      setMessage('Bank account securely saved •••• ' + result.accountLast4 + '. Payouts are still disabled until separately configured.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Bank account could not be saved.'); }
    finally { setBankSaving(false); }
  };

  return <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm space-y-3">
    <div><h3 className="text-sm font-extrabold text-slate-900">Your Customer Payment QR</h3><p className="mt-1 text-xs text-slate-600">Apna UPI ID save karein. Customer is QR ko scan karke seedha aapke UPI app par payment kar sakta hai.</p></div>
    <div className="rounded-xl border border-slate-200 p-3 space-y-2">
      <h4 className="text-sm font-extrabold text-slate-900">Bank Account for Future Payouts</h4>
      {savedBank && <p className="text-xs text-emerald-700">Saved: {savedBank.bankName} · {savedBank.accountType === 'current' ? 'Current' : 'Savings'} · •••• {savedBank.accountLast4} · IFSC {savedBank.ifsc}</p>}
      <label className="block text-xs font-bold text-slate-700">Bank Name</label>
      <input value={bankName} onChange={e => setBankName(e.target.value)} maxLength={100} placeholder="Enter bank name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/>
      <label className="block text-xs font-bold text-slate-700">Account Type</label>
      <select value={accountType} onChange={e => setAccountType(e.target.value as 'savings' | 'current')} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="savings">Savings Account</option><option value="current">Current Account</option></select>
      <label className="block text-xs font-bold text-slate-700">Account Holder Name</label>
      <input value={accountHolderName} onChange={e => setAccountHolderName(e.target.value)} maxLength={100} placeholder="As printed on bank account" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/>
      <label className="block text-xs font-bold text-slate-700">Account Number</label>
      <input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\\D/g, '').slice(0,18))} inputMode="numeric" autoComplete="off" placeholder={savedBank ? 'Enter new number to update •••• ' + savedBank.accountLast4 : 'Enter 9–18 digit account number'} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/>
      <label className="block text-xs font-bold text-slate-700">IFSC Code</label>
      <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase().slice(0,11))} maxLength={11} placeholder="e.g. SBIN0001234" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase"/>
      <button type="button" disabled={bankSaving || loading || !bankName.trim() || !accountHolderName.trim() || accountNumber.length < 9 || ifsc.length !== 11} onClick={() => void saveBank()} className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{bankSaving ? 'Saving…' : 'Save Bank Account'}</button>
      <p className="text-[11px] text-slate-500">Account number is encrypted on the server. Saving details does not activate or settle payouts.</p>
    </div>
    <label className="block text-xs font-bold text-slate-700">Your UPI ID</label>
    <div className="flex gap-2"><input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="example@bank" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><button type="button" disabled={saving || loading || !upiId.trim()} onClick={() => void save()} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save UPI'}</button></div>
    {loading && <p className="text-xs text-slate-500">Loading saved UPI ID…</p>}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
    {message && <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-800">{message}</p>}
    {savedUpiId && <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-3">{qrDataUrl ? <img src={qrDataUrl} alt="Channel Partner UPI payment QR code" width="220" height="220" className="h-56 w-56 rounded-lg bg-white p-2"/> : <p className="text-xs text-slate-500">Generating your QR…</p>}<p className="text-sm font-bold text-slate-900">{savedUpiId}</p><button type="button" onClick={async () => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(savedUpiId); setMessage('UPI ID copied.'); } catch { setError('Copy is unavailable on this device. Please copy the UPI ID manually.'); } }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Copy UPI ID</button></div>}
    <p className="rounded-lg bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-900">Important: QR payment customer ke UPI app mein initiate hota hai. QuickFix abhi is direct UPI payment ko automatically verify nahi karta. Payment milne ki pushti apne bank/UPI app mein khud karein; app booking ko paid mark nahi karega.</p>
  </section>;
};
