import React, { useState } from 'react';
import { auth } from '../../lib/firebase';

type IncidentType = 'safety_concern' | 'medical_emergency' | 'harassment' | 'other';

export const BookingSosButton: React.FC<{ bookingId: string; reporterRole: 'customer' | 'partner' }> = ({ bookingId, reporterRole }) => {
  const [incidentType, setIncidentType] = useState<IncidentType>('safety_concern');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const submitReport = async () => {
    const user = auth.currentUser;
    if (!user) {
      setStatus('Please sign in again with your verified mobile number.');
      return;
    }
    if (!window.confirm('Send a safety report for this active booking? QuickFix will save the report, but emergency dispatch is not connected yet.')) return;

    setSaving(true);
    setStatus('');
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/bookings/' + encodeURIComponent(bookingId) + '/sos', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2),
          incidentType,
          ...(message.trim() ? { message: message.trim() } : {})
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Safety report could not be saved. Please call 112 if you are in immediate danger.');
      const adminSms = result.adminSmsStatus === 'sent'
        ? 'Admin SMS request accepted by Twilio'
        : result.adminSmsStatus === 'failed'
          ? 'Admin SMS was not accepted by Twilio'
          : 'Admin SMS is not configured';
      const contactSms = result.emergencyContactSmsStatus === 'sent'
        ? 'verified emergency-contact SMS requests accepted by Twilio'
        : result.emergencyContactSmsStatus === 'partial'
          ? 'some verified emergency-contact SMS requests accepted by Twilio'
          : result.emergencyContactSmsStatus === 'failed'
            ? 'emergency-contact SMS requests were not accepted by Twilio'
            : result.emergencyContactSmsStatus === 'not_configured'
              ? 'emergency-contact SMS is not configured'
              : 'no verified emergency contacts available';
      setStatus(`Safety report saved. ${adminSms}; ${contactSms}. Provider acceptance does not guarantee handset delivery, and QuickFix does not dispatch police/ambulance. If urgent, call 112 now.`);
      setMessage('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Safety report failed. If urgent, call 112 now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2" aria-label="Booking safety report">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-rose-600 px-2 py-1 text-xs font-extrabold text-white">SOS</span>
        <div className="text-xs font-bold text-rose-900">{reporterRole === 'customer' ? 'Customer safety' : 'Channel Partner safety'}</div>
      </div>
      <label className="block text-xs font-semibold text-slate-700" htmlFor={'sos-type-' + bookingId}>Report type</label>
      <select id={'sos-type-' + bookingId} value={incidentType} onChange={event => setIncidentType(event.target.value as IncidentType)} className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm">
        <option value="safety_concern">Safety concern / असुरक्षा</option>
        <option value="medical_emergency">Medical emergency / चिकित्सा आपातकाल</option>
        <option value="harassment">Harassment / उत्पीड़न</option>
        <option value="other">Other / अन्य</option>
      </select>
      <textarea value={message} onChange={event => setMessage(event.target.value.slice(0, 500))} maxLength={500} rows={2} placeholder="Optional details (do not include OTP or sensitive documents)" className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={saving} onClick={() => void submitReport()} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving report…' : 'Send SOS report'}</button>
        <a href="tel:112" className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-800">Call 112</a>
      </div>
      <p className="text-[10px] leading-relaxed text-rose-800">QuickFix saves this report only. Automatic police, ambulance, emergency-contact or admin alerts are not connected yet. For immediate danger, call 112 directly.</p>
      {status && <p role="status" aria-live="polite" className="text-xs font-medium text-slate-800">{status}</p>}
    </section>
  );
};
