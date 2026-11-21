import React, { useCallback, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';

type SafetyIncident = {
  incidentId: string;
  bookingId: string;
  reporterRole: string;
  incidentType: string;
  status: string;
  adminSmsStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const statusLabel: Record<string, string> = {
  received_pending_review: 'New — pending review',
  acknowledged: 'Acknowledged',
  under_review: 'Under review',
  resolved: 'Resolved',
  closed: 'Closed'
};

export const AdminSafetyIncidentsSection: React.FC = () => {
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadIncidents = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Admin Firebase session is missing. Please sign in again.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/safety-incidents', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Safety incidents could not be loaded.');
      setIncidents(Array.isArray(result.incidents) ? result.incidents : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Safety incidents could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadIncidents(); }, [loadIncidents]);

  const updateStatus = async (incidentId: string, status: 'acknowledged' | 'under_review' | 'resolved') => {
    const user = auth.currentUser;
    if (!user) {
      setError('Admin Firebase session is missing. Please sign in again.');
      return;
    }
    setBusyId(incidentId);
    setError('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/safety-incidents/' + encodeURIComponent(incidentId), {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Incident status could not be updated.');
      setNotice('Incident status updated.');
      await loadIncidents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incident status could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4" aria-label="Safety incident management">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Safety & SOS Incidents</h2>
          <p className="text-xs text-slate-500">Admin-only incident queue. Personal phone numbers, full addresses and report text are intentionally hidden.</p>
        </div>
        <button type="button" onClick={() => void loadIncidents()} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          {loading ? 'Refreshing…' : 'Refresh incidents'}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {!loading && incidents.length === 0 && !error && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No safety incidents have been recorded.</div>
      )}
      <div className="space-y-3">
        {incidents.map((incident) => (
          <article key={incident.incidentId} className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">{incident.incidentType.replaceAll('_', ' ')}</div>
                <div className="mt-1 text-xs text-slate-500">Incident: {incident.incidentId}</div>
                <div className="text-xs text-slate-500">Booking: {incident.bookingId} · Reporter: {incident.reporterRole}</div>
                <div className="text-xs text-slate-500">{incident.createdAt ? new Date(incident.createdAt).toLocaleString('en-IN') : 'Time unavailable'}</div>
              </div>
              <div className="space-y-1 text-right text-xs">
                <div className="font-bold text-slate-800">{statusLabel[incident.status] || incident.status}</div>
                <div className={incident.adminSmsStatus === 'sent' ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                  Admin SMS: {incident.adminSmsStatus}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busyId === incident.incidentId || incident.status === 'acknowledged'} onClick={() => void updateStatus(incident.incidentId, 'acknowledged')} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Acknowledge</button>
              <button type="button" disabled={busyId === incident.incidentId || incident.status === 'under_review'} onClick={() => void updateStatus(incident.incidentId, 'under_review')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Under review</button>
              <button type="button" disabled={busyId === incident.incidentId || incident.status === 'resolved'} onClick={() => void updateStatus(incident.incidentId, 'resolved')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Mark resolved</button>
            </div>
          </article>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">An Admin SMS status of “sent” means Twilio accepted the API request; it does not prove handset delivery. This dashboard does not dispatch police or ambulance. In immediate danger, call 112 directly.</p>
    </section>
  );
};
