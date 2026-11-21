import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type EmergencyContact = {
  contactId: string;
  maskedPhone: string;
  relationship: string;
  verified: boolean;
  consent: boolean;
};

export const EmergencyContactsSection: React.FC = () => {
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
    if (!user) throw new Error('Please sign in again.');
    const token = await user.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {})
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Request failed. Please try again.');
    return result;
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request('/api/me/emergency-contacts');
      setContacts(Array.isArray(result.contacts) ? result.contacts : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Contacts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const sendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/me/emergency-contacts/send-otp', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), relationship, consent })
      });
      setOtpSent(true);
      setNotice(result.message || 'Verification code sent. It expires in 5 minutes.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OTP could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/me/emergency-contacts/verify', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), code })
      });
      setNotice(result.message || 'Emergency contact verified.');
      setOtpSent(false);
      setCode('');
      setPhoneNumber('+91');
      setConsent(false);
      await loadContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeContact = async (contactId: string) => {
    if (!window.confirm('Remove this emergency contact from your QuickFix account?')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await request('/api/me/emergency-contacts/' + encodeURIComponent(contactId), { method: 'DELETE' });
      setNotice('Emergency contact removed.');
      await loadContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Contact could not be removed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3" aria-label="Emergency contacts">
      <div>
        <h4 className="text-sm font-extrabold text-slate-900">Emergency Contact / आपातकालीन संपर्क</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Customer और Channel Partner दोनों अपने अधिकतम 3 contacts जोड़ सकते हैं। नंबर पर OTP भेजकर उस व्यक्ति की सहमति/पहुँच verify होगी।</p>
      </div>

      {contacts.map((contact) => (
        <div key={contact.contactId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900">{contact.relationship} · {contact.maskedPhone}</div>
            <div className={contact.verified ? 'text-[10px] font-semibold text-emerald-700' : 'text-[10px] font-semibold text-amber-700'}>
              {contact.verified ? 'Verified mobile' : 'Verification pending'}
            </div>
          </div>
          <button type="button" disabled={busy} onClick={() => void removeContact(contact.contactId)} className="rounded-md border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 disabled:opacity-50">Remove</button>
        </div>
      ))}
      {loading && <p className="text-[11px] text-slate-500">Loading contacts…</p>}
      {contacts.length < 3 && !otpSent && (
        <form onSubmit={sendOtp} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <label className="block text-[11px] font-semibold text-slate-700" htmlFor="emergency-contact-phone">Contact mobile with country code</label>
          <input id="emergency-contact-phone" type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+919876543210" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <label className="block text-[11px] font-semibold text-slate-700" htmlFor="emergency-contact-relationship">Relationship</label>
          <select id="emergency-contact-relationship" value={relationship} onChange={e => setRelationship(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option>Family</option><option>Friend</option><option>Other</option>
          </select>
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            I confirm this person has agreed that I can add and verify their mobile number in QuickFix.
          </label>
          <button type="submit" disabled={busy || !consent} className="w-full rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Sending…' : 'Send verification OTP'}</button>
        </form>
      )}
      {otpSent && (
        <form onSubmit={verifyOtp} className="space-y-2 rounded-lg border border-blue-200 bg-white p-3">
          <p className="text-[11px] text-slate-700">OTP sent to {phoneNumber}. Ask that contact to share the 6-digit code with you only if they agree to be your emergency contact. It expires in 5 minutes.</p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em]" />
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className="flex-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Verifying…' : 'Verify OTP'}</button>
            <button type="button" disabled={busy} onClick={() => { setOtpSent(false); setCode(''); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-[11px] font-medium text-rose-700">{error}</p>}
      {notice && <p role="status" className="text-[11px] font-medium text-emerald-700">{notice}</p>}
      <p className="text-[10px] leading-relaxed text-slate-500">अभी यह सुविधा नंबर verify और save करती है। SOS पर emergency contacts को SMS भेजना/dispatch अभी connected नहीं है। तत्काल खतरे में 112 पर सीधे call करें। OTP किसी से share न करें।</p>
    </section>
  );
};
