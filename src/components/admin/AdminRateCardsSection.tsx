import React, { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import type { BillingUnit } from '../../data/pricing';
import type { LocationRateCard, RateApprovalStatus } from '../../data/rateCards';

const units: BillingUnit[] = ['per_visit', 'per_point', 'per_piece', 'per_hour', 'per_day', 'per_sqft', 'per_kg', 'per_km', 'per_trip', 'per_job', 'quote'];
const categories = ['electrician', 'plumber', 'technician', 'ac_repair', 'fridge_repair', 'welder', 'mechanic', 'driver', 'tourist_guide', 'contractor', 'bike_taxi', 'kaamkaaj_partner', 'house_cleaning', 'cook', 'laundry', 'maid', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting'];

const blank = {
  state: 'Madhya Pradesh', district: 'Indore', city: '', tehsil: '',
  serviceCategory: 'electrician', serviceId: '', unit: 'per_visit' as BillingUnit,
  minimumRate: '200', maximumRate: '600', minimumCharge: '200', baseFee: '0',
  materialsIncluded: false, effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '', sourceName: '', sourceUrl: '', notes: ''
};

const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-300';

export const AdminRateCardsSection: React.FC = () => {
  const [form, setForm] = useState(blank);
  const [cards, setCards] = useState<LocationRateCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Admin Firebase session missing. Please sign in again.');
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin !== true) throw new Error('Server-verified admin custom claim is required.');
      setAuthorized(true);
      const snapshot = await getDocs(query(collection(db, 'rate_cards')));
      setCards(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as LocationRateCard))
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
    } catch (e) {
      setAuthorized(false);
      setError(e instanceof Error ? e.message : 'Rate cards could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isFirebaseConfigured) void loadCards(); }, [loadCards]);

  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again.');
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin !== true) throw new Error('Admin custom claim is missing.');
      const min = Number(form.minimumRate);
      const max = Number(form.maximumRate);
      const charge = Number(form.minimumCharge);
      const base = Number(form.baseFee || 0);
      if (!form.state.trim() || !form.district.trim() || !form.serviceCategory || !form.sourceName.trim()) throw new Error('State, district, category and source are required.');
      if (![min, max, charge, base].every(n => Number.isFinite(n) && n >= 0) || max < min) throw new Error('Enter valid rates. Maximum must be at least the minimum.');
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(form.effectiveFrom) || (form.effectiveTo && form.effectiveTo < form.effectiveFrom)) throw new Error('Check the effective dates.');
      const payload = {
        state: form.state.trim(), district: form.district.trim(), city: form.city.trim() || null,
        tehsil: form.tehsil.trim() || null, serviceCategory: form.serviceCategory,
        serviceId: form.serviceId.trim() || null, unit: form.unit, currency: 'INR',
        minimumRate: min, maximumRate: max, minimumCharge: charge, baseFee: base,
        materialsIncluded: form.materialsIncluded, approvalStatus: 'draft' as RateApprovalStatus,
        effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null,
        sourceName: form.sourceName.trim(), sourceUrl: form.sourceUrl.trim() || null,
        sourceCheckedAt: new Date().toISOString(), notes: form.notes.trim(),
        createdBy: user.uid, createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'rate_cards'), payload);
      setMessage('Draft saved. It is NOT customer-publishable until an authorized admin approves it.');
      setForm(blank);
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft could not be saved.');
    }
  };

  const changeStatus = async (card: LocationRateCard, status: RateApprovalStatus) => {
    setMessage('');
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again.');
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin !== true) throw new Error('Admin custom claim is missing.');
      const extra = status === 'approved'
        ? { approvedBy: user.uid, approvedAt: new Date().toISOString() }
        : { retiredAt: new Date().toISOString() };
      await updateDoc(doc(db, 'rate_cards', card.id), {
        approvalStatus: status, ...extra, updatedAt: serverTimestamp()
      });
      setMessage(status === 'approved'
        ? 'Rate card approved in Firestore. Customer quote integration is still a separate release.'
        : 'Rate card moved to ' + status + '.');
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rate card status could not be changed.');
    }
  };

  if (!isFirebaseConfigured) return <div className="rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-sm text-amber-200">Firebase environment is not configured. Rate-card management is disabled; no local/mock save is performed.</div>;

  return (
    <section className="space-y-4 text-slate-100">
      <div className="rounded-xl border border-blue-800 bg-slate-950 p-4">
        <h3 className="text-base font-bold">Location-wise Service Rate Cards</h3>
        <p className="mt-1 text-xs text-slate-400">Create drafts, review their source, and approve only rates suitable for publication. Specificity: Tehsil → City → District → State.</p>
        <p className="mt-2 text-xs">Admin claim: <span className={authorized ? 'text-emerald-400' : 'text-amber-300'}>{authorized ? 'verified' : 'not verified yet'}</span></p>
      </div>

      <form onSubmit={saveDraft} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-2">
        <h4 className="md:col-span-2 text-sm font-bold">New rate card draft</h4>
        {([
          ['state', 'State'], ['district', 'District'], ['city', 'City (optional)'], ['tehsil', 'Tehsil (optional)'],
          ['serviceId', 'Service ID (optional)'], ['sourceName', 'Source / quotation reference'], ['sourceUrl', 'Source URL (optional)']
        ] as const).map(([key, title]) => <label key={key}><span className={labelClass}>{title}</span><input className={inputClass} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} /></label>)}
        <label><span className={labelClass}>Partner/service category</span><select className={inputClass} value={form.serviceCategory} onChange={e => setForm(p => ({ ...p, serviceCategory: e.target.value }))}>{categories.map(c => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}</select></label>
        <label><span className={labelClass}>Billing unit</span><select className={inputClass} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as BillingUnit }))}>{units.map(u => <option key={u} value={u}>{u.replaceAll('_', ' ')}</option>)}</select></label>
        {([
          ['minimumRate', 'Minimum rate (₹)'], ['maximumRate', 'Maximum rate (₹)'], ['minimumCharge', 'Minimum customer charge (₹)'], ['baseFee', 'Base fee (₹)']
        ] as const).map(([key, title]) => <label key={key}><span className={labelClass}>{title}</span><input required type="number" min="0" step="0.01" className={inputClass} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} /></label>)}
        <label><span className={labelClass}>Effective from</span><input required type="date" className={inputClass} value={form.effectiveFrom} onChange={e => setForm(p => ({ ...p, effectiveFrom: e.target.value }))} /></label>
        <label><span className={labelClass}>Effective to (optional)</span><input type="date" className={inputClass} value={form.effectiveTo} onChange={e => setForm(p => ({ ...p, effectiveTo: e.target.value }))} /></label>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.materialsIncluded} onChange={e => setForm(p => ({ ...p, materialsIncluded: e.target.checked }))} /> Materials included in rate</label>
        <label className="md:col-span-2"><span className={labelClass}>Notes / exclusions / evidence details</span><textarea className={inputClass} rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-2"><button disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold disabled:opacity-50">Save as draft</button><button type="button" onClick={() => void loadCards()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Refresh</button></div>
      </form>

      {message && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-xs text-emerald-300">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-300">{error}</p>}
      <div className="space-y-2">
        <div className="flex items-center justify-between"><h4 className="text-sm font-bold">Saved rate cards ({cards.length})</h4><span className="text-xs text-slate-400">{loading ? 'Loading…' : 'Firestore records'}</span></div>
        {cards.length === 0 && !loading && <p className="rounded-lg border border-slate-800 p-4 text-xs text-slate-400">No saved rate cards yet. Add a draft above.</p>}
        {cards.map(card => <article key={card.id} className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h5 className="text-sm font-bold">{card.serviceCategory.replaceAll('_', ' ')} · ₹{card.minimumRate}–₹{card.maximumRate}/{card.unit.replaceAll('_', ' ')}</h5><p className="text-xs text-slate-400">{[card.tehsil, card.city, card.district, card.state].filter(Boolean).join(' · ')}</p></div><span className={card.approvalStatus === 'approved' ? 'rounded-full bg-emerald-950 px-2 py-1 text-xs text-emerald-300' : 'rounded-full bg-amber-950 px-2 py-1 text-xs text-amber-300'}>{card.approvalStatus}</span></div>
          <p className="text-xs text-slate-400">Source: {card.sourceName} · Effective {card.effectiveFrom}{card.effectiveTo ? ' to ' + card.effectiveTo : ''}</p>
          <p className="text-xs text-slate-500">{card.notes}</p>
          <div className="flex flex-wrap gap-2">{card.approvalStatus === 'draft' && <button onClick={() => void changeStatus(card, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold">Approve</button>}{card.approvalStatus !== 'retired' && <button onClick={() => void changeStatus(card, 'retired')} className="rounded-lg border border-rose-800 px-3 py-1.5 text-xs text-rose-300">Retire</button>}</div>
        </article>)}
      </div>
      <p className="text-[11px] text-amber-300">Important: approval is admin-claim protected, but this release does not yet connect these records to customer checkout or provide server-authoritative quote calculation/audit history. Do not treat research benchmarks as approved tariffs.</p>
    </section>
  );
};
