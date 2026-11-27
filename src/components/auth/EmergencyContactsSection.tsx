import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type EmergencyContact = {
  contactId: string;
  maskedPhone: string;
  relationship: string;
  verified: boolean;
  consent: boolean;
};

export const EmergencyContactsSection: React.FC<{ language?: string }> = ({ language = 'en' }) => {
  const hindi = language === 'hi';
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [relationship, setRelationship] = useState('Family');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const request = useCallback(async (url: string, init: RequestInit = {}) => {
    const user = auth.currentUser;
    if (!user) throw new Error(hindi ? 'कृपया दोबारा लॉगिन करें।' : 'Please sign in again.');
    const token = await user.getIdToken(true);
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || (hindi ? 'अनुरोध पूरा नहीं हुआ।' : 'Request failed.'));
    return result;
  }, [hindi]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request('/api/me/emergency-contacts');
      setContacts(Array.isArray(result.contacts) ? result.contacts : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : (hindi ? 'संपर्क लोड नहीं हुए।' : 'Contacts could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [request, hindi]);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const sendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('/api/me/emergency-contacts/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), relationship, consent })
      });
      setOtpSent(true);
      setNotice(result.message || (hindi ? 'OTP भेज दिया गया है।' : 'Verification code sent.'));
    } catch (e) {
      setError(e instanceof Error ? e.message : (hindi ? 'OTP नहीं भेजा जा सका।' : 'OTP could not be sent.'));
    } finally { setBusy(false); }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || code.length !== 6) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('/api/me/emergency-contacts/verify', {
        method: 'POST', body: JSON.stringify({ phoneNumber: phoneNumber.trim(), code })
      });
      setNotice(result.message || (hindi ? 'आपातकालीन संपर्क सत्यापित हो गया।' : 'Emergency contact verified.'));
      setOtpSent(false); setCode(''); setPhoneNumber('+91'); setConsent(false);
      await loadContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : (hindi ? 'OTP सत्यापन विफल हुआ।' : 'OTP verification failed.'));
    } finally { setBusy(false); }
  };

  const removeContact = async (contactId: string) => {
    if (busy || !window.confirm(hindi ? 'क्या इस आपातकालीन संपर्क को हटाना है?' : 'Remove this emergency contact?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await request('/api/me/emergency-contacts/' + encodeURIComponent(contactId), { method: 'DELETE' });
      setNotice(hindi ? 'आपातकालीन संपर्क हटा दिया गया।' : 'Emergency contact removed.');
      await loadContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : (hindi ? 'संपर्क नहीं हटाया जा सका।' : 'Contact could not be removed.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3" aria-label="Emergency contacts">
      <div>
        <h4 className="text-sm font-extrabold text-slate-900">{hindi ? 'आपातकालीन संपर्क' : 'Emergency Contacts'}</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {hindi ? 'अधिकतम 3 भरोसेमंद लोगों के नंबर जोड़ें। OTP से नंबर सत्यापित होगा और उनकी अनुमति जरूरी है।' : 'Add up to 3 trusted people. Their number must be verified by OTP and you must have their consent.'}
        </p>
      </div>
      {contacts.map(contact => (
        <div key={contact.contactId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900">{contact.relationship} · {contact.maskedPhone}</div>
            <div className={contact.verified && contact.consent ? 'text-[10px] font-semibold text-emerald-700' : 'text-[10px] font-semibold text-amber-700'}>
              {contact.verified && contact.consent ? (hindi ? 'सत्यापित' : 'Verified') : (hindi ? 'सत्यापन बाकी' : 'Verification pending')}
            </div>
          </div>
          <button type="button" disabled={busy} onClick={() => void removeContact(contact.contactId)} className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 disabled:opacity-50">{hindi ? 'हटाएँ' : 'Remove'}</button>
        </div>
      ))}
      {loading && <p className="text-[11px] text-slate-500">{hindi ? 'लोड हो रहा है…' : 'Loading…'}</p>}
      {!loading && contacts.length < 3 && !otpSent && (
        <form onSubmit={sendOtp} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-[11px] font-semibold text-slate-700" htmlFor="emergency-contact-phone">{hindi ? 'मोबाइल नंबर (+91 सहित)' : 'Mobile number (with country code)'}</label>
          <input id="emergency-contact-phone" type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+919876543210" maxLength={16} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="block text-[11px] font-semibold text-slate-700" htmlFor="emergency-contact-relationship">{hindi ? 'रिश्ता' : 'Relationship'}</label>
          <select id="emergency-contact-relationship" value={relationship} onChange={e => setRelationship(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="Family">{hindi ? 'परिवार' : 'Family'}</option><option value="Friend">{hindi ? 'मित्र' : 'Friend'}</option><option value="Other">{hindi ? 'अन्य' : 'Other'}</option>
          </select>
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            {hindi ? 'मैंने इस व्यक्ति से उनका नंबर जोड़ने और सत्यापित करने की अनुमति ली है।' : 'I confirm this person agreed to have their number added and verified.'}
          </label>
          <button type="submit" disabled={busy || !consent || phoneNumber.trim().length < 9} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? (hindi ? 'भेज रहे हैं…' : 'Sending…') : (hindi ? 'OTP भेजें' : 'Send verification OTP')}</button>
        </form>
      )}
      {otpSent && (
        <form onSubmit={verifyOtp} className="space-y-2 rounded-lg border border-blue-200 bg-white p-3">
          <p className="text-[11px] text-slate-700">{hindi ? 'इस नंबर पर आया 6 अंकों का OTP दर्ज करें। यह 5 मिनट में समाप्त हो जाएगा।' : 'Enter the 6-digit OTP sent to this number. It expires in 5 minutes.'}</p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em]" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className="flex-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? (hindi ? 'जाँच रहे हैं…' : 'Verifying…') : (hindi ? 'OTP सत्यापित करें' : 'Verify OTP')}</button>
            <button type="button" disabled={busy} onClick={() => { setOtpSent(false); setCode(''); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">{hindi ? 'रद्द करें' : 'Cancel'}</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-[11px] font-medium text-rose-700">{error}</p>}
      {notice && <p role="status" className="text-[11px] font-medium text-emerald-700">{notice}</p>}
      <p className="text-[10px] leading-relaxed text-slate-500">
        {hindi ? 'SOS पर केवल सत्यापित और अनुमति वाले संपर्कों को SMS भेजने का प्रयास होगा, जब Twilio सेटअप चालू होगा। SMS पहुँचने की गारंटी नहीं है और पुलिस/एम्बुलेंस dispatch नहीं होता। तत्काल खतरे में 112 पर कॉल करें।' : 'SOS will attempt SMS only to verified, consented contacts when Twilio is configured. SMS delivery is not guaranteed and this does not dispatch police or an ambulance. Call 112 in immediate danger.'}
      </p>
    </section>
  );
};
