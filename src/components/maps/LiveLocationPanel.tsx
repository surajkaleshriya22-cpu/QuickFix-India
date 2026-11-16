import React, { useEffect, useState } from 'react';
import { MapPin, ShieldCheck, ShieldOff, RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';

type ParticipantRole = 'customer' | 'partner';
type SharedLocation = { role: ParticipantRole; lat: number; lng: number; updatedAt: string | null; stale: boolean };
type LocationResponse = { success: boolean; customer: SharedLocation | null; partner: SharedLocation | null; error?: string };

interface LiveLocationPanelProps {
  bookingId: string;
  role: ParticipantRole;
  active: boolean;
}

/** Consent-first foreground-only GPS sharing. No background tracking is started. */
export const LiveLocationPanel: React.FC<LiveLocationPanelProps> = ({ bookingId, role, active }) => {
  const [consented, setConsented] = useState(false);
  const [otherConsented, setOtherConsented] = useState(false);
  const [locations, setLocations] = useState<LocationResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);

  const request = async (path: string, body?: unknown) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Please sign in again with your verified account.');
    const token = await user.getIdToken();
    const response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Live location service is not available.');
    return data;
  };

  const refresh = async () => {
    try {
      const data = await request(`/api/bookings/${encodeURIComponent(bookingId)}/location`);
      setLocations(data);
      setOtherConsented(true);
    } catch (error) {
      setLocations(null);
      setOtherConsented(false);
      setMessage(error instanceof Error ? error.message : 'Could not refresh shared location.');
    }
  };

  const changeConsent = async (enabled: boolean) => {
    setBusy(true);
    setMessage('');
    try {
      await request(`/api/bookings/${encodeURIComponent(bookingId)}/location/consent`, { enabled });
      setConsented(enabled);
      if (!enabled) {
        setPermissionGranted(false);
        setLocations(null);
        setMessage('Location sharing stopped.');
      } else {
        setMessage('Your permission is saved. The other participant must also opt in.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not change location permission.');
    } finally {
      setBusy(false);
    }
  };

  // When a booking becomes inactive, make one authenticated read attempt.
  // The server rejects ended bookings and idempotently deletes both saved GPS points.
  useEffect(() => {
    if (active) return;
    let cancelled = false;
    void request(`/api/bookings/${encodeURIComponent(bookingId)}/location/consent`).catch(() => {
      // A 403 is expected for completed/cancelled bookings; server-side cleanup still ran.
      if (cancelled) return;
    });
    return () => { cancelled = true; };
  }, [active, bookingId]);

  useEffect(() => {
    if (!active || !consented || !otherConsented || !navigator.geolocation) return;
    let watchId: number | undefined;
    let cancelled = false;
    watchId = navigator.geolocation.watchPosition(async position => {
      if (cancelled) return;
      setPermissionGranted(true);
      try {
        await request(`/api/bookings/${encodeURIComponent(bookingId)}/location`, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'GPS update failed.');
      }
    }, error => {
      setPermissionGranted(false);
      setMessage(error.code === error.PERMISSION_DENIED
        ? 'Location permission denied. Enable location access in device settings.'
        : 'GPS location is temporarily unavailable.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [active, consented, otherConsented, bookingId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const loadConsentAndLocations = async () => {
      try {
        const consent = await request(`/api/bookings/${encodeURIComponent(bookingId)}/location/consent`);
        if (cancelled) return;
        setConsented(consent.ownEnabled === true);
        setOtherConsented(consent.otherEnabled === true);
        if (consent.ownEnabled === true && consent.otherEnabled === true) {
          const data = await request(`/api/bookings/${encodeURIComponent(bookingId)}/location`);
          if (!cancelled) setLocations(data);
        } else {
          setLocations(null);
          setMessage('Location sharing is waiting for both participants to opt in.');
        }
      } catch (error) {
        if (!cancelled) {
          setLocations(null);
          setConsented(false);
          setOtherConsented(false);
          setMessage(error instanceof Error ? error.message : 'Could not load location permission.');
        }
      }
    };
    void loadConsentAndLocations();
    const timer = window.setInterval(() => void loadConsentAndLocations(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [active, bookingId]);

  const own = role === 'customer' ? locations?.customer : locations?.partner;
  const other = role === 'customer' ? locations?.partner : locations?.customer;

  if (!active) return null;
  return (
    <section className="rounded-2xl border border-blue-200 bg-white p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <MapPin className="h-4 w-4 text-blue-600" />
        Live location sharing
      </div>
      <p className="text-[11px] leading-relaxed text-slate-600">
        Location is shared only during this active booking and only when both people allow it. Tracking runs only while this screen is open.
      </p>
      <button type="button" disabled={busy} onClick={() => void changeConsent(!consented)}
        className={`w-full rounded-xl px-3 py-2.5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${consented ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-blue-600 text-white'}`}>
        {consented ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        {busy ? 'Please wait…' : consented ? 'Stop sharing my location' : 'Allow sharing my live location'}
      </button>
      {message && <p role="status" className="text-[11px] text-amber-700 break-words">{message}</p>}
      {consented && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700">Shared GPS status</span>
            <button type="button" onClick={() => void refresh()} className="text-[11px] text-blue-700 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
          {other && (
            <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">
              <div className="font-bold">{other.role === 'partner' ? 'Channel Partner' : 'Customer'} · {other.stale ? 'Last update is old' : 'Location received'}</div>
              <div>{other.lat.toFixed(5)}, {other.lng.toFixed(5)}</div>
              {other.updatedAt && <div>Updated: {new Date(other.updatedAt).toLocaleTimeString()}</div>}
              <a className="inline-block mt-1 text-blue-700 underline" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps?q=${other.lat},${other.lng}`}>Open location in Maps</a>
            </div>
          )}
          {!other && <p className="text-[11px] text-slate-500">Waiting for the other participant to allow sharing and send GPS.</p>}
          {own && <p className="text-[10px] text-emerald-700">Your latest GPS update: {permissionGranted ? 'active' : 'saved'}.</p>}
        </div>
      )}
    </section>
  );
};
