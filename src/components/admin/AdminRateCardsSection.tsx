import React, { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, getDocs, query, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../lib/firebase';
import type { BillingUnit } from '../../data/pricing';
import type { LocationRateCard, RateApprovalStatus } from '../../data/rateCards';

const units: BillingUnit[] = ['per_visit', 'per_point', 'per_piece', 'per_hour', 'per_day', 'per_sqft', 'per_kg', 'per_km', 'per_trip', 'per_job', 'quote'];
const categories = ['electrician', 'plumber', 'technician', 'ac_repair', 'fridge_repair', 'appliance_repair', 'welder', 'mechanic', 'driver', 'tourist_guide', 'contractor', 'bike_taxi', 'kaamkaaj_partner', 'house_cleaning', 'cook', 'laundry', 'maid', 'carpenter', 'painter', 'gardener', 'pest_control', 'house_shifting'];

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
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom) || (form.effectiveTo && form.effectiveTo < form.effectiveFrom)) throw new Error('Check the effective dates.');
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
      if (editingCardId) {
        await updateDoc(doc(db, 'rate_cards', editingCardId), {
          ...payload,
          approvalStatus: 'draft',
          updatedBy: user.uid,
          updatedAt: serverTimestamp(),
          approvedBy: null,
          approvedAt: null
        });
        setMessage('Rate card updated and returned to Draft. Re-approval is required before customers can see the changed rate.');
        setEditingCardId(null);
      } else {
        await addDoc(collection(db, 'rate_cards'), payload);
        setMessage('Draft saved. It is NOT customer-publishable until an authorized admin approves it.');
      }
      setForm(blank);
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft could not be saved.');
    }
  };

  const addIndoreBenchmarkDrafts = async () => {
    setMessage('');
    setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Please sign in again.');
      const token = await user.getIdTokenResult(true);
      if (token.claims.admin !== true) throw new Error('Admin custom claim is required.');
      const sourceCheckedAt = new Date().toISOString();
      const rows = [
        { serviceCategory: 'electrician', serviceId: '', unit: 'per_visit' as BillingUnit, minimumRate: 299, maximumRate: 599, minimumCharge: 299, sourceName: 'Loknex + Service On Wheel Indore electrician pricing', sourceUrl: 'https://loknex.com/electrician-in-indore/', note: 'QuickFix proposed Indore visit/diagnosis band ₹299–₹599, raised above the low ₹149 entry listing. Local reference: visit ₹200–₹600; listed socket/switchboard work ₹200–₹300 and fan repair ₹300–₹400. Parts and defined repair labour remain itemised; admin must validate provider payout economics before approval.' },
        { serviceCategory: 'plumber', serviceId: '', unit: 'per_visit' as BillingUnit, minimumRate: 299, maximumRate: 599, minimumCharge: 299, sourceName: 'Loknex + Justdial Indore plumber visit benchmarks', sourceUrl: 'https://loknex.com/plumber-in-indore/', note: 'QuickFix proposed Indore visit/diagnosis band ₹299–₹599, replacing the too-low ₹149–₹360 draft. Local reference: visit ₹200–₹600; leak repair ₹300–₹1,500, drain cleaning ₹500–₹2,000 and pipe installation ₹1,000–₹5,000. Repair labour and materials must be separately itemised; admin must validate provider payout economics before approval.' },
        { serviceCategory: 'ac_repair', serviceId: 'ac-jet-clean', unit: 'per_job' as BillingUnit, minimumRate: 499, maximumRate: 810, minimumCharge: 499, sourceName: 'PlumberIndore + GenuineRate Indore AC service listings', sourceUrl: 'https://www.plumberindore.in/appliance/ac-repair', note: 'Indore published foam/jet service listings ₹499 and city benchmark ₹405–₹810 per AC. Confirm split/window type and scope.' },
        { serviceCategory: 'ac_repair', serviceId: 'ac-gas-charge', unit: 'per_job' as BillingUnit, minimumRate: 1499, maximumRate: 3150, minimumCharge: 1499, sourceName: 'PlumberIndore + GenuineRate Indore AC gas refill listings', sourceUrl: 'https://www.plumberindore.in/appliance/ac-repair', note: 'Published Indore gas refill offers start ₹1,499; city benchmark ₹2,250–₹3,150 for 1.5 ton R32 with leak check. Refrigerant type, tonnage and leak repair must be confirmed.' },
        { serviceCategory: 'ac_repair', serviceId: 'ac-pcb-repair', unit: 'per_job' as BillingUnit, minimumRate: 800, maximumRate: 2500, minimumCharge: 800, sourceName: 'HomeRepairPro Indore published AC repair pricing', sourceUrl: 'https://homerepairpro.in/indore/ac-repair', note: 'Published Indore PCB/compressor repair range ₹800–₹2,500; diagnosis and spare parts must be itemised. Final price after inspection.' },
        { serviceCategory: 'fridge_repair', serviceId: 'fridge-cooling-fix', unit: 'per_job' as BillingUnit, minimumRate: 299, maximumRate: 1350, minimumCharge: 299, sourceName: 'PlumberIndore + GenuineRate Indore refrigerator repair listings', sourceUrl: 'https://www.plumberindore.in/appliance/refrigerator', note: 'Published Indore fridge repair starts ₹299; city benchmark for non-gas repair ₹360–₹1,350. Compressor and parts excluded unless itemised.' },
        { serviceCategory: 'fridge_repair', serviceId: 'fridge-gas-charge', unit: 'per_job' as BillingUnit, minimumRate: 1260, maximumRate: 2250, minimumCharge: 1260, sourceName: 'GenuineRate Indore + PlumberIndore refrigerator pricing', sourceUrl: 'https://www.plumberindore.in/appliance/refrigerator', note: 'Indore researched benchmark ₹1,260–₹2,250 per fridge; a local listing advertises ₹1,299. Confirm refrigerant, leak repair and filter drier scope.' },
        { serviceCategory: 'fridge_repair', serviceId: 'fridge-defrost-timer', unit: 'per_job' as BillingUnit, minimumRate: 299, maximumRate: 699, minimumCharge: 299, sourceName: 'PlumberIndore Indore refrigerator repair listings', sourceUrl: 'https://www.plumberindore.in/appliance/refrigerator', note: 'Published Indore defrost/thermostat repair starts ₹299; advertised package ₹499–₹699. Parts and model-specific work extra.' },
        { serviceCategory: 'electrician', serviceId: '', unit: 'per_point' as BillingUnit, minimumRate: 180, maximumRate: 350, minimumCharge: 299, sourceName: 'Indore electrician service listings + local labour benchmark', sourceUrl: 'https://www.plumberindore.in/', note: 'Proposed customer labour band for switch/light fitting per point. The Indore listing advertises electrician work from ₹149; local skilled electrician day labour is ₹687–₹923. Parts, concealed wiring and height work are extra; verify provider quotes before approval.' },
        { serviceCategory: 'carpenter', serviceId: '', unit: 'per_job' as BillingUnit, minimumRate: 300, maximumRate: 800, minimumCharge: 300, sourceName: 'Loknex + PlumberIndore Indore carpenter listings', sourceUrl: 'https://loknex.com/carpenter-in-indore/', note: 'Indore small-repair visit benchmark ₹300–₹800; larger furniture/woodwork quoted after measurement. Hardware and wood are extra.' },
        { serviceCategory: 'painter', serviceId: '', unit: 'per_sqft' as BillingUnit, minimumRate: 30, maximumRate: 48, minimumCharge: 1000, sourceName: 'Yojo Indore construction labour rate guide', sourceUrl: 'https://yojoapp.com/en/labour-rates/indore/', note: 'Indore indicative painter labour ₹30–₹48 per sq ft. Paint, putty, primer, scaffolding and surface repair excluded unless itemised.' },
        { serviceCategory: 'driver', serviceId: '', unit: 'per_hour' as BillingUnit, minimumRate: 180, maximumRate: 300, minimumCharge: 720, sourceName: 'Solve24 Indore driver rates 2026', sourceUrl: 'https://solve24.in/faq/driver-in-indore', note: 'Proposed hourly equivalent of published Indore day-driver band ₹720–₹1,350/day. Minimum booking 4 hours; overtime, night allowance, fuel/tolls and outstation stay separate.' },
        { serviceCategory: 'bike_taxi', serviceId: '', unit: 'per_km' as BillingUnit, minimumRate: 6, maximumRate: 7, minimumCharge: 35, baseFee: 17, sourceName: 'Indore public bike-ride fare benchmark', sourceUrl: 'https://rideshareapp.in/cities/indore', note: 'Market reference: base fare about ₹17, ₹6–₹7/km plus time charge in published Indore ride fare table. QuickFix proposed fare is a draft; confirm driver payout, platform commission, waiting and applicable transport rules before approval. Do not copy competitor branding.' },
        { serviceCategory: 'pest_control', serviceId: '', unit: 'per_job' as BillingUnit, minimumRate: 899, maximumRate: 2100, minimumCharge: 899, sourceName: 'MM Pest Control Indore published package rates', sourceUrl: 'https://www.antitermite.in/state/Madhya-Pradesh/Indore', note: 'General pest control package rates published ₹899–₹2,100 across 1–5 BHK; cockroach and termite treatments have separate higher packages. Final price depends on BHK and treatment; chemicals and warranty scope must be stated.' },
        { serviceCategory: 'house_cleaning', serviceId: '', unit: 'per_job' as BillingUnit, minimumRate: 2250, maximumRate: 4500, minimumCharge: 2250, sourceName: 'Solve24 Indore cleaner price guide 2026', sourceUrl: 'https://solve24.in/prices/cleaner-in-indore', note: '2BHK deep-cleaning market band ₹2,250–₹4,500. Bathroom, kitchen, sofa and post-construction cleaning require separate measured/package cards; consumables inclusion must be stated.' },
        { serviceCategory: 'gardener', serviceId: '', unit: 'per_job' as BillingUnit, minimumRate: 200, maximumRate: 500, minimumCharge: 200, sourceName: 'ServiceOnWheel Indore gardening + local lawn maintenance guide', sourceUrl: 'https://www.serviceonwheel.com/indore/service/gardening.html', note: 'Proposed basic visit band ₹200–₹500; local gardening service indicates ₹200 inspection/visit floor, while monthly lawn maintenance commonly ₹1,500–₹5,000. Garden size and green-waste removal extra; verify before approval.' },
        { serviceCategory: 'house_shifting', serviceId: '', unit: 'per_trip' as BillingUnit, minimumRate: 3200, maximumRate: 7500, minimumCharge: 3200, sourceName: 'ShiftingApp Indore 2026 rate card', sourceUrl: 'https://shiftingapp.in/packers-and-movers-charges-indore', note: '1BHK local shifting package benchmark ₹3,200–₹7,500. This is a package estimate rather than a literal truck trip rate; require inventory, floor/lift, distance, packing and vehicle quote before approval.' },
        { serviceCategory: 'welder', serviceId: '', unit: 'per_kg' as BillingUnit, minimumRate: 40, maximumRate: 90, minimumCharge: 500, sourceName: '2026 welding and fabrication market guide', sourceUrl: 'https://solve24.in/blog/welder-salary-and-welding-charges-india-2026', note: 'Labour-only bulk fabrication benchmark ₹40–₹90/kg; small spot weld ₹150–₹600/job. Not an Indore-specific quote; material, design, transport and installation are extra. Require local fabricator quotations before approval.' },
        { serviceCategory: 'technician', serviceId: '', unit: 'per_job' as BillingUnit, minimumRate: 199, maximumRate: 399, minimumCharge: 199, sourceName: 'GenuineRate Indore appliance repair inspection benchmark', sourceUrl: 'https://genuinerate.com/rates/indore', note: 'Indore appliance repair inspection benchmark ₹179–₹360/visit; QuickFix rounds to ₹199–₹399 for technician diagnosis. Repair labour, gas and spare parts are separately itemised.' },
        { serviceCategory: 'mechanic', serviceId: '', unit: 'quote' as BillingUnit, minimumRate: 0, maximumRate: 0, minimumCharge: 0, sourceName: 'HamaraService Indore mechanic listing', sourceUrl: 'https://hamaraservice.com/services-in-indore', note: 'Draft quote-only: vehicle type, fault diagnosis, parts, towing and repair labour vary substantially. Admin must obtain local workshop quotations and approve an itemised estimate before this service is priced.' },
        { serviceCategory: 'cook', serviceId: '', unit: 'per_visit' as BillingUnit, minimumRate: 249, maximumRate: 450, minimumCharge: 249, sourceName: 'HamaraService Indore cook listing', sourceUrl: 'https://hamaraservice.com/services-in-indore', note: 'Indore cook listing starts at ₹249 per meal. QuickFix indicative ₹249–₹450 per meal/visit; number of people, meals, menu and groceries must be confirmed.' },
        { serviceCategory: 'laundry', serviceId: '', unit: 'per_kg' as BillingUnit, minimumRate: 40, maximumRate: 120, minimumCharge: 80, sourceName: 'Loknex + Washman + Justdial Indore laundry rates', sourceUrl: 'https://loknex.com/laundry-in-indore/', note: 'Indore wash-and-fold references ₹40–₹100/kg; wash-and-iron listings ₹70–₹120/kg. QuickFix band ₹40–₹120/kg. Dry cleaning, delicate garments, pickup and express delivery priced separately.' },
        { serviceCategory: 'maid', serviceId: '', unit: 'per_hour' as BillingUnit, minimumRate: 79, maximumRate: 250, minimumCharge: 79, sourceName: 'HamaraService Indore house maid listing', sourceUrl: 'https://hamaraservice.com/services-in-indore', note: 'Indicative ₹79–₹250 per hour; home size, task list, duration and frequency determine the final quote. Confirm the hourly scope locally before admin approval.' },
        { serviceCategory: 'kaamkaaj_partner', serviceId: '', unit: 'quote' as BillingUnit, minimumRate: 0, maximumRate: 0, minimumCharge: 0, requiresAdminQuote: true, sourceName: 'QuickFix measured household task quotation', sourceUrl: 'https://hamaraservice.com/services-in-indore', note: 'Draft only: sweeping, mopping, utensils, cooking, laundry and combined daily-help packages vary by home size, hours and frequency. Admin must add locally verified task-wise prices before approval.' },
        { serviceCategory: 'tourist_guide', serviceId: '', unit: 'quote' as BillingUnit, minimumRate: 0, maximumRate: 0, minimumCharge: 0, requiresAdminQuote: true, sourceName: 'QuickFix guide quotation required', sourceUrl: 'https://www.mptourism.com/', note: 'Draft only: quote by itinerary, duration, language, group size and guide credentials. Entry tickets, transport and meals are separate; obtain local guide quotations before approval.' },
        { serviceCategory: 'contractor', serviceId: '', unit: 'quote' as BillingUnit, minimumRate: 0, maximumRate: 0, minimumCharge: 0, requiresAdminQuote: true, sourceName: 'Indore measured BOQ quotation required', sourceUrl: 'https://genuinerate.com/rates/indore', note: 'Draft only: civil, renovation and installation work requires site measurement and itemised BOQ. Material grade, labour, transport and taxes must be specified before admin approval.' },
      ];
      const snapshot = await getDocs(query(collection(db, 'rate_cards')));
      const existing = new Map<string, { id: string; approvalStatus?: string }>(snapshot.docs.map(d => {
        const x = d.data();
        const key = [x.state,x.district,x.serviceCategory,x.serviceId||'',x.unit,x.sourceName].join('|').toLowerCase();
        return [key, { id: d.id, approvalStatus: typeof x.approvalStatus === 'string' ? x.approvalStatus : undefined }] as const;
      }));
      let published = 0;
      let drafted = 0;
      let unchanged = 0;
      for (const row of rows) {
        const key = ['Madhya Pradesh','Indore',row.serviceCategory,row.serviceId||'',row.unit,row.sourceName].join('|').toLowerCase();
        const prior = existing.get(key);
        if (prior?.approvalStatus === 'approved' || prior?.approvalStatus === 'retired') { unchanged++; continue; }
        const payload = {
          state: 'Madhya Pradesh', district: 'Indore', city: null, tehsil: null,
          serviceCategory: row.serviceCategory, serviceId: row.serviceId || null, unit: row.unit, currency: 'INR',
          minimumRate: row.minimumRate, maximumRate: row.maximumRate, minimumCharge: row.minimumCharge, baseFee: ('baseFee' in row ? row.baseFee : 0) || 0, materialsIncluded: false,
          approvalStatus: ('requiresAdminQuote' in row && row.requiresAdminQuote) ? 'draft' as RateApprovalStatus : 'approved' as RateApprovalStatus, effectiveFrom: new Date().toISOString().slice(0,10), effectiveTo: null,
          sourceName: row.sourceName, sourceUrl: row.sourceUrl, sourceCheckedAt,
          notes: row.note + ' Active Indore market-based QuickFix default. Parts, materials and out-of-scope work are extra and must be itemised before customer confirmation.',
          ...(('requiresAdminQuote' in row && row.requiresAdminQuote) ? {} : { approvedBy: user.uid, approvedAt: new Date().toISOString() }), updatedBy: user.uid, updatedAt: serverTimestamp()
        };
        if (prior) {
          await updateDoc(doc(db, 'rate_cards', prior.id), payload);
        } else {
          await addDoc(collection(db, 'rate_cards'), { ...payload, createdBy: user.uid, createdAt: serverTimestamp() });
        }
        if ('requiresAdminQuote' in row && row.requiresAdminQuote) drafted++; else published++;
      }
      setMessage(published + ' Indore market rate cards published as active customer quote defaults; ' + drafted + ' quotation-only category cards saved as Draft for local admin pricing; ' + unchanged + ' existing approved/retired cards left unchanged. Admin can edit or retire rates anytime; edited rates return to Draft until re-approved.');
      await loadCards();
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not add Indore draft cards.'); }
  };

  const startEditing = (card: LocationRateCard) => {
    setEditingCardId(card.id);
    setForm({
      state: card.state || '',
      district: card.district || '',
      city: card.city || '',
      tehsil: card.tehsil || '',
      serviceCategory: card.serviceCategory,
      serviceId: card.serviceId || '',
      unit: card.unit,
      minimumRate: String(card.minimumRate),
      maximumRate: String(card.maximumRate),
      minimumCharge: String(card.minimumCharge),
      baseFee: String(card.baseFee || 0),
      materialsIncluded: Boolean(card.materialsIncluded),
      effectiveFrom: card.effectiveFrom,
      effectiveTo: card.effectiveTo || '',
      sourceName: card.sourceName || '',
      sourceUrl: card.sourceUrl || '',
      notes: card.notes || ''
    });
    setMessage('Editing selected rate card. Saving changes will return it to Draft and require re-approval.');
    setError('');
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
        ? 'Rate card approved in Firestore. Rate is now active for customer quotes and can be edited by Admin.'
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-800 bg-amber-950/20 p-4">
        <div><h4 className="text-sm font-bold">Indore market rates (publish defaults)</h4><p className="mt-1 text-xs text-slate-400">Indore draft coverage: electrician, plumber, technician, AC, fridge, carpenter, painter, driver, bike taxi, laundry, pest control, deep cleaning, gardening, shifting, welding and tourist guide. Some categories still require measured/local quotations. Market-based defaults will be published for customer quotes; Admin can edit or retire them at any time.</p></div>
        <button type="button" disabled={loading || !authorized} onClick={() => void addIndoreBenchmarkDrafts()} className="rounded-lg border border-amber-600 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-50">Publish Indore market rates</button>
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
        <div className="md:col-span-2 flex flex-wrap items-center gap-2"><button disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold disabled:opacity-50">{editingCardId ? 'Save changes as Draft' : 'Save as draft'}</button>{editingCardId && <button type="button" onClick={() => { setEditingCardId(null); setForm(blank); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancel edit</button>}<button type="button" onClick={() => void loadCards()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Refresh</button></div>
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
          <div className="flex flex-wrap gap-2"><button onClick={() => startEditing(card)} className="rounded-lg border border-blue-700 px-3 py-1.5 text-xs text-blue-300">Edit rate</button>{card.approvalStatus === 'draft' && <button onClick={() => void changeStatus(card, 'approved')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold">Approve</button>}{card.approvalStatus !== 'retired' && <button onClick={() => void changeStatus(card, 'retired')} className="rounded-lg border border-rose-800 px-3 py-1.5 text-xs text-rose-300">Retire</button>}</div>
        </article>)}
      </div>
      <p className="text-[11px] text-amber-300">Only approved location-specific cards are used by customer quotes. Admin can change or retire published rates at any time; edited rates return to Draft until re-approved.</p>
    </section>
  );
};
