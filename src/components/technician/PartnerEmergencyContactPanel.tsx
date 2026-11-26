import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type EmergencyContact = { name: string; phone: string; consentConfirmed: true };

export const PartnerEmergencyContactPanel: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const request = useCallback(async (url: string, method = 'GET', body?: unknown) => {
    const user = auth.currentUser;
    if (!user) throw new Error('पहले अपने verified Channel Partner account से login करें।');
    const token = await user.getIdToken();
    const response = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Request पूरी नहीं हो सकी।');
    return result;
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await request('/api/partners/safety/emergency-contact');
      const contact = result.contact as EmergencyContact | null;
      if (contact) {
        setName(contact.name || '');
        setPhone(contact.phone || '');
        setSaved(true);
        setConsent(true);
      } else {
        setName(''); setPhone(''); setSaved(false); setConsent(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Emergency contact load नहीं हुआ।');
    } finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await request('/api/partners/safety/emergency-contact', 'PUT', { name, phone, consentConfirmed: consent });
      setSaved(true);
      setMessage('Emergency contact सुरक्षित रूप से save हो गया। इससे अभी कोई SMS या call नहीं भेजी जाती।');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Contact save नहीं हुआ।');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm('क्या आप saved emergency contact हटाना चाहते हैं?')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await request('/api/partners/safety/emergency-contact', 'DELETE');
      setName(''); setPhone(''); setConsent(false); setSaved(false);
      setMessage('Emergency contact हटा दिया गया।');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Contact हटाया नहीं जा सका।');
    } finally { setBusy(false); }
  };

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-4 space-y-3">
      <div>
        <h3 className="font-bold text-slate-900">Emergency Contact / आपातकालीन संपर्क</h3>
        <p className="mt-1 text-xs text-slate-600">अपना भरोसेमंद संपर्क नंबर सेव करें। यह जानकारी आपके partner account में रहती है और केवल आप अपने account से इसे देख या बदल सकते हैं।</p>
      </div>
      {loading ? <p className="text-sm text-slate-500">Contact जाँचा जा रहा है…</p> : (
        <>
          <label className="block text-xs font-semibold text-slate-700">Contact name
            <input value={name} onChange={e => setName(e.target.value)} maxLength={100} className="mt-1 w-full rounded-lg border p-2 text-sm" placeholder="नाम लिखें" />
          </label>
          <label className="block text-xs font-semibold text-slate-700">Phone number (country code सहित)
            <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={18} inputMode="tel" className="mt-1 w-full rounded-lg border p-2 text-sm" placeholder="+91XXXXXXXXXX" />
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            मैंने इस व्यक्ति से नंबर सेव करने की अनुमति ली है।
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || !name.trim() || !phone.trim() || !consent} onClick={() => void save()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'कृपया प्रतीक्षा करें…' : saved ? 'Update contact' : 'Save contact'}</button>
            {saved && <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50">Remove</button>}
          </div>
        </>
      )}
      {message && <p role="status" className="text-xs text-emerald-700">{message}</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <p className="rounded-lg bg-amber-50 p-2 text-[11px] text-amber-900">महत्वपूर्ण: contact save करने से SMS, फोन कॉल, पुलिस या एम्बुलेंस को सूचना नहीं जाती। मौजूदा SOS केवल QuickFix safety report दर्ज करता है। तत्काल खतरे में 112 पर सीधे कॉल करें।</p>
    </section>
  );
};
