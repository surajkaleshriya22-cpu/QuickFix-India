import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Save, RefreshCw, Trash2, CreditCard, ReceiptText, ShieldCheck, AlertTriangle } from 'lucide-react';
import { auth } from '../../lib/firebase';

type RechargePackage = { id: string; name: string; amountRupees: number; durationDays: number; active: boolean };
type RechargeLedgerItem = {
  id: string;
  partnerUid: string;
  partnerName: string;
  partnerPhoneMasked: string;
  packageName: string;
  amountPaise: number;
  currency: string;
  durationDays: number;
  status: string;
  orderId: string;
  paymentId: string | null;
  createdAt: string | null;
  verifiedAt: string | null;
};
type RazorpayReadiness = { configured: boolean; mode: string; missing: string[]; note: string };

const formatRupees = (paise: number) => '₹' + Math.round(paise / 100).toLocaleString('en-IN');
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString('en-IN') : '—';

export const AdminPartnerRechargeSection: React.FC = () => {
  const [trialDays, setTrialDays] = useState(30);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [ledger, setLedger] = useState<RechargeLedgerItem[]>([]);
  const [recentPaidTotalPaise, setRecentPaidTotalPaise] = useState(0);
  const [readiness, setReadiness] = useState<RazorpayReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ledgerError, setLedgerError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setLedgerLoading(true); setError(''); setLedgerError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Admin login session not found. Please sign in again.');
      const token = await user.getIdToken();
      const headers = { Authorization: 'Bearer ' + token };
      const [settingsResponse, ledgerResponse, readinessResponse] = await Promise.all([
        fetch('/api/admin/partner-recharge/packages', { headers }),
        fetch('/api/admin/partner-recharge/ledger?limit=50', { headers }),
        fetch('/api/payments/razorpay/status', { headers })
      ]);
      const settings = await settingsResponse.json().catch(() => ({}));
      if (!settingsResponse.ok || !settings.success) throw new Error(settings.error || 'Recharge settings could not be loaded.');
      setTrialDays(Number.isInteger(settings.trialDays) ? settings.trialDays : 30);
      setPackages(Array.isArray(settings.packages) ? settings.packages : []);

      const ledgerResult = await ledgerResponse.json().catch(() => ({}));
      if (ledgerResponse.ok && ledgerResult.success) {
        setLedger(Array.isArray(ledgerResult.items) ? ledgerResult.items : []);
        setRecentPaidTotalPaise(Number.isInteger(ledgerResult.recentPaidTotalPaise) ? ledgerResult.recentPaidTotalPaise : 0);
      } else {
        setLedger([]);
        setRecentPaidTotalPaise(0);
        setLedgerError(ledgerResult.error || 'Recharge payment history could not be loaded.');
      }

      const readinessResult = await readinessResponse.json().catch(() => ({}));
      setReadiness(readinessResponse.ok && readinessResult.success ? readinessResult : null);
    } catch (e: any) {
      setError(e?.message || 'Could not load recharge settings.');
    } finally {
      setLoading(false);
      setLedgerLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updatePackage = (index: number, patch: Partial<RechargePackage>) =>
    setPackages(current => current.map((p, i) => i === index ? { ...p, ...patch } : p));

  const addPackage = () => {
    if (packages.length >= 20) { setError('Maximum 20 packages allowed.'); return; }
    setPackages(current => [...current, { id: 'pkg_' + Date.now().toString(36), name: '', amountRupees: 1, durationDays: 30, active: true }]);
  };

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Admin login session not found. Please sign in again.');
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/partner-recharge/packages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ trialDays, packages })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result.error || 'Recharge settings could not be saved.');
      setMessage('Recharge packages and free trial settings saved successfully.');
      await load();
    } catch (e: any) { setError(e?.message || 'Save failed.'); }
    finally { setSaving(false); }
  };

  return <section className="space-y-4 text-slate-100">
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-3">
      <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-emerald-400" /><div><h3 className="font-bold">Channel Partner Recharge</h3><p className="text-xs text-slate-400">Admin-controlled subscription pricing for all partner categories</p></div></div>
      <label className="block text-sm font-semibold">Free trial for new partners (days)
        <input type="number" min="0" max="365" step="1" value={trialDays} onChange={e => setTrialDays(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
      </label>
      <p className="text-xs text-slate-400">0 = no free trial. Maximum 365 days. This setting applies to new registrations; existing partners are not automatically changed.</p>
    </div>

    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">Recharge Packages</h3><p className="text-xs text-slate-400">Set the market-facing price and validity. Prices are charged through Razorpay.</p></div><button type="button" onClick={addPackage} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" /> Add package</button></div>
      {loading ? <p className="text-sm text-slate-400">Loading secure settings…</p> : packages.length === 0 ? <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">No packages configured yet. Add at least one package before saving.</p> : packages.map((p, index) => <div key={p.id} className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-800 p-3">
        <label className="text-xs text-slate-400">Package name<input value={p.name} maxLength={80} onChange={e => updatePackage(index, { name: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" placeholder="e.g. Monthly Partner Plan" /></label>
        <label className="text-xs text-slate-400">Package ID<input value={p.id} maxLength={40} onChange={e => updatePackage(index, { id: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">Price (₹)<input type="number" min="1" max="1000000" step="1" value={p.amountRupees} onChange={e => updatePackage(index, { amountRupees: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <label className="text-xs text-slate-400">Validity (days)<input type="number" min="1" max="3650" step="1" value={p.durationDays} onChange={e => updatePackage(index, { durationDays: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.active} onChange={e => updatePackage(index, { active: e.target.checked })} /> Active / visible to partners</label>
        <button type="button" onClick={() => setPackages(current => current.filter((_, i) => i !== index))} className="justify-self-start text-xs text-rose-400 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Remove package</button>
      </div>)}
    </div>

    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-3">
      <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /><h3 className="font-bold">Razorpay readiness</h3></div>
      {readiness ? <div className="space-y-2 text-sm">
        <p>{readiness.configured ? 'Server-side Razorpay credentials are configured.' : 'Razorpay payment setup is incomplete; recharge orders remain disabled.'}</p>
        <p className="text-xs text-slate-400">Mode: {String(readiness.mode || 'unknown').toUpperCase()}</p>
        {Array.isArray(readiness.missing) && readiness.missing.length > 0 && <p className="text-xs text-amber-300">Missing checks: {readiness.missing.join(', ')}</p>}
        <p className="text-xs text-slate-400">{readiness.note}</p>
      </div> : <p className="text-xs text-slate-400">Razorpay readiness could not be checked.</p>}
      <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs text-amber-200 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Razorpay settles captured payments to the bank account registered in your Razorpay merchant Dashboard. The bank account saved separately inside KamXApp does not redirect Razorpay settlements. Verify the settlement bank and settlement status in Razorpay before treating money as credited.</span>
      </div>
    </div>

    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><ReceiptText className="w-5 h-5 text-emerald-400" /><div><h3 className="font-bold">Recharge payment history</h3><p className="text-xs text-slate-400">Latest 50 payment orders</p></div></div>
        <button type="button" disabled={ledgerLoading || loading} onClick={() => void load()} className="rounded-lg border border-slate-700 px-3 py-2 text-xs flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Refresh history</button>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <p className="text-xs text-slate-400">Verified payments in this recent list</p>
        <p className="text-2xl font-extrabold">{formatRupees(recentPaidTotalPaise)}</p>
        <p className="text-[11px] text-slate-500">This is a recent-list total, not a bank-settlement confirmation.</p>
      </div>
      {ledgerLoading ? <p className="text-sm text-slate-400">Loading payment history…</p> : ledgerError ? <p role="alert" className="text-sm text-rose-300">{ledgerError}</p> : ledger.length === 0 ? <p className="text-sm text-slate-400">No recharge payment orders found yet.</p> : <div className="space-y-2">
        {ledger.map(item => <div key={item.id} className="rounded-xl border border-slate-800 p-3 text-xs space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm">{item.partnerName}</strong>
            <span className={item.status === 'paid' ? 'text-emerald-300' : 'text-amber-300'}>{item.status === 'paid' ? 'Captured & verified' : item.status}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2"><span>{item.packageName} · {item.durationDays} days</span><strong>{formatRupees(item.amountPaise)}</strong></div>
          <p className="text-slate-400">{item.partnerPhoneMasked || item.partnerUid} · {formatDate(item.createdAt)}</p>
          <p className="text-slate-500 break-all">Order: {item.orderId || '—'} · Payment: {item.paymentId || 'Pending'}</p>
          {item.verifiedAt && <p className="text-emerald-400">Verified: {formatDate(item.verifiedAt)}</p>}
        </div>)}
      </div>}
      <p className="text-xs text-slate-400">“Captured & verified” means Razorpay confirmed the payment and KamXApp recorded it. It does not mean Razorpay has completed bank settlement.</p>
    </div>

    {error && <p role="alert" className="rounded-lg bg-rose-950/50 border border-rose-800 p-3 text-sm text-rose-300">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-950/50 border border-emerald-800 p-3 text-sm text-emerald-300">{message}</p>}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={loading || saving} onClick={() => void save()} className="rounded-lg bg-emerald-600 disabled:opacity-50 px-4 py-2.5 text-sm font-bold flex items-center gap-2"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Recharge Settings'}</button><button type="button" disabled={loading || saving} onClick={() => void load()} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Reload</button></div>
  </section>;
};
